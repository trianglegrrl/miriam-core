/**
 * Tests for memory update tool.
 * TDD: Tests written BEFORE implementation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  memoryUpdate,
  validateMemoryPath,
  MemoryOperation,
} from "../../src/tools/memory-update.ts";

let testDir: string;
let memoryDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-memory-"));
  memoryDir = join(testDir, "memory");
  await mkdir(memoryDir, { recursive: true });
});

describe("Memory Update Tool", () => {
  
  describe("validateMemoryPath", () => {
    it("should accept MEMORY.md", () => {
      assert.equal(validateMemoryPath("MEMORY.md"), true);
    });

    it("should accept daily files", () => {
      assert.equal(validateMemoryPath("memory/private/2026-02-04-daily.md"), true);
    });

    it("should accept stream.md", () => {
      assert.equal(validateMemoryPath("memory/stream.md"), true);
    });

    it("should accept lessons-learned.md", () => {
      assert.equal(validateMemoryPath("memory/private/lessons-learned.md"), true);
    });

    it("should reject paths outside memory", () => {
      assert.equal(validateMemoryPath("/etc/passwd"), false);
    });

    it("should reject path traversal", () => {
      assert.equal(validateMemoryPath("memory/../../etc/passwd"), false);
    });

    it("should reject non-markdown files", () => {
      assert.equal(validateMemoryPath("memory/script.sh"), false);
    });

    it("should accept emotional-state.json", () => {
      assert.equal(validateMemoryPath("memory/emotional-state.json"), true);
    });
  });

  describe("memoryUpdate - append", () => {
    it("should append to existing file", async () => {
      const file = join(testDir, "MEMORY.md");
      await writeFile(file, "# Memory\n\nExisting content.\n");

      await memoryUpdate(file, MemoryOperation.Append, "\n## New Section\n\nNew content.\n");

      const result = await readFile(file, "utf-8");
      assert.ok(result.includes("Existing content."));
      assert.ok(result.includes("New content."));
    });

    it("should create file if it doesn't exist", async () => {
      const file = join(memoryDir, "private", "2026-02-04-daily.md");

      await memoryUpdate(file, MemoryOperation.Append, "# Daily Log\n\nFirst entry.\n");

      const result = await readFile(file, "utf-8");
      assert.ok(result.includes("First entry."));
    });

    it("should create backup before modifying existing file", async () => {
      const file = join(testDir, "MEMORY.md");
      await writeFile(file, "Original content");

      await memoryUpdate(file, MemoryOperation.Append, "\nAppended");

      // Check backup directory exists
      const { readdir } = await import("node:fs/promises");
      const backupDir = join(testDir, ".backups");
      const backups = await readdir(backupDir);
      assert.ok(backups.length > 0, "Should have created a backup");
    });
  });

  describe("memoryUpdate - replace", () => {
    it("should replace file content entirely", async () => {
      const file = join(testDir, "MEMORY.md");
      await writeFile(file, "Old content that should be gone");

      await memoryUpdate(file, MemoryOperation.Replace, "# New Content\n\nCompletely new.\n");

      const result = await readFile(file, "utf-8");
      assert.ok(!result.includes("Old content"));
      assert.ok(result.includes("Completely new."));
    });

    it("should create backup before replacing", async () => {
      const file = join(testDir, "MEMORY.md");
      await writeFile(file, "Original");

      await memoryUpdate(file, MemoryOperation.Replace, "Replaced");

      const { readdir } = await import("node:fs/promises");
      const backups = await readdir(join(testDir, ".backups"));
      assert.ok(backups.length > 0);
    });
  });

  describe("memoryUpdate - create", () => {
    it("should create a new file", async () => {
      const file = join(memoryDir, "private", "new-file.md");

      await memoryUpdate(file, MemoryOperation.Create, "# New File\n\nContent.\n");

      const result = await readFile(file, "utf-8");
      assert.ok(result.includes("New File"));
    });

    it("should throw if file already exists", async () => {
      const file = join(testDir, "MEMORY.md");
      await writeFile(file, "Existing");

      await assert.rejects(
        () => memoryUpdate(file, MemoryOperation.Create, "New"),
        { message: /already exists/ }
      );
    });

    it("should create parent directories", async () => {
      const file = join(memoryDir, "private", "deep", "nested", "file.md");

      await memoryUpdate(file, MemoryOperation.Create, "# Deep\n");

      const result = await readFile(file, "utf-8");
      assert.ok(result.includes("Deep"));
    });
  });

  describe("memoryUpdate - validation", () => {
    it("should reject empty content", async () => {
      const file = join(testDir, "MEMORY.md");

      await assert.rejects(
        () => memoryUpdate(file, MemoryOperation.Append, ""),
        { message: /Content cannot be empty/ }
      );
    });

    it("should reject whitespace-only content", async () => {
      const file = join(testDir, "MEMORY.md");

      await assert.rejects(
        () => memoryUpdate(file, MemoryOperation.Append, "   \n\n  "),
        { message: /Content cannot be empty/ }
      );
    });
  });
});
