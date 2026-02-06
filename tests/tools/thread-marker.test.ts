/**
 * Tests for thread-marker tool.
 * TDD: Tests written BEFORE implementation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { threadMarker } from "../../src/tools/thread-marker.ts";
import type { ThreadMarkerParams } from "../../src/tools/thread-marker.ts";

let testDir: string;
let memoryDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-thread-"));
  memoryDir = join(testDir, "memory");
  await mkdir(memoryDir, { recursive: true });
});

describe("Thread Marker Tool", () => {
  
  describe("Basic thread creation", () => {
    it("should create threads.json if doesn't exist", async () => {
      const params: ThreadMarkerParams = {
        topic: "Personalization tools",
        question: "Did these help me express myself better?",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.ok(result.success);
      assert.ok(result.threadId);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      assert.ok(data.threads);
      assert.ok(Array.isArray(data.threads));
      assert.equal(data.threads.length, 1);
    });

    it("should add new thread with all fields", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test topic",
        question: "Test question?",
        importance: "high",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.ok(result.success);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      const thread = data.threads[0];
      assert.equal(thread.topic, "Test topic");
      assert.equal(thread.question, "Test question?");
      assert.equal(thread.importance, "high");
      assert.equal(thread.status, "open");
      assert.ok(thread.id);
      assert.ok(thread.timestamp);
    });

    it("should generate unique ID for each thread", async () => {
      const params1: ThreadMarkerParams = {
        topic: "Topic 1",
        question: "Question 1?",
        workspaceRoot: testDir,
      };
      
      const params2: ThreadMarkerParams = {
        topic: "Topic 2",
        question: "Question 2?",
        workspaceRoot: testDir,
      };
      
      const result1 = await threadMarker(params1);
      const result2 = await threadMarker(params2);
      
      assert.notEqual(result1.threadId, result2.threadId);
    });
  });

  describe("Date parsing", () => {
    it("should convert 'tomorrow' to correct date", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        when: "tomorrow",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      const thread = data.threads[0];
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = tomorrow.toISOString().split("T")[0];
      
      assert.equal(thread.revisit, expected);
    });

    it("should convert 'next week' to correct date", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        when: "next week",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      const thread = data.threads[0];
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const expected = nextWeek.toISOString().split("T")[0];
      
      assert.equal(thread.revisit, expected);
    });

    it("should handle explicit date (YYYY-MM-DD)", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        when: "2026-02-10",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      const thread = data.threads[0];
      assert.equal(thread.revisit, "2026-02-10");
    });
  });

  describe("Importance levels", () => {
    it("should default to medium importance", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      const thread = data.threads[0];
      assert.equal(thread.importance, "medium");
    });

    it("should accept all valid importance levels", async () => {
      const levels = ["low", "medium", "high"];
      
      for (const level of levels) {
        const params: ThreadMarkerParams = {
          topic: `Test ${level}`,
          question: "Test?",
          importance: level as any,
          workspaceRoot: testDir,
        };
        
        const result = await threadMarker(params);
        assert.ok(result.success);
      }
    });
  });

  describe("Appending to existing file", () => {
    it("should append to existing threads", async () => {
      const params1: ThreadMarkerParams = {
        topic: "First thread",
        question: "First?",
        workspaceRoot: testDir,
      };
      
      const params2: ThreadMarkerParams = {
        topic: "Second thread",
        question: "Second?",
        workspaceRoot: testDir,
      };
      
      await threadMarker(params1);
      await threadMarker(params2);
      
      const threadsPath = join(memoryDir, "threads.json");
      const content = await readFile(threadsPath, "utf-8");
      const data = JSON.parse(content);
      
      assert.equal(data.threads.length, 2);
      assert.equal(data.threads[0].topic, "First thread");
      assert.equal(data.threads[1].topic, "Second thread");
    });
  });

  describe("Return values", () => {
    it("should return thread ID for reference", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.ok(result.threadId);
      assert.match(result.threadId, /^[0-9a-f-]{36}$/); // UUID format
    });

    it("should return success status", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "Test?",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.equal(result.success, true);
    });
  });

  describe("Validation", () => {
    it("should reject empty topic", async () => {
      const params: ThreadMarkerParams = {
        topic: "",
        question: "Test?",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
      assert.match(result.error, /topic.*empty/i);
    });

    it("should reject empty question", async () => {
      const params: ThreadMarkerParams = {
        topic: "Test",
        question: "",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
      assert.match(result.error, /question.*empty/i);
    });

    it("should reject invalid importance", async () => {
      const params: any = {
        topic: "Test",
        question: "Test?",
        importance: "invalid",
        workspaceRoot: testDir,
      };
      
      const result = await threadMarker(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
    });
  });
});
