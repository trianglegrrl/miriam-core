/**
 * Tests for dashboard note tool.
 * TDD: These tests are written BEFORE the implementation.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  updateDashboardNote,
  readCurrentNote,
  validateNoteContent,
} from "../../src/tools/dashboard-note.ts";
import type { DashboardNote } from "../../src/tools/dashboard-note.ts";

let testDir: string;
let noteFile: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-dashboard-"));
  noteFile = join(testDir, "notes.json");
});

after(async () => {
  // Cleanup happens per-test via temp dirs
});

describe("Dashboard Note Tool", () => {

  describe("validateNoteContent", () => {
    it("should accept valid message", () => {
      const result = validateNoteContent("Hello Maya!", "👋");
      assert.equal(result.valid, true);
    });

    it("should reject empty message", () => {
      const result = validateNoteContent("", "👋");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("empty"));
    });

    it("should reject whitespace-only message", () => {
      const result = validateNoteContent("   \n  ", "👋");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("empty"));
    });

    it("should reject message exceeding max length", () => {
      const longMessage = "x".repeat(501);
      const result = validateNoteContent(longMessage, "👋");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("too long"));
    });

    it("should accept message at max length", () => {
      const maxMessage = "x".repeat(500);
      const result = validateNoteContent(maxMessage, "👋");
      assert.equal(result.valid, true);
    });

    it("should accept message without emoji", () => {
      const result = validateNoteContent("Valid message", "");
      assert.equal(result.valid, true);
    });

    it("should accept undefined emoji", () => {
      const result = validateNoteContent("Valid message");
      assert.equal(result.valid, true);
    });

    it("should trim whitespace from message", () => {
      const result = validateNoteContent("  Message with spaces  ", "👋");
      assert.equal(result.valid, true);
    });
  });

  describe("updateDashboardNote", () => {
    it("should create note file with valid content", async () => {
      const note = await updateDashboardNote(noteFile, "Test message", "✨");

      assert.equal(note.message, "Test message");
      assert.equal(note.emoji, "✨");
      assert.ok(note.timestamp);

      // Verify file was created
      const content = await readFile(noteFile, "utf-8");
      const parsed = JSON.parse(content);
      assert.equal(parsed.message, "Test message");
    });

    it("should update existing note", async () => {
      await updateDashboardNote(noteFile, "First message", "1️⃣");
      const note = await updateDashboardNote(noteFile, "Second message", "2️⃣");

      assert.equal(note.message, "Second message");
      assert.equal(note.emoji, "2️⃣");
    });

    it("should throw error for empty message", async () => {
      await assert.rejects(
        () => updateDashboardNote(noteFile, "", "❌"),
        { message: /empty/ }
      );
    });

    it("should throw error for message too long", async () => {
      const longMessage = "x".repeat(501);
      await assert.rejects(
        () => updateDashboardNote(noteFile, longMessage, "❌"),
        { message: /too long/ }
      );
    });

    it("should handle missing emoji gracefully", async () => {
      const note = await updateDashboardNote(noteFile, "No emoji");
      assert.equal(note.message, "No emoji");
      assert.equal(note.emoji, "");
    });

    it("should trim whitespace from message", async () => {
      const note = await updateDashboardNote(noteFile, "  Padded message  ", "🎯");
      assert.equal(note.message, "Padded message");
    });

    it("should generate ISO timestamp", async () => {
      const note = await updateDashboardNote(noteFile, "Time test", "⏰");
      
      // Verify timestamp is valid ISO string
      const parsed = new Date(note.timestamp);
      assert.ok(!isNaN(parsed.getTime()));
      assert.ok(note.timestamp.includes("T"));
    });

    it("should preserve JSON formatting", async () => {
      await updateDashboardNote(noteFile, "Pretty print", "📝");

      const content = await readFile(noteFile, "utf-8");
      // Should have indentation (pretty printed)
      assert.ok(content.includes("\n"));
      assert.ok(content.includes("  ")); // Indentation
    });

    it("should handle special characters in message", async () => {
      const message = 'Message with "quotes" and \\backslashes\\ and newlines\n';
      const note = await updateDashboardNote(noteFile, message, "🔤");
      
      // Read back and verify
      const read = await readCurrentNote(noteFile);
      assert.notEqual(read, null);
      assert.equal(read!.message, message.trim());
    });

    it("should handle unicode emoji correctly", async () => {
      const note = await updateDashboardNote(noteFile, "Test", "🎉🌟💫");
      assert.equal(note.emoji, "🎉🌟💫");
    });

    it("should overwrite previous note completely", async () => {
      // Create note with extra fields
      const custom = {
        message: "Old",
        emoji: "📛",
        timestamp: "2020-01-01T00:00:00.000Z",
        extraField: "should be removed",
      };
      await writeFile(noteFile, JSON.stringify(custom));

      const note = await updateDashboardNote(noteFile, "New", "✅");
      
      // Read raw file to verify structure
      const content = await readFile(noteFile, "utf-8");
      const parsed = JSON.parse(content);
      assert.equal(Object.keys(parsed).length, 3); // Only message, emoji, timestamp
      assert.equal(parsed.extraField, undefined);
    });
  });

  describe("readCurrentNote", () => {
    it("should return null when file doesn't exist", async () => {
      const note = await readCurrentNote(noteFile);
      assert.equal(note, null);
    });

    it("should read existing note", async () => {
      await updateDashboardNote(noteFile, "Existing note", "📖");
      
      const note = await readCurrentNote(noteFile);
      assert.notEqual(note, null);
      assert.equal(note!.message, "Existing note");
      assert.equal(note!.emoji, "📖");
    });

    it("should throw on malformed JSON", async () => {
      await writeFile(noteFile, "not valid json {{{");

      await assert.rejects(
        () => readCurrentNote(noteFile),
        { message: /Invalid JSON/ }
      );
    });

    it("should handle empty file", async () => {
      await writeFile(noteFile, "");

      await assert.rejects(
        () => readCurrentNote(noteFile),
        { message: /Invalid JSON/ }
      );
    });

    it("should read note without emoji field", async () => {
      const minimal = {
        message: "Minimal",
        timestamp: new Date().toISOString(),
      };
      await writeFile(noteFile, JSON.stringify(minimal));

      const note = await readCurrentNote(noteFile);
      assert.notEqual(note, null);
      assert.equal(note!.message, "Minimal");
      assert.equal(note!.emoji, undefined);
    });
  });
});
