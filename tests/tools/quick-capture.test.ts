/**
 * Tests for quick-capture tool.
 * TDD: Tests written BEFORE implementation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { quickCapture } from "../../src/tools/quick-capture.ts";
import type { QuickCaptureParams } from "../../src/tools/quick-capture.ts";

let testDir: string;
let memoryDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-capture-"));
  memoryDir = join(testDir, "memory");
  await mkdir(memoryDir, { recursive: true });
});

describe("Quick Capture Tool", () => {
  
  describe("Task capture (JSONL)", () => {
    it("should append valid JSONL to tasks.jsonl", async () => {
      const params: QuickCaptureParams = {
        content: "Follow up on Steve's config",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      assert.ok(result.taskId);
      
      // Verify JSONL file exists and is valid
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const lines = content.trim().split("\n");
      
      assert.equal(lines.length, 1);
      
      const task = JSON.parse(lines[0]);
      assert.equal(task.task, "Follow up on Steve's config");
      assert.equal(task.status, "pending");
      assert.ok(task.id);
      assert.ok(task.created);
    });

    it("should include all required task fields", async () => {
      const params: QuickCaptureParams = {
        content: "Test task",
        type: "task",
        priority: "high",
        context: "telegram-alaina",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const task = JSON.parse(content.trim());
      
      assert.ok(task.id);
      assert.ok(task.created);
      assert.equal(task.task, "Test task");
      assert.equal(task.status, "pending");
      assert.equal(task.priority, "high");
      assert.equal(task.context, "telegram-alaina");
    });

    it("should create tasks.jsonl if doesn't exist", async () => {
      const params: QuickCaptureParams = {
        content: "First task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      assert.ok(content.trim().length > 0);
    });

    it("should generate unique UUIDs", async () => {
      const params1: QuickCaptureParams = {
        content: "Task 1",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const params2: QuickCaptureParams = {
        content: "Task 2",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result1 = await quickCapture(params1);
      const result2 = await quickCapture(params2);
      
      assert.notEqual(result1.taskId, result2.taskId);
    });

    it("should default priority to medium", async () => {
      const params: QuickCaptureParams = {
        content: "Test task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const task = JSON.parse(content.trim());
      
      assert.equal(task.priority, "medium");
    });

    it("should store command field when provided", async () => {
      const params: QuickCaptureParams = {
        content: "Check email",
        type: "task",
        command: "check_email",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const task = JSON.parse(content.trim());
      
      assert.equal(task.command, "check_email");
    });

    it("should convert 'tomorrow' to correct date", async () => {
      const params: QuickCaptureParams = {
        content: "Follow up tomorrow",
        type: "task",
        dueDate: "tomorrow",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const task = JSON.parse(content.trim());
      
      // Should be tomorrow's date in YYYY-MM-DD format
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = tomorrow.toISOString().split("T")[0];
      
      assert.equal(task.dueDate, expected);
    });

    it("should handle special characters in content", async () => {
      const params: QuickCaptureParams = {
        content: 'Task with "quotes" and \'apostrophes\' and emoji 🚀',
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const task = JSON.parse(content.trim());
      
      assert.equal(task.task, 'Task with "quotes" and \'apostrophes\' and emoji 🚀');
    });

    it("should append to existing tasks file", async () => {
      const params1: QuickCaptureParams = {
        content: "First task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const params2: QuickCaptureParams = {
        content: "Second task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      await quickCapture(params1);
      await quickCapture(params2);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      const lines = content.trim().split("\n");
      
      assert.equal(lines.length, 2);
      
      const task1 = JSON.parse(lines[0]);
      const task2 = JSON.parse(lines[1]);
      
      assert.equal(task1.task, "First task");
      assert.equal(task2.task, "Second task");
    });

    it("should return task ID in response", async () => {
      const params: QuickCaptureParams = {
        content: "Test task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.taskId);
      assert.match(result.taskId, /^[0-9a-f-]{36}$/); // UUID format
    });

    it("should produce valid JSONL (parseable)", async () => {
      const params: QuickCaptureParams = {
        content: "Test task",
        type: "task",
        workspaceRoot: testDir,
      };
      
      await quickCapture(params);
      
      const tasksPath = join(memoryDir, "tasks.jsonl");
      const content = await readFile(tasksPath, "utf-8");
      
      // Should not throw
      assert.doesNotThrow(() => {
        JSON.parse(content.trim());
      });
    });
  });

  describe("Uncertainty capture (daily file)", () => {
    it("should append to daily file", async () => {
      const params: QuickCaptureParams = {
        content: "Not sure about approach X yet",
        type: "uncertainty",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      
      const today = new Date().toISOString().split("T")[0];
      const dailyPath = join(memoryDir, "private", `${today}-daily.md`);
      const content = await readFile(dailyPath, "utf-8");
      
      assert.match(content, /## Uncertain\/Exploring/);
      assert.match(content, /Not sure about approach X yet/);
    });

    it("should create daily file if doesn't exist", async () => {
      const params: QuickCaptureParams = {
        content: "Uncertain about Y",
        type: "uncertainty",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      
      const today = new Date().toISOString().split("T")[0];
      const dailyPath = join(memoryDir, "private", `${today}-daily.md`);
      const content = await readFile(dailyPath, "utf-8");
      
      assert.ok(content.includes("Uncertain about Y"));
    });
  });

  describe("Note capture (daily file)", () => {
    it("should append to daily file", async () => {
      const params: QuickCaptureParams = {
        content: "This matters - flag for later review",
        type: "note",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.ok(result.success);
      
      const today = new Date().toISOString().split("T")[0];
      const dailyPath = join(memoryDir, "private", `${today}-daily.md`);
      const content = await readFile(dailyPath, "utf-8");
      
      assert.match(content, /This matters - flag for later review/);
    });
  });

  describe("Validation", () => {
    it("should reject empty content", async () => {
      const params: QuickCaptureParams = {
        content: "",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
      assert.match(result.error, /empty/i);
    });

    it("should reject whitespace-only content", async () => {
      const params: QuickCaptureParams = {
        content: "   \n\t  ",
        type: "task",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it("should reject invalid type", async () => {
      const params: any = {
        content: "Test",
        type: "invalid-type",
        workspaceRoot: testDir,
      };
      
      const result = await quickCapture(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
    });
  });
});
