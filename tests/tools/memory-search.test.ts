/**
 * Tests for memory search tool.
 * TDD: Tests written BEFORE implementation.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { memorySearch } from "../../src/tools/memory-search.ts";
import type { MemorySearchParams } from "../../src/tools/memory-search.ts";

describe("Memory Search Tool", () => {
  
  describe("Basic search", () => {
    it("should execute search with simple query", async () => {
      const params: MemorySearchParams = {
        query: "What is the migration plan?",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      assert.ok(result.results);
      assert.ok(Array.isArray(result.results));
    });

    it("should return results with context snippets", async () => {
      const params: MemorySearchParams = {
        query: "Epstein research",
      };
      
      const result = await memorySearch(params);
      
      if (result.results && result.results.length > 0) {
        const first = result.results[0];
        assert.ok(first.snippet);
        assert.ok(first.source);
        assert.ok(first.relevance !== undefined);
      }
    });

    it("should handle empty results gracefully", async () => {
      const params: MemorySearchParams = {
        query: "xyzabc123nonexistent query",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      assert.equal(result.results?.length || 0, 0);
      assert.ok(result.message);
      assert.match(result.message, /no results|not found/i);
    });
  });

  describe("Person filtering", () => {
    it("should filter by person name", async () => {
      const params: MemorySearchParams = {
        query: "bot governance",
        person: "Steve",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      // Results should mention Steve or be from conversations with Steve
      if (result.results && result.results.length > 0) {
        const hasSteve = result.results.some(r => 
          r.snippet?.toLowerCase().includes("steve") ||
          r.source?.toLowerCase().includes("steve")
        );
        assert.ok(hasSteve, "Results should be related to Steve");
      }
    });

    it("should handle person aliases (Steven/Steve)", async () => {
      const params: MemorySearchParams = {
        query: "philosophy",
        person: "Steven Brown",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
    });
  });

  describe("Date filtering", () => {
    it("should filter by after date", async () => {
      const params: MemorySearchParams = {
        query: "migration",
        after: "2026-02-04",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      // Results should be from Feb 4 onwards
    });

    it("should filter by before date", async () => {
      const params: MemorySearchParams = {
        query: "task orchestration",
        before: "2026-02-05",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
    });

    it("should filter by date range (after + before)", async () => {
      const params: MemorySearchParams = {
        query: "TDD",
        after: "2026-02-03",
        before: "2026-02-05",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
    });

    it("should handle invalid date formats gracefully", async () => {
      const params: MemorySearchParams = {
        query: "test",
        after: "not-a-date",
      };
      
      const result = await memorySearch(params);
      
      // Should either reject or ignore invalid date
      assert.ok(result.success === false || result.results !== undefined);
      if (!result.success) {
        assert.ok(result.error);
        assert.match(result.error, /invalid.*date/i);
      }
    });
  });

  describe("Access level filtering", () => {
    it("should filter by access level (private)", async () => {
      const params: MemorySearchParams = {
        query: "emotional state",
        accessLevel: "private",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      // Results should only be from private memory
      if (result.results && result.results.length > 0) {
        const hasPrivate = result.results.every(r =>
          r.source?.includes("/private/") || r.source?.includes("MEMORY.md")
        );
        assert.ok(hasPrivate, "Results should be from private access level");
      }
    });

    it("should accept all valid access levels", async () => {
      const levels = ["private", "family", "trusted", "public"];
      
      for (const level of levels) {
        const params: MemorySearchParams = {
          query: "test",
          accessLevel: level as any,
        };
        
        const result = await memorySearch(params);
        assert.ok(result.success !== false);
      }
    });

    it("should reject invalid access levels", async () => {
      const params: MemorySearchParams = {
        query: "test",
        accessLevel: "invalid-level" as any,
      };
      
      const result = await memorySearch(params);
      
      assert.equal(result.success, false);
      assert.ok(result.error);
      assert.match(result.error, /invalid.*access.*level/i);
    });
  });

  describe("Result limits", () => {
    it("should default to 5 results", async () => {
      const params: MemorySearchParams = {
        query: "migration",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      if (result.results) {
        assert.ok(result.results.length <= 5);
      }
    });

    it("should respect maxResults parameter", async () => {
      const params: MemorySearchParams = {
        query: "task",
        maxResults: 3,
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      if (result.results) {
        assert.ok(result.results.length <= 3);
      }
    });

    it("should handle maxResults = 0", async () => {
      const params: MemorySearchParams = {
        query: "test",
        maxResults: 0,
      };
      
      const result = await memorySearch(params);
      
      // Should either reject or return empty
      assert.ok(result.success === false || result.results?.length === 0);
    });
  });

  describe("Combined filters", () => {
    it("should apply person + date filters together", async () => {
      const params: MemorySearchParams = {
        query: "research",
        person: "Steve",
        after: "2026-02-01",
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
    });

    it("should apply all filters (person + date + access)", async () => {
      const params: MemorySearchParams = {
        query: "bot",
        person: "Steve",
        after: "2026-02-01",
        accessLevel: "private",
        maxResults: 2,
      };
      
      const result = await memorySearch(params);
      
      assert.ok(result.success);
      if (result.results) {
        assert.ok(result.results.length <= 2);
      }
    });
  });
});
