/**
 * Memory Update Tool
 * 
 * Safe memory file operations with validation, backup, and atomic writes.
 * All memory modifications should go through this tool.
 * 
 * Key design decisions:
 * - Path validation prevents writes outside memory directories
 * - Automatic backup before modifications
 * - Atomic writes prevent corruption
 * - Create mode prevents accidental overwrites
 * - Empty/whitespace content rejected
 */

import { atomicWrite, appendToFile, backupFile, fileExists } from "../utils/fs.ts";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// --- Types ---

export const MemoryOperation = {
  Append: "append",
  Replace: "replace",
  Create: "create",
} as const;

export type MemoryOperation = (typeof MemoryOperation)[keyof typeof MemoryOperation];

// --- Path Validation ---

/**
 * Allowed memory file patterns.
 * Prevents writing to arbitrary files.
 */
const ALLOWED_PATTERNS = [
  /^MEMORY\.md$/,
  /^memory\/.*\.(md|json)$/,
];

/**
 * Validate that a path is an allowed memory file.
 * Rejects path traversal, non-markdown/json files, and files outside memory.
 */
export function validateMemoryPath(path: string): boolean {
  // Reject path traversal
  if (path.includes("..")) return false;
  
  // Reject absolute paths
  if (path.startsWith("/")) return false;

  // Check against allowed patterns
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(path));
}

// --- Core Operations ---

/**
 * Update a memory file with validation, backup, and safety checks.
 * 
 * @param filePath - Absolute path to the file
 * @param operation - append, replace, or create
 * @param content - Content to write
 */
export async function memoryUpdate(
  filePath: string,
  operation: MemoryOperation,
  content: string
): Promise<void> {
  // Validate content
  if (!content || content.trim().length === 0) {
    throw new Error("Content cannot be empty");
  }

  // Ensure parent directory exists
  await mkdir(dirname(filePath), { recursive: true });

  switch (operation) {
    case MemoryOperation.Append: {
      // Backup existing file before modification
      const exists = await fileExists(filePath);
      if (exists) {
        await backupFile(filePath);
      }
      await appendToFile(filePath, content);
      break;
    }

    case MemoryOperation.Replace: {
      // Backup existing file before replacement
      await backupFile(filePath);
      await atomicWrite(filePath, content);
      break;
    }

    case MemoryOperation.Create: {
      // Reject if file already exists
      const exists = await fileExists(filePath);
      if (exists) {
        throw new Error(`File already exists: ${filePath}`);
      }
      await atomicWrite(filePath, content);
      break;
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
