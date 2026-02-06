/**
 * Thread marker tool - mark conversations/topics to revisit later.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";

export type ThreadMarkerParams = {
  topic: string;
  question: string;
  when?: string;  // "tomorrow", "next week", or YYYY-MM-DD
  importance?: "low" | "medium" | "high";
  workspaceRoot?: string; // For testing
};

export interface ThreadMarkerResult {
  success: boolean;
  threadId?: string;
  error?: string;
}

interface Thread {
  id: string;
  timestamp: string;
  topic: string;
  question: string;
  revisit?: string;  // YYYY-MM-DD
  importance: "low" | "medium" | "high";
  status: "open" | "resolved";
}

interface ThreadsFile {
  threads: Thread[];
}

const VALID_IMPORTANCE = ["low", "medium", "high"];

/**
 * Validate parameters.
 */
function validateParams(params: ThreadMarkerParams): string | null {
  if (!params.topic || params.topic.trim().length === 0) {
    return "Topic cannot be empty";
  }
  
  if (!params.question || params.question.trim().length === 0) {
    return "Question cannot be empty";
  }
  
  if (params.importance && !VALID_IMPORTANCE.includes(params.importance)) {
    return `Invalid importance: ${params.importance}. Must be one of: ${VALID_IMPORTANCE.join(", ")}`;
  }
  
  return null;
}

/**
 * Parse natural language date to YYYY-MM-DD.
 */
function parseWhen(when: string | undefined): string | undefined {
  if (!when) return undefined;
  
  const lower = when.toLowerCase().trim();
  
  if (lower === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  
  if (lower === "next week") {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  }
  
  if (lower === "today") {
    return new Date().toISOString().split("T")[0];
  }
  
  // Assume it's already YYYY-MM-DD
  return when;
}

/**
 * Read existing threads file or create empty structure.
 */
async function readThreadsFile(threadsPath: string): Promise<ThreadsFile> {
  try {
    const content = await readFile(threadsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist yet
    return { threads: [] };
  }
}

/**
 * Write threads file.
 */
async function writeThreadsFile(threadsPath: string, data: ThreadsFile): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await writeFile(threadsPath, json, "utf-8");
}

/**
 * Main thread marker function.
 */
export async function threadMarker(params: ThreadMarkerParams): Promise<ThreadMarkerResult> {
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
  const threadsPath = join(memoryDir, "threads.json");
  
  try {
    // Ensure memory directory exists
    await mkdir(memoryDir, { recursive: true });
    
    // Read existing threads
    const threadsData = await readThreadsFile(threadsPath);
    
    // Create new thread
    const threadId = randomUUID();
    const now = new Date().toISOString();
    const revisit = parseWhen(params.when);
    
    const thread: Thread = {
      id: threadId,
      timestamp: now,
      topic: params.topic.trim(),
      question: params.question.trim(),
      importance: params.importance || "medium",
      status: "open",
    };
    
    if (revisit) {
      thread.revisit = revisit;
    }
    
    // Append thread
    threadsData.threads.push(thread);
    
    // Write back
    await writeThreadsFile(threadsPath, threadsData);
    
    return {
      success: true,
      threadId,
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to mark thread: ${error.message}`,
    };
  }
}
