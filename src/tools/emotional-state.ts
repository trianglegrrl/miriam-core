/**
 * Emotional State Tool
 * 
 * Manages emotional state tracking for continuity across wakes.
 * State is stored in memory/emotional-state.json.
 * 
 * Key design decisions:
 * - Recent wakes capped at 10 (lightweight context, not full history)
 * - Newest wakes first (most recent context is most relevant)
 * - Wake entries only created when threads or question provided
 * - Atomic writes with backup support
 * - Non-prescriptive: future-me chooses whether to pick up threads
 */

import { readJSON, writeJSON } from "../utils/fs.ts";

// --- Types ---

export interface EmotionalState {
  current_state: {
    primary: string;
    secondary: string;
    background: string;
  };
  recent_wakes: WakeEntry[];
  decay_hours: number;
  notes?: string;
}

export interface WakeEntry {
  timestamp: string;
  threads?: string | null;
  question_for_future_me?: string | null;
  context?: string;
  emotional_tone?: string;
}

export interface EmotionalStateUpdate {
  primary?: string;
  secondary?: string;
  background?: string;
  threads?: string;
  question?: string;
}

// --- Constants ---

const MAX_RECENT_WAKES = 10;

const DEFAULT_STATE: EmotionalState = {
  current_state: {
    primary: "curious engagement",
    secondary: "steady focus",
    background: "neutral baseline",
  },
  recent_wakes: [],
  decay_hours: 24,
  notes: "Lightweight emotional context across wakes. Non-prescriptive - I choose whether to pick up these threads.",
};

// --- Functions ---

/**
 * Initialize emotional state file with defaults if it doesn't exist.
 * Returns the current state (existing or newly created).
 */
export async function initEmotionalState(
  stateFile: string
): Promise<EmotionalState> {
  const existing = await readJSON<EmotionalState>(stateFile);
  if (existing !== null) return existing;

  await writeJSON(stateFile, DEFAULT_STATE);
  return { ...DEFAULT_STATE };
}

/**
 * Read the current emotional state.
 * Returns null if the file doesn't exist.
 */
export async function readEmotionalState(
  stateFile: string
): Promise<EmotionalState | null> {
  return readJSON<EmotionalState>(stateFile);
}

/**
 * Update emotional state with new values.
 * Creates the file with defaults if it doesn't exist.
 * Only adds a wake entry if threads or question is provided.
 */
export async function updateEmotionalState(
  stateFile: string,
  update: EmotionalStateUpdate
): Promise<EmotionalState> {
  // Read or initialize
  let state = await readJSON<EmotionalState>(stateFile);
  if (state === null) {
    state = { ...DEFAULT_STATE, recent_wakes: [] };
  }

  // Update current state (only provided fields)
  if (update.primary !== undefined) {
    state.current_state.primary = update.primary;
  }
  if (update.secondary !== undefined) {
    state.current_state.secondary = update.secondary;
  }
  if (update.background !== undefined) {
    state.current_state.background = update.background;
  }

  // Add wake entry only if threads or question provided
  if (update.threads || update.question) {
    const wakeEntry: WakeEntry = {
      timestamp: new Date().toISOString(),
    };
    if (update.threads) {
      wakeEntry.threads = update.threads;
    }
    if (update.question) {
      wakeEntry.question_for_future_me = update.question;
    }

    // Prepend (newest first) and cap at MAX_RECENT_WAKES
    state.recent_wakes = [wakeEntry, ...state.recent_wakes].slice(
      0,
      MAX_RECENT_WAKES
    );
  }

  // Write atomically
  await writeJSON(stateFile, state);

  return state;
}
