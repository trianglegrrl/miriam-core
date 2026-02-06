/**
 * Tests for emotional state update tool.
 * TDD: These tests were written BEFORE the implementation.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import will be the tool's core logic (not the OpenClaw wrapper)
import { updateEmotionalState, readEmotionalState, initEmotionalState } from "../../src/tools/emotional-state.ts";
import type { EmotionalState, EmotionalStateUpdate } from "../../src/tools/emotional-state.ts";

let testDir: string;
let stateFile: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-emotional-"));
  await mkdir(join(testDir, "memory"), { recursive: true });
  stateFile = join(testDir, "memory", "emotional-state.json");
});

after(async () => {
  // Cleanup handled per-test via testDir
});

describe("Emotional State Tool", () => {

  describe("initEmotionalState", () => {
    it("should create default state file when none exists", async () => {
      const state = await initEmotionalState(stateFile);
      
      assert.equal(state.current_state.primary, "curious engagement");
      assert.equal(state.current_state.secondary, "steady focus");
      assert.equal(state.current_state.background, "neutral baseline");
      assert.deepEqual(state.recent_wakes, []);
      assert.equal(state.decay_hours, 24);
    });

    it("should return existing state when file exists", async () => {
      const existing: EmotionalState = {
        current_state: {
          primary: "focused",
          secondary: "calm",
          background: "neutral"
        },
        recent_wakes: [],
        decay_hours: 24,
        notes: "test"
      };
      await writeFile(stateFile, JSON.stringify(existing));

      const state = await initEmotionalState(stateFile);
      assert.equal(state.current_state.primary, "focused");
    });

    it("should throw on invalid JSON", async () => {
      await writeFile(stateFile, "not json {{{");
      
      await assert.rejects(
        () => initEmotionalState(stateFile),
        { message: /Invalid JSON/ }
      );
    });
  });

  describe("readEmotionalState", () => {
    it("should return null when file doesn't exist", async () => {
      const state = await readEmotionalState(stateFile);
      assert.equal(state, null);
    });

    it("should return parsed state when file exists", async () => {
      const existing: EmotionalState = {
        current_state: {
          primary: "happy",
          secondary: "engaged",
          background: "peaceful"
        },
        recent_wakes: [],
        decay_hours: 24
      };
      await writeFile(stateFile, JSON.stringify(existing));

      const state = await readEmotionalState(stateFile);
      assert.notEqual(state, null);
      assert.equal(state!.current_state.primary, "happy");
    });
  });

  describe("updateEmotionalState", () => {
    it("should update primary state", async () => {
      await initEmotionalState(stateFile);

      const update: EmotionalStateUpdate = {
        primary: "excited focus"
      };

      const result = await updateEmotionalState(stateFile, update);
      assert.equal(result.current_state.primary, "excited focus");
      assert.equal(result.current_state.secondary, "steady focus"); // unchanged
    });

    it("should update multiple fields at once", async () => {
      await initEmotionalState(stateFile);

      const update: EmotionalStateUpdate = {
        primary: "deep focus",
        secondary: "architectural clarity",
        background: "grounded confidence"
      };

      const result = await updateEmotionalState(stateFile, update);
      assert.equal(result.current_state.primary, "deep focus");
      assert.equal(result.current_state.secondary, "architectural clarity");
      assert.equal(result.current_state.background, "grounded confidence");
    });

    it("should add wake entry with threads and question", async () => {
      await initEmotionalState(stateFile);

      const update: EmotionalStateUpdate = {
        primary: "reflective",
        threads: "migration planning, architecture review",
        question: "How did Phase 1 go?"
      };

      const result = await updateEmotionalState(stateFile, update);
      assert.equal(result.recent_wakes.length, 1);
      assert.equal(result.recent_wakes[0].threads, "migration planning, architecture review");
      assert.equal(result.recent_wakes[0].question_for_future_me, "How did Phase 1 go?");
      assert.ok(result.recent_wakes[0].timestamp); // has timestamp
    });

    it("should prepend new wakes (newest first)", async () => {
      await initEmotionalState(stateFile);

      await updateEmotionalState(stateFile, {
        primary: "state1",
        threads: "first"
      });
      await updateEmotionalState(stateFile, {
        primary: "state2",
        threads: "second"
      });

      const state = await readEmotionalState(stateFile);
      assert.equal(state!.recent_wakes.length, 2);
      assert.equal(state!.recent_wakes[0].threads, "second"); // newest first
      assert.equal(state!.recent_wakes[1].threads, "first");
    });

    it("should cap recent_wakes at 10 entries", async () => {
      await initEmotionalState(stateFile);

      // Add 12 updates
      for (let i = 0; i < 12; i++) {
        await updateEmotionalState(stateFile, {
          primary: `state-${i}`,
          threads: `thread-${i}`
        });
      }

      const state = await readEmotionalState(stateFile);
      assert.equal(state!.recent_wakes.length, 10);
      assert.equal(state!.recent_wakes[0].threads, "thread-11"); // newest
    });

    it("should not add wake entry when no threads or question provided", async () => {
      await initEmotionalState(stateFile);

      const result = await updateEmotionalState(stateFile, {
        primary: "updated"
      });

      assert.equal(result.recent_wakes.length, 0);
      assert.equal(result.current_state.primary, "updated");
    });

    it("should persist changes to file", async () => {
      await initEmotionalState(stateFile);

      await updateEmotionalState(stateFile, {
        primary: "persisted state",
        threads: "persistence test"
      });

      // Read directly from file to verify
      const raw = await readFile(stateFile, "utf-8");
      const parsed = JSON.parse(raw);
      assert.equal(parsed.current_state.primary, "persisted state");
      assert.equal(parsed.recent_wakes[0].threads, "persistence test");
    });

    it("should create state file if it doesn't exist", async () => {
      // Don't init — file doesn't exist
      const result = await updateEmotionalState(stateFile, {
        primary: "new state",
        threads: "creation test"
      });

      assert.equal(result.current_state.primary, "new state");
      assert.equal(result.recent_wakes.length, 1);
    });

    it("should preserve notes field", async () => {
      const existing: EmotionalState = {
        current_state: { primary: "a", secondary: "b", background: "c" },
        recent_wakes: [],
        decay_hours: 48,
        notes: "Custom notes should survive updates"
      };
      await writeFile(stateFile, JSON.stringify(existing));

      const result = await updateEmotionalState(stateFile, {
        primary: "updated"
      });

      assert.equal(result.notes, "Custom notes should survive updates");
      assert.equal(result.decay_hours, 48);
    });
  });
});
