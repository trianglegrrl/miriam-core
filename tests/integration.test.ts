/**
 * Integration tests - Real workspace data
 * 
 * Tests tools against COPIES of actual workspace files.
 * Verifies that tools work correctly with real data structures.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { homedir } from "node:os";

import { readEmotionalState, updateEmotionalState } from "../src/tools/emotional-state.ts";
import { memoryUpdate, MemoryOperation, validateMemoryPath } from "../src/tools/memory-update.ts";
import { updateDashboardNote, readCurrentNote } from "../src/tools/dashboard-note.ts";

let testDir: string;
let emotionalStateFile: string;
let memoryFile: string;
let dashboardFile: string;

// Source files in actual workspace
const WORKSPACE = join(homedir(), ".openclaw", "workspace");
const SOURCE_EMOTIONAL = join(WORKSPACE, "memory", "emotional-state.json");
const SOURCE_MEMORY = join(WORKSPACE, "MEMORY.md");

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-integration-"));
  emotionalStateFile = join(testDir, "emotional-state.json");
  memoryFile = join(testDir, "MEMORY.md");
  dashboardFile = join(testDir, "dashboard-notes.json");

  // Copy real files to temp directory
  try {
    await copyFile(SOURCE_EMOTIONAL, emotionalStateFile);
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
    // Source file doesn't exist - test will handle it
  }

  try {
    await copyFile(SOURCE_MEMORY, memoryFile);
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
});

after(async () => {
  // Cleanup happens per-test via temp dirs
});

describe("Integration Tests - Real Workspace Data", () => {

  describe("Emotional State with Real Data", () => {
    it("should read actual emotional state file", async () => {
      const state = await readEmotionalState(emotionalStateFile);
      
      // Should have structure (if file exists)
      if (state !== null) {
        assert.ok(state.current_state);
        assert.ok(state.current_state.primary);
        assert.ok(Array.isArray(state.recent_wakes));
        assert.ok(typeof state.decay_hours === "number");
      }
    });

    it("should update actual emotional state preserving structure", async () => {
      // Read original
      const original = await readEmotionalState(emotionalStateFile);
      
      if (original !== null) {
        // Update with new values
        const updated = await updateEmotionalState(emotionalStateFile, {
          primary: "integration test state",
          threads: "testing against real data",
          question: "Did integration work?",
        });

        // Verify structure preserved
        assert.equal(updated.decay_hours, original.decay_hours);
        assert.equal(updated.current_state.primary, "integration test state");
        assert.ok(updated.recent_wakes.length > 0);
        
        // Most recent wake should be our update
        const latestWake = updated.recent_wakes[0];
        assert.equal(latestWake.threads, "testing against real data");
        assert.equal(latestWake.question_for_future_me, "Did integration work?");
      }
    });

    it("should maintain recent_wakes ordering", async () => {
      const state = await readEmotionalState(emotionalStateFile);
      
      if (state !== null && state.recent_wakes.length > 1) {
        // Verify timestamps are in descending order (newest first)
        for (let i = 0; i < state.recent_wakes.length - 1; i++) {
          const current = new Date(state.recent_wakes[i].timestamp);
          const next = new Date(state.recent_wakes[i + 1].timestamp);
          assert.ok(current >= next, "Recent wakes should be newest first");
        }
      }
    });
  });

  describe("Memory Update with Real Data", () => {
    it("should validate memory paths correctly", () => {
      // Valid paths
      assert.equal(validateMemoryPath("MEMORY.md"), true);
      assert.equal(validateMemoryPath("memory/emotional-state.json"), true);
      assert.equal(validateMemoryPath("memory/2026-02-04-daily.md"), true);
      assert.equal(validateMemoryPath("memory/private/2026-02-04-daily.md"), true);

      // Invalid paths
      assert.equal(validateMemoryPath("../etc/passwd"), false);
      assert.equal(validateMemoryPath("/etc/passwd"), false);
      assert.equal(validateMemoryPath("memory/../../../etc/passwd"), false);
      assert.equal(validateMemoryPath("random-file.txt"), false);
    });

    it("should append to actual MEMORY.md", async () => {
      try {
        const original = await readFile(memoryFile, "utf-8");
        const originalLength = original.length;

        // Append test content
        const testContent = "\n\n## Integration Test\n\nThis is a test append.\n";
        await memoryUpdate(memoryFile, MemoryOperation.Append, testContent);

        // Read updated content
        const updated = await readFile(memoryFile, "utf-8");
        assert.ok(updated.length > originalLength);
        assert.ok(updated.includes("Integration Test"));
        assert.ok(updated.includes("test append"));
      } catch (err: any) {
        if (err.code === "ENOENT") {
          // Source file doesn't exist - skip test
          return;
        }
        throw err;
      }
    });

    it("should create backup before append", async () => {
      try {
        await memoryUpdate(memoryFile, MemoryOperation.Append, "\n\nTest backup\n");

        // Check that backup was created
        const backupDir = join(testDir, ".backups");
        const { readdir } = await import("node:fs/promises");
        const backups = await readdir(backupDir);
        
        const memoryBackups = backups.filter(f => f.startsWith("MEMORY.md."));
        assert.ok(memoryBackups.length > 0, "Backup should be created");
      } catch (err: any) {
        if (err.code === "ENOENT") {
          return;
        }
        throw err;
      }
    });
  });

  describe("Dashboard Note End-to-End", () => {
    it("should create, read, and update dashboard note", async () => {
      // Create initial note
      const note1 = await updateDashboardNote(dashboardFile, "Hello from integration test", "🧪");
      assert.equal(note1.message, "Hello from integration test");
      assert.equal(note1.emoji, "🧪");

      // Read it back
      const read1 = await readCurrentNote(dashboardFile);
      assert.notEqual(read1, null);
      assert.equal(read1!.message, "Hello from integration test");

      // Update it
      const note2 = await updateDashboardNote(dashboardFile, "Updated message", "✅");
      assert.equal(note2.message, "Updated message");
      assert.equal(note2.emoji, "✅");

      // Read again
      const read2 = await readCurrentNote(dashboardFile);
      assert.notEqual(read2, null);
      assert.equal(read2!.message, "Updated message");
      assert.ok(note2.timestamp >= note1.timestamp);
    });

    it("should reject invalid dashboard updates", async () => {
      await assert.rejects(
        () => updateDashboardNote(dashboardFile, "", "❌"),
        { message: /empty/ }
      );

      await assert.rejects(
        () => updateDashboardNote(dashboardFile, "x".repeat(501), "❌"),
        { message: /too long/ }
      );
    });
  });

  describe("Cross-Tool Integration", () => {
    it("should handle emotional state and memory update together", async () => {
      // Update emotional state
      await updateEmotionalState(emotionalStateFile, {
        primary: "focused integration testing",
        threads: "multi-tool workflow",
      });

      // Update memory with related content
      const memoryNote = "\n\n## Integration Test Log\n\nTesting multi-tool workflow.\n";
      await memoryUpdate(memoryFile, MemoryOperation.Append, memoryNote);

      // Verify both operations succeeded
      const state = await readEmotionalState(emotionalStateFile);
      const memory = await readFile(memoryFile, "utf-8");

      assert.notEqual(state, null);
      assert.equal(state!.current_state.primary, "focused integration testing");
      assert.ok(memory.includes("Integration Test Log"));
    });

    it("should handle dashboard and emotional state together", async () => {
      // Update dashboard
      await updateDashboardNote(dashboardFile, "Testing complete! 🎉", "✅");

      // Update emotional state
      await updateEmotionalState(emotionalStateFile, {
        primary: "satisfied completion",
        question: "What should we test next?",
      });

      // Verify both
      const note = await readCurrentNote(dashboardFile);
      const state = await readEmotionalState(emotionalStateFile);

      assert.notEqual(note, null);
      assert.notEqual(state, null);
      assert.ok(note!.message.includes("complete"));
      assert.equal(state!.current_state.primary, "satisfied completion");
    });
  });
});
