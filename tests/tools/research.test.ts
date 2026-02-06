/**
 * Tests for research tool.
 * TDD: These tests are written BEFORE the implementation.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  checkQuota,
  routeResearch,
  saveResult,
  logUsage,
  resetDailyQuota,
} from "../../src/tools/research.ts";
import type { ResearchConfig, ResearchResult } from "../../src/tools/research.ts";

let testDir: string;
let configFile: string;
let logFile: string;
let resultDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "miriam-research-"));
  configFile = join(testDir, "research-config.json");
  logFile = join(testDir, "research-usage.jsonl");
  resultDir = join(testDir, "research-results");
  await mkdir(resultDir, { recursive: true });
});

after(async () => {
  // Cleanup happens per-test via temp dirs
});

describe("Research Tool", () => {

  describe("checkQuota", () => {
    it("should return available quota when under limit", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 15,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));
      await writeFile(logFile, ""); // Empty log

      const quota = await checkQuota(configFile, logFile);
      assert.equal(quota.limit, 15);
      assert.equal(quota.used, 0);
      assert.equal(quota.remaining, 15);
      assert.equal(quota.canUseDeepResearch, true);
    });

    it("should count usage from today only", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 15,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));

      // Log from yesterday and today
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];

      const log = [
        JSON.stringify({ date: yesterdayStr, provider: "deep-research", query: "old" }),
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "query1" }),
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "query2" }),
        JSON.stringify({ date: todayStr, provider: "perplexity", query: "query3" }), // doesn't count
      ].join("\n");
      await writeFile(logFile, log);

      const quota = await checkQuota(configFile, logFile);
      assert.equal(quota.used, 2); // Only today's deep-research
      assert.equal(quota.remaining, 13);
    });

    it("should return false for canUseDeepResearch when at limit", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 2,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));

      const todayStr = new Date().toISOString().split("T")[0];
      const log = [
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "q1" }),
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "q2" }),
      ].join("\n");
      await writeFile(logFile, log);

      const quota = await checkQuota(configFile, logFile);
      assert.equal(quota.used, 2);
      assert.equal(quota.remaining, 0);
      assert.equal(quota.canUseDeepResearch, false);
    });

    it("should handle missing log file", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 15,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));
      // Don't create log file

      const quota = await checkQuota(configFile, logFile);
      assert.equal(quota.used, 0);
      assert.equal(quota.remaining, 15);
    });

    it("should handle missing config file with defaults", async () => {
      // Don't create config file
      await writeFile(logFile, "");

      const quota = await checkQuota(configFile, logFile);
      assert.equal(quota.limit, 15); // default
      assert.equal(quota.used, 0);
    });
  });

  describe("routeResearch", () => {
    it("should route to deep-research when under quota", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 15,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));
      await writeFile(logFile, "");

      const route = await routeResearch(configFile, logFile);
      assert.equal(route.provider, "deep-research");
      assert.equal(route.reason, "under quota");
    });

    it("should route to perplexity when at quota", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 1,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));

      const todayStr = new Date().toISOString().split("T")[0];
      const log = JSON.stringify({ date: todayStr, provider: "deep-research", query: "q1" });
      await writeFile(logFile, log);

      const route = await routeResearch(configFile, logFile);
      assert.equal(route.provider, "perplexity");
      assert.equal(route.reason, "quota exceeded");
    });

    it("should force deep-research when explicitly requested", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 1,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));

      const todayStr = new Date().toISOString().split("T")[0];
      const log = JSON.stringify({ date: todayStr, provider: "deep-research", query: "q1" });
      await writeFile(logFile, log);

      const route = await routeResearch(configFile, logFile, { forceDeep: true });
      assert.equal(route.provider, "deep-research");
      assert.equal(route.reason, "forced");
    });

    it("should force perplexity when explicitly requested", async () => {
      const config: ResearchConfig = {
        daily_deep_research_limit: 15,
        perplexity_fallback: true,
      };
      await writeFile(configFile, JSON.stringify(config));
      await writeFile(logFile, "");

      const route = await routeResearch(configFile, logFile, { forcePerplexity: true });
      assert.equal(route.provider, "perplexity");
      assert.equal(route.reason, "forced");
    });
  });

  describe("logUsage", () => {
    it("should append usage to log file in JSONL format", async () => {
      await logUsage(logFile, "deep-research", "test query");

      const content = await readFile(logFile, "utf-8");
      const lines = content.trim().split("\n");
      assert.equal(lines.length, 1);

      const entry = JSON.parse(lines[0]);
      assert.equal(entry.provider, "deep-research");
      assert.equal(entry.query, "test query");
      assert.ok(entry.date);
      assert.ok(entry.timestamp);
    });

    it("should append to existing log", async () => {
      await logUsage(logFile, "perplexity", "query1");
      await logUsage(logFile, "deep-research", "query2");

      const content = await readFile(logFile, "utf-8");
      const lines = content.trim().split("\n");
      assert.equal(lines.length, 2);
      
      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);
      assert.equal(entry1.query, "query1");
      assert.equal(entry2.query, "query2");
    });

    it("should create log file if it doesn't exist", async () => {
      // Don't create log file first
      await logUsage(logFile, "deep-research", "new log");

      const content = await readFile(logFile, "utf-8");
      const entry = JSON.parse(content.trim());
      assert.equal(entry.query, "new log");
    });
  });

  describe("saveResult", () => {
    it("should save research result as markdown and JSON", async () => {
      const result: ResearchResult = {
        provider: "deep-research",
        query: "test query",
        answer: "This is the answer",
        citations: ["https://example.com"],
        timestamp: new Date().toISOString(),
      };

      const savedPath = await saveResult(resultDir, result);

      // Check markdown file
      assert.ok(savedPath.endsWith(".md"));
      const mdContent = await readFile(savedPath, "utf-8");
      assert.ok(mdContent.includes("# Research Result"));
      assert.ok(mdContent.includes("test query"));
      assert.ok(mdContent.includes("This is the answer"));
      assert.ok(mdContent.includes("https://example.com"));

      // Check JSON file
      const jsonPath = savedPath.replace(".md", ".json");
      const jsonContent = await readFile(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent);
      assert.equal(parsed.query, "test query");
      assert.equal(parsed.provider, "deep-research");
    });

    it("should create dated subdirectory", async () => {
      const result: ResearchResult = {
        provider: "perplexity",
        query: "test",
        answer: "answer",
        citations: [],
        timestamp: new Date().toISOString(),
      };

      const savedPath = await saveResult(resultDir, result);
      const today = new Date().toISOString().split("T")[0];
      assert.ok(savedPath.includes(today));
    });

    it("should handle results without citations", async () => {
      const result: ResearchResult = {
        provider: "perplexity",
        query: "no citations",
        answer: "just an answer",
        citations: [],
        timestamp: new Date().toISOString(),
      };

      const savedPath = await saveResult(resultDir, result);
      const mdContent = await readFile(savedPath, "utf-8");
      assert.ok(mdContent.includes("just an answer"));
      assert.ok(!mdContent.includes("## Citations") || mdContent.includes("No citations"));
    });

    it("should increment counter for multiple results in same day", async () => {
      const result1: ResearchResult = {
        provider: "deep-research",
        query: "query1",
        answer: "answer1",
        citations: [],
        timestamp: new Date().toISOString(),
      };
      const result2: ResearchResult = {
        provider: "deep-research",
        query: "query2",
        answer: "answer2",
        citations: [],
        timestamp: new Date().toISOString(),
      };

      const path1 = await saveResult(resultDir, result1);
      const path2 = await saveResult(resultDir, result2);

      assert.ok(path1.includes("001_"));
      assert.ok(path2.includes("002_"));
    });
  });

  describe("resetDailyQuota", () => {
    it("should clear today's entries from log", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];

      const log = [
        JSON.stringify({ date: yesterdayStr, provider: "deep-research", query: "old1" }),
        JSON.stringify({ date: yesterdayStr, provider: "deep-research", query: "old2" }),
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "today1" }),
        JSON.stringify({ date: todayStr, provider: "deep-research", query: "today2" }),
      ].join("\n");
      await writeFile(logFile, log);

      await resetDailyQuota(logFile);

      const content = await readFile(logFile, "utf-8");
      const lines = content.trim().split("\n").filter(l => l);
      assert.equal(lines.length, 2); // Only yesterday's entries remain
      
      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);
      assert.equal(entry1.query, "old1");
      assert.equal(entry2.query, "old2");
    });

    it("should handle empty log file", async () => {
      await writeFile(logFile, "");
      await resetDailyQuota(logFile);
      
      const content = await readFile(logFile, "utf-8");
      assert.equal(content, "");
    });

    it("should handle missing log file", async () => {
      // Don't create log file
      await resetDailyQuota(logFile);
      // Should not throw
    });
  });
});
