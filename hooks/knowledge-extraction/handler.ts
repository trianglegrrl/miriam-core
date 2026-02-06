/**
 * Knowledge Extraction Hook
 * 
 * Extracts knowledge from conversations when /new is issued.
 * Runs BEFORE the session resets, so we have access to the conversation.
 */

import type { HookHandler } from "@openclaw/types";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const handler: HookHandler = async (event) => {
  // Only trigger on 'new' command
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  const { context } = event;
  const workspaceDir = context.workspaceDir;
  
  if (!workspaceDir) {
    console.log("[knowledge-extraction] No workspace directory, skipping");
    return;
  }

  try {
    // Read session file if available
    const sessionFile = context.sessionFile;
    if (!sessionFile) {
      console.log("[knowledge-extraction] No session file, skipping");
      return;
    }

    // Read last N lines of session transcript
    const transcript = await readFile(sessionFile, "utf-8").catch(() => "");
    if (!transcript) {
      console.log("[knowledge-extraction] Empty transcript, skipping");
      return;
    }

    // Parse JSONL and get last 50 messages
    const lines = transcript.trim().split("\n").slice(-100);
    const messages = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((m) => m !== null)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-50);

    if (messages.length < 5) {
      console.log("[knowledge-extraction] Not enough messages, skipping");
      return;
    }

    // Build summary of conversation topics
    const topics = extractTopics(messages);
    
    if (topics.length === 0) {
      console.log("[knowledge-extraction] No significant topics found");
      return;
    }

    // Append to daily log
    const today = new Date().toISOString().split("T")[0];
    const dailyFile = join(workspaceDir, "memory", "private", `${today}-daily.md`);
    
    await mkdir(dirname(dailyFile), { recursive: true });
    
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Toronto",
    });
    
    const entry = `\n### ${timestamp} - Session End (Auto-extracted)\n\n${topics.join("\n")}\n`;
    
    await appendFile(dailyFile, entry);
    
    console.log(`[knowledge-extraction] Extracted ${topics.length} topics to ${dailyFile}`);
    
  } catch (err) {
    console.error("[knowledge-extraction] Error:", err instanceof Error ? err.message : String(err));
    // Don't throw - let other handlers run
  }
};

/**
 * Extract significant topics from messages.
 * Simple heuristic-based extraction (could be enhanced with LLM).
 */
function extractTopics(messages: Array<{ role: string; content: string }>): string[] {
  const topics: string[] = [];
  
  // Look for patterns in the conversation
  const fullText = messages.map((m) => m.content || "").join(" ");
  
  // Check for decisions/commitments
  if (fullText.includes("decided to") || fullText.includes("will do") || fullText.includes("committed to")) {
    topics.push("- Decisions/commitments made in this session");
  }
  
  // Check for technical work
  if (fullText.includes("test") && (fullText.includes("passing") || fullText.includes("failed"))) {
    topics.push("- Technical work with test results");
  }
  
  // Check for file modifications
  if (fullText.includes("Created") || fullText.includes("Updated") || fullText.includes("Wrote")) {
    topics.push("- File modifications made");
  }
  
  // Check for research
  if (fullText.includes("research") || fullText.includes("Deep Research") || fullText.includes("Perplexity")) {
    topics.push("- Research conducted");
  }
  
  // Check for emotional/relational content
  if (fullText.includes("thank") || fullText.includes("appreciate") || fullText.includes("buenas noches")) {
    topics.push("- Meaningful exchange");
  }
  
  return topics;
}

export default handler;
