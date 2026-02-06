/**
 * Task executor tool - execute pending tasks from tasks.jsonl.
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";

const execAsync = promisify(exec);

export type TaskExecutorParams = {
  action: "execute" | "list" | "status";
  taskId?: string;
  newStatus?: "pending" | "in-progress" | "completed" | "cancelled";
  filter?: "pending" | "completed" | "all";
  workspaceRoot?: string; // For testing
};

export interface Task {
  id: string;
  created: string;
  task: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high";
  context?: string;
  command?: string;
  dueDate?: string; // YYYY-MM-DD
  completedAt?: string;
}

export interface TaskExecutorResult {
  success: boolean;
  tasks?: Task[];
  executed?: number;
  error?: string;
}

/**
 * Read all tasks from JSONL file.
 */
async function readTasks(tasksPath: string): Promise<Task[]> {
  try {
    const content = await readFile(tasksPath, "utf-8");
    const lines = content.trim().split("\n").filter(line => line.trim().length > 0);
    
    const tasks: Task[] = [];
    
    for (const line of lines) {
      try {
        const task = JSON.parse(line);
        tasks.push(task);
      } catch {
        // Skip invalid JSON lines
        console.warn(`Skipping invalid JSONL line: ${line.substring(0, 50)}...`);
      }
    }
    
    return tasks;
    
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // File doesn't exist yet
      return [];
    }
    throw error;
  }
}

/**
 * Get latest version of each task (by id).
 * Tasks can have multiple entries in JSONL (status updates).
 */
function getLatestTasks(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  
  for (const task of tasks) {
    taskMap.set(task.id, task); // Later entries overwrite earlier ones
  }
  
  return Array.from(taskMap.values());
}

/**
 * Filter tasks by status.
 */
function filterByStatus(tasks: Task[], filter?: string): Task[] {
  if (!filter || filter === "all") {
    return tasks;
  }
  
  return tasks.filter(task => task.status === filter);
}

/**
 * Check if task is due (today or earlier).
 */
function isDue(task: Task): boolean {
  if (!task.dueDate) {
    // No due date = execute anytime
    return true;
  }
  
  const today = new Date().toISOString().split("T")[0];
  return task.dueDate <= today;
}

/**
 * Execute a single task.
 */
async function executeTask(task: Task): Promise<{ success: boolean; output?: string; error?: string }> {
  if (!task.command) {
    return {
      success: true,
      output: "Task has no command to execute",
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(task.command, {
      timeout: 60000, // 60s timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
    });
    
    return {
      success: true,
      output: stdout || stderr,
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update task status by appending new line to JSONL.
 */
async function updateTaskStatus(
  tasksPath: string,
  taskId: string,
  newStatus: string,
  tasks: Task[]
): Promise<void> {
  // Find the task
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  // Create updated version
  const updated = {
    ...task,
    status: newStatus,
  };
  
  if (newStatus === "completed") {
    updated.completedAt = new Date().toISOString();
  }
  
  // Append new line
  const jsonLine = JSON.stringify(updated) + "\n";
  await appendFile(tasksPath, jsonLine, "utf-8");
}

/**
 * Main task executor function.
 */
export async function taskExecutor(params: TaskExecutorParams): Promise<TaskExecutorResult> {
  const workspaceRoot = params.workspaceRoot || join(homedir(), ".openclaw", "workspace");
  const memoryDir = join(workspaceRoot, "memory");
  const tasksPath = join(memoryDir, "tasks.jsonl");
  
  try {
    // Ensure memory directory exists
    await mkdir(memoryDir, { recursive: true });
    
    // Read all tasks
    const allTasks = await readTasks(tasksPath);
    const latestTasks = getLatestTasks(allTasks);
    
    switch (params.action) {
      case "list": {
        const filtered = filterByStatus(latestTasks, params.filter);
        
        return {
          success: true,
          tasks: filtered,
        };
      }
      
      case "status": {
        if (!params.taskId || !params.newStatus) {
          return {
            success: false,
            error: "taskId and newStatus required for status action",
          };
        }
        
        await updateTaskStatus(tasksPath, params.taskId, params.newStatus, latestTasks);
        
        return {
          success: true,
        };
      }
      
      case "execute": {
        const pendingTasks = latestTasks.filter(
          task => task.status === "pending" && isDue(task)
        );
        
        let executed = 0;
        
        for (const task of pendingTasks) {
          const result = await executeTask(task);
          
          if (result.success) {
            // Mark as completed
            await updateTaskStatus(tasksPath, task.id, "completed", latestTasks);
            executed++;
          } else {
            console.error(`Task ${task.id} execution failed:`, result.error);
          }
        }
        
        return {
          success: true,
          executed,
        };
      }
      
      default:
        return {
          success: false,
          error: `Unknown action: ${params.action}`,
        };
    }
    
  } catch (error: any) {
    return {
      success: false,
      error: `Task executor failed: ${error.message}`,
    };
  }
}
