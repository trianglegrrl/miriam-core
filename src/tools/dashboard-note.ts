/**
 * Dashboard Note Tool
 * 
 * Updates Maya's iPad dashboard with messages and emoji.
 * Simple JSON file with message, emoji, and timestamp.
 * 
 * Key design decisions:
 * - Validates content before write (no empty messages, length limits)
 * - Atomic writes for safety
 * - Overwrites completely (no merging with existing content)
 * - Timestamps in ISO format for consistency
 */

import { readJSON, writeJSON } from "../utils/fs.ts";

// --- Types ---

export interface DashboardNote {
  message: string;
  emoji: string;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// --- Constants ---

const MAX_MESSAGE_LENGTH = 500;

// --- Functions ---

/**
 * Validate note content before writing.
 * Checks for empty messages and length limits.
 */
export function validateNoteContent(
  message: string,
  emoji: string = ""
): ValidationResult {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
    };
  }

  return { valid: true };
}

/**
 * Update the dashboard note with a new message.
 * Validates content and writes atomically.
 * Returns the written note.
 */
export async function updateDashboardNote(
  noteFile: string,
  message: string,
  emoji: string = ""
): Promise<DashboardNote> {
  // Validate
  const validation = validateNoteContent(message, emoji);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create note
  const note: DashboardNote = {
    message: message.trim(),
    emoji: emoji,
    timestamp: new Date().toISOString(),
  };

  // Write atomically
  await writeJSON(noteFile, note);

  return note;
}

/**
 * Read the current dashboard note.
 * Returns null if the file doesn't exist.
 */
export async function readCurrentNote(
  noteFile: string
): Promise<DashboardNote | null> {
  return readJSON<DashboardNote>(noteFile);
}
