/**
 * Research Tool
 * 
 * Auto-routes between Deep Research and Perplexity based on daily quota.
 * Tracks usage and saves results to structured files.
 * 
 * Key design decisions:
 * - Daily quota resets automatically (count from today's date)
 * - JSONL log format for easy append and parsing
 * - Results saved as both markdown (human) and JSON (machine)
 * - Atomic writes for config safety
 */

import { readJSON, safeReadFile, appendToFile, atomicWrite, fileExists } from "../utils/fs.ts";
import { join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";

// --- Types ---

export interface ResearchConfig {
  daily_deep_research_limit: number;
  perplexity_fallback: boolean;
}

export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  canUseDeepResearch: boolean;
}

export interface RouteDecision {
  provider: "deep-research" | "perplexity";
  reason: string;
}

export interface ResearchResult {
  provider: "deep-research" | "perplexity";
  query: string;
  answer: string;
  citations: string[];
  timestamp: string;
}

export interface RouteOptions {
  forceDeep?: boolean;
  forcePerplexity?: boolean;
}

interface UsageLogEntry {
  date: string;
  timestamp: string;
  provider: string;
  query: string;
}

// --- Constants ---

const DEFAULT_CONFIG: ResearchConfig = {
  daily_deep_research_limit: 15,
  perplexity_fallback: true,
};

// --- Functions ---

/**
 * Check current quota status.
 * Counts Deep Research usage from today only.
 */
export async function checkQuota(
  configFile: string,
  logFile: string
): Promise<QuotaInfo> {
  // Read config (or use defaults)
  const config = await readJSON<ResearchConfig>(configFile) ?? DEFAULT_CONFIG;
  const limit = config.daily_deep_research_limit;

  // Count today's deep-research usage
  const todayStr = new Date().toISOString().split("T")[0];
  const used = await countTodayUsage(logFile, todayStr);

  const remaining = Math.max(0, limit - used);
  const canUseDeepResearch = remaining > 0;

  return { limit, used, remaining, canUseDeepResearch };
}

/**
 * Decide which research provider to use.
 * Returns provider and reason.
 */
export async function routeResearch(
  configFile: string,
  logFile: string,
  options: RouteOptions = {}
): Promise<RouteDecision> {
  const { forceDeep, forcePerplexity } = options;

  // Handle forced routing
  if (forceDeep) {
    return { provider: "deep-research", reason: "forced" };
  }
  if (forcePerplexity) {
    return { provider: "perplexity", reason: "forced" };
  }

  // Check quota
  const quota = await checkQuota(configFile, logFile);
  
  if (quota.canUseDeepResearch) {
    return { provider: "deep-research", reason: "under quota" };
  } else {
    return { provider: "perplexity", reason: "quota exceeded" };
  }
}

/**
 * Log usage to JSONL file.
 * Appends a single line with date, timestamp, provider, and query.
 */
export async function logUsage(
  logFile: string,
  provider: string,
  query: string
): Promise<void> {
  const entry: UsageLogEntry = {
    date: new Date().toISOString().split("T")[0],
    timestamp: new Date().toISOString(),
    provider,
    query,
  };

  const line = JSON.stringify(entry) + "\n";
  await appendToFile(logFile, line);
}

/**
 * Save research result to dated directory.
 * Creates both markdown and JSON files.
 * Returns path to markdown file.
 */
export async function saveResult(
  resultDir: string,
  result: ResearchResult
): Promise<string> {
  // Create dated subdirectory
  const date = result.timestamp.split("T")[0];
  const dateDir = join(resultDir, date);
  await mkdir(dateDir, { recursive: true });

  // Find next counter number
  const counter = await getNextCounter(dateDir);
  const counterStr = String(counter).padStart(3, "0");

  // Generate filename from query (sanitized)
  const slug = result.query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const baseName = `${counterStr}_${slug}`;
  const mdPath = join(dateDir, `${baseName}.md`);
  const jsonPath = join(dateDir, `${baseName}.json`);

  // Write markdown
  const mdContent = formatMarkdown(result);
  await atomicWrite(mdPath, mdContent);

  // Write JSON
  const jsonContent = JSON.stringify(result, null, 2) + "\n";
  await atomicWrite(jsonPath, jsonContent);

  return mdPath;
}

/**
 * Reset daily quota by removing today's entries from log.
 * (Typically not needed - quota resets automatically by date)
 */
export async function resetDailyQuota(logFile: string): Promise<void> {
  if (!(await fileExists(logFile))) {
    return; // Nothing to reset
  }

  const content = await safeReadFile(logFile);
  if (!content) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const lines = content.split("\n").filter(line => line.trim());
  
  // Keep only entries NOT from today
  const filtered = lines.filter(line => {
    try {
      const entry = JSON.parse(line) as UsageLogEntry;
      return entry.date !== todayStr;
    } catch {
      return true; // Keep malformed lines
    }
  });

  const newContent = filtered.join("\n") + (filtered.length > 0 ? "\n" : "");
  await atomicWrite(logFile, newContent);
}

// --- Helper Functions ---

async function countTodayUsage(logFile: string, todayStr: string): Promise<number> {
  const content = await safeReadFile(logFile);
  if (!content) return 0;

  const lines = content.split("\n").filter(line => line.trim());
  let count = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as UsageLogEntry;
      if (entry.date === todayStr && entry.provider === "deep-research") {
        count++;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return count;
}

async function getNextCounter(dir: string): Promise<number> {
  try {
    const files = await readdir(dir);
    const counters = files
      .map(f => {
        const match = f.match(/^(\d{3})_/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    return counters.length > 0 ? Math.max(...counters) + 1 : 1;
  } catch {
    return 1; // Directory doesn't exist or empty
  }
}

function formatMarkdown(result: ResearchResult): string {
  const { provider, query, answer, citations, timestamp } = result;
  
  let md = `# Research Result\n\n`;
  md += `**Query:** ${query}\n\n`;
  md += `**Provider:** ${provider}\n\n`;
  md += `**Timestamp:** ${timestamp}\n\n`;
  md += `---\n\n`;
  md += `## Answer\n\n${answer}\n\n`;

  if (citations && citations.length > 0) {
    md += `## Citations\n\n`;
    citations.forEach((citation, i) => {
      md += `${i + 1}. ${citation}\n`;
    });
    md += `\n`;
  }

  return md;
}
