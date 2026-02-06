/**
 * File system utilities with backup and atomic write support.
 * All memory operations go through these helpers.
 */

import { readFile, writeFile, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface WriteOptions {
  backup?: boolean;
  createDirs?: boolean;
}

/**
 * Read a file, returning null if it doesn't exist.
 */
export async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Read and parse a JSON file, returning null if missing or invalid.
 */
export async function readJSON<T = unknown>(path: string): Promise<T | null> {
  const content = await safeReadFile(path);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Invalid JSON in ${path}`);
  }
}

/**
 * Write JSON atomically (write to .tmp, then rename).
 */
export async function writeJSON(
  path: string,
  data: unknown,
  options: WriteOptions = {}
): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  await atomicWrite(path, content, options);
}

/**
 * Atomic write: writes to a temp file then renames.
 * Optionally creates a backup of the original first.
 */
export async function atomicWrite(
  path: string,
  content: string,
  options: WriteOptions = {}
): Promise<void> {
  const { backup = false, createDirs = true } = options;

  if (createDirs) {
    await mkdir(dirname(path), { recursive: true });
  }

  if (backup) {
    await backupFile(path);
  }

  const tmpPath = path + ".tmp";
  await writeFile(tmpPath, content, "utf-8");
  
  // Rename is atomic on most filesystems
  const { rename } = await import("node:fs/promises");
  await rename(tmpPath, path);
}

/**
 * Create a timestamped backup of a file.
 * Returns the backup path, or null if the original doesn't exist.
 */
export async function backupFile(path: string): Promise<string | null> {
  try {
    await stat(path);
  } catch {
    return null; // Original doesn't exist, nothing to back up
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(dirname(path), ".backups");
  await mkdir(backupDir, { recursive: true });
  
  const basename = path.split("/").pop()!;
  const backupPath = join(backupDir, `${basename}.${timestamp}`);
  await copyFile(path, backupPath);
  return backupPath;
}

/**
 * Append content to a file, creating it if needed.
 */
export async function appendToFile(
  path: string,
  content: string,
  options: WriteOptions = {}
): Promise<void> {
  const { createDirs = true } = options;

  if (createDirs) {
    await mkdir(dirname(path), { recursive: true });
  }

  const { appendFile: nodeAppend } = await import("node:fs/promises");
  await nodeAppend(path, content, "utf-8");
}

/**
 * Check if a file exists.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
