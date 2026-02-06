/**
 * Tests for task-executor tool.
 * TDD: Tests written BEFORE implementation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { taskExecutor } from "../../src/tools/task-executor.ts";
import type { TaskExecutorParams } from "../../src/tools/task-executor.ts";

let testDir: string;
let memoryDir: string;
let tasksPath: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-tasks-"));
  memoryDir = join(testDir, "memory");
  await mkdir(memoryDir, { recursive: true });
  tasksPath = join(memoryDir, "tasks.jsonl");
});

describe("Task Executor Tool", () => {
  
  describe("Listing tasks", () => {
    it("should list all tasks from JSONL", async () => {
      const task1 = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Task 1",
        status: "pending",
        priority: "medium",
      });
      
      const task2 = JSON.stringify({
        id: "def456",
        created: "2026-02-05T18:01:00Z",
        task: "Task 2",
        status: "completed",
        priority: "high",
      });
      
      await writeFile(tasksPath, task1 + "\n" + task2 + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "list",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.ok(result.tasks);
      assert.equal(result.tasks.length, 2);
    });

    it("should handle empty tasks file", async () => {
      await writeFile(tasksPath, "", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "list",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length || 0, 0);
    });

    it("should handle missing tasks file", async () => {
      const params: TaskExecutorParams = {
        action: "list",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length || 0, 0);
    });
  });

  describe("Filtering tasks", () => {
    beforeEach(async () => {
      const tasks = [
        { id: "1", created: "2026-02-05T18:00:00Z", task: "Task 1", status: "pending", priority: "medium" },
        { id: "2", created: "2026-02-05T18:01:00Z", task: "Task 2", status: "completed", priority: "high" },
        { id: "3", created: "2026-02-05T18:02:00Z", task: "Task 3", status: "pending", priority: "low" },
      ];
      
      const content = tasks.map(t => JSON.stringify(t)).join("\n") + "\n";
      await writeFile(tasksPath, content, "utf-8");
    });

    it("should filter by status=pending", async () => {
      const params: TaskExecutorParams = {
        action: "list",
        filter: "pending",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length, 2);
      assert.ok(result.tasks?.every(t => t.status === "pending"));
    });

    it("should filter by status=completed", async () => {
      const params: TaskExecutorParams = {
        action: "list",
        filter: "completed",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length, 1);
      assert.equal(result.tasks?.[0].status, "completed");
    });

    it("should return all tasks with filter=all", async () => {
      const params: TaskExecutorParams = {
        action: "list",
        filter: "all",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length, 3);
    });
  });

  describe("Finding due tasks", () => {
    it("should find tasks due today", async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Task due today",
        status: "pending",
        priority: "medium",
        dueDate: today,
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "execute",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      // Should find the task as due
    });

    it("should find tasks due in the past", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-04T18:00:00Z",
        task: "Overdue task",
        status: "pending",
        priority: "high",
        dueDate: yesterdayStr,
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "execute",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      // Should execute overdue task
    });

    it("should NOT execute future tasks", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Future task",
        status: "pending",
        priority: "medium",
        dueDate: tomorrowStr,
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "execute",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.executed || 0, 0);
    });
  });

  describe("Updating task status", () => {
    it("should append new line with updated status", async () => {
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Test task",
        status: "pending",
        priority: "medium",
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "status",
        taskId: "abc123",
        newStatus: "completed",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      
      // Check JSONL has two lines now
      const content = await readFile(tasksPath, "utf-8");
      const lines = content.trim().split("\n");
      
      assert.equal(lines.length, 2);
      
      const updated = JSON.parse(lines[1]);
      assert.equal(updated.status, "completed");
      assert.ok(updated.completedAt);
    });

    it("should preserve history (don't modify original line)", async () => {
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Test task",
        status: "pending",
        priority: "medium",
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "status",
        taskId: "abc123",
        newStatus: "completed",
        workspaceRoot: testDir,
      };
      
      await taskExecutor(params);
      
      const content = await readFile(tasksPath, "utf-8");
      const lines = content.trim().split("\n");
      
      const original = JSON.parse(lines[0]);
      assert.equal(original.status, "pending"); // Original unchanged
      
      const updated = JSON.parse(lines[1]);
      assert.equal(updated.status, "completed"); // New line updated
    });
  });

  describe("Handling invalid JSONL", () => {
    it("should skip invalid lines", async () => {
      const content = `{"id":"1","task":"Good task","status":"pending"}
this is not valid json
{"id":"2","task":"Another good task","status":"pending"}
`;
      
      await writeFile(tasksPath, content, "utf-8");
      
      const params: TaskExecutorParams = {
        action: "list",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.equal(result.tasks?.length, 2); // Should only get valid lines
    });
  });

  describe("Execution", () => {
    it("should handle tasks without command gracefully", async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Task without command",
        status: "pending",
        priority: "medium",
        dueDate: today,
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "execute",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      // Should not error, just skip execution
    });

    it("should return execution results", async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const task = JSON.stringify({
        id: "abc123",
        created: "2026-02-05T18:00:00Z",
        task: "Test task",
        status: "pending",
        priority: "medium",
        dueDate: today,
        command: "echo test",
      });
      
      await writeFile(tasksPath, task + "\n", "utf-8");
      
      const params: TaskExecutorParams = {
        action: "execute",
        workspaceRoot: testDir,
      };
      
      const result = await taskExecutor(params);
      
      assert.ok(result.success);
      assert.ok(result.executed !== undefined);
    });
  });
});
