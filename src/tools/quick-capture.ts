/**
 * Quick capture tool - capture tasks, uncertainties, threads without breaking flow.
 */

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";

export type TaskContext = string | {
  what?: string;   // What needs to be done
  where?: string;  // Where/which files
  how?: string;    // How to do it / references
  files?: string[]; // Related files
  [key: string]: any; // Allow additional fields
};

export type QuickCaptureParams = {
  content: string;
  type: "task" | "uncertainty" | "thread" | "note";
  priority?: "low" | "medium" | "high";
  context?: TaskContext;
  command?: string;
  dueDate?: string;  // YYYY-MM-DD or "tomorrow"
  workspaceRoot?: string; // For testing
};

export interface QuickCaptureResult {
  success: boolean;
  taskId?: string;  // For tasks
  filePath?: string;
  error?: string;
}

interface Task {
  id: string;
  created: string;
  task: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  context?: TaskContext;
  command?: string;
  dueDate?: string;
}

const VALID_TYPES = ["task", "uncertainty", "thread", "note"];
const VALID_PRIORITIES = ["low", "medium", "high"];

/**
 * Validate capture parameters.
 */
function validateParams(params: QuickCaptureParams): string | null {
  // Validate content
  if (!params.content || params.content.trim().length === 0) {
    return "Content cannot be empty";
  }
  
  // Validate type
  if (!VALID_TYPES.includes(params.type)) {
    return `Invalid type: ${params.type}. Must be one of: ${VALID_TYPES.join(", ")}`;
  }
  
  // Validate priority (if provided)
  if (params.priority && !VALID_PRIORITIES.includes(params.priority)) {
    return `Invalid priority: ${params.priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}`;
  }
  
  return null;
}

/**
 * Convert natural language date to YYYY-MM-DD.
 */
function parseDate(dateStr: string): string {
  const lower = dateStr.toLowerCase().trim();
  
  if (lower === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  
  if (lower === "today") {
    return new Date().toISOString().split("T")[0];
  }
  
  // Assume it's already in YYYY-MM-DD format
  return dateStr;
}

/**
 * Capture a task to tasks.jsonl.
 */
async function captureTask(
  params: QuickCaptureParams,
  memoryDir: string
): Promise<QuickCaptureResult> {
  const taskId = randomUUID();
  const now = new Date().toISOString();
  
  const task: Task = {
    id: taskId,
    created: now,
    task: params.content.trim(),
    status: "pending",
    priority: params.priority || "medium",
  };
  
  if (params.context) {
    task.context = params.context;
  }
  
  if (params.command) {
    task.command = params.command;
  }
  
  if (params.dueDate) {
    task.dueDate = parseDate(params.dueDate);
  }
  
  const jsonLine = JSON.stringify(task) + "\n";
  
  const tasksPath = join(memoryDir, "tasks.jsonl");
  
  try {
    await appendFile(tasksPath, jsonLine, "utf-8");
    
    return {
      success: true,
      taskId,
      filePath: tasksPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to write task: ${error.message}`,
    };
  }
}

/**
 * Capture uncertainty to daily file.
 */
async function captureUncertainty(
  params: QuickCaptureParams,
  memoryDir: string
): Promise<QuickCaptureResult> {
  const today = new Date().toISOString().split("T")[0];
  const dailyPath = join(memoryDir, "private", `${today}-daily.md`);
  
  try {
    // Ensure directory exists
    await mkdir(join(memoryDir, "private"), { recursive: true });
    
    // Read existing content or create new
    let content = "";
    try {
      content = await readFile(dailyPath, "utf-8");
    } catch {
      // File doesn't exist yet
      content = `# ${today} - Daily Log\n\n`;
    }
    
    // Add uncertainty section if it doesn't exist
    if (!content.includes("## Uncertain/Exploring")) {
      content += "\n## Uncertain/Exploring\n\n";
    }
    
    // Append the uncertainty
    content += `- ${params.content.trim()}\n`;
    
    await writeFile(dailyPath, content, "utf-8");
    
    return {
      success: true,
      filePath: dailyPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to write uncertainty: ${error.message}`,
    };
  }
}

/**
 * Capture note to daily file.
 */
async function captureNote(
  params: QuickCaptureParams,
  memoryDir: string
): Promise<QuickCaptureResult> {
  const today = new Date().toISOString().split("T")[0];
  const dailyPath = join(memoryDir, "private", `${today}-daily.md`);
  
  try {
    // Ensure directory exists
    await mkdir(join(memoryDir, "private"), { recursive: true });
    
    // Read existing content or create new
    let content = "";
    try {
      content = await readFile(dailyPath, "utf-8");
    } catch {
      // File doesn't exist yet
      content = `# ${today} - Daily Log\n\n`;
    }
    
    // Add notes section if it doesn't exist
    if (!content.includes("## Notes")) {
      content += "\n## Notes\n\n";
    }
    
    // Append the note
    content += `- ${params.content.trim()}\n`;
    
    await writeFile(dailyPath, content, "utf-8");
    
    return {
      success: true,
      filePath: dailyPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to write note: ${error.message}`,
    };
  }
}

/**
 * Main quick capture function.
 */
export async function quickCapture(params: QuickCaptureParams): Promise<QuickCaptureResult> {
  // Validate
  const validationError = validateParams(params);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }
  
  // Determine workspace root
  const workspaceRoot = params.workspaceRoot || join(homedir(), ".openclaw", "workspace");
  const memoryDir = join(workspaceRoot, "memory");
  
  // Ensure memory directory exists
  try {
    await mkdir(memoryDir, { recursive: true });
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to create memory directory: ${error.message}`,
    };
  }
  
  // Route based on type
  switch (params.type) {
    case "task":
      return captureTask(params, memoryDir);
    
    case "uncertainty":
      return captureUncertainty(params, memoryDir);
    
    case "note":
      return captureNote(params, memoryDir);
    
    case "thread":
      // TODO: Implement thread marker integration
      return {
        success: false,
        error: "Thread capture not yet implemented - use thread-marker tool",
      };
    
    default:
      return {
        success: false,
        error: `Unknown type: ${params.type}`,
      };
  }
}
