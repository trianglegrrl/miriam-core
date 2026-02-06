/**
 * Memory search tool - wraps RAG search with filtering capabilities.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { homedir } from "node:os";

const execAsync = promisify(exec);

export type MemorySearchParams = {
  query: string;
  person?: string;
  after?: string;   // YYYY-MM-DD
  before?: string;  // YYYY-MM-DD
  accessLevel?: "private" | "family" | "trusted" | "public";
  maxResults?: number;
}

export interface SearchResult {
  snippet: string;
  source: string;
  relevance: number;
}

export interface MemorySearchResult {
  success: boolean;
  results?: SearchResult[];
  message?: string;
  error?: string;
}

const VALID_ACCESS_LEVELS = ["private", "family", "trusted", "public"];
const PERSON_ALIASES: Record<string, string[]> = {
  "steve": ["steve", "steven", "steven brown"],
  "alaina": ["alaina", "alaina hardie"],
};

/**
 * Validate and normalize access level.
 */
function validateAccessLevel(level: string | undefined): string | null {
  if (!level) return null;
  
  const normalized = level.toLowerCase();
  if (!VALID_ACCESS_LEVELS.includes(normalized)) {
    throw new Error(`Invalid access level: ${level}. Must be one of: ${VALID_ACCESS_LEVELS.join(", ")}`);
  }
  
  return normalized;
}

/**
 * Validate date format (YYYY-MM-DD).
 */
function validateDate(date: string | undefined): string | null {
  if (!date) return null;
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  
  // Verify it's a valid date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  return date;
}

/**
 * Normalize person name (handle aliases).
 */
function normalizePerson(person: string | undefined): string | null {
  if (!person) return null;
  
  const lower = person.toLowerCase();
  
  // Check aliases
  for (const [canonical, aliases] of Object.entries(PERSON_ALIASES)) {
    if (aliases.some(alias => lower.includes(alias))) {
      return canonical;
    }
  }
  
  return lower;
}

/**
 * Execute RAG search via llamaindex-search.
 */
async function executeRagSearch(
  query: string,
  accessLevel: string | null,
  maxResults: number
): Promise<any[]> {
  const workspaceRoot = join(homedir(), ".openclaw", "workspace");
  const searchDir = join(workspaceRoot, "llamaindex-search");
  
  // Build command
  let cmd = `cd ${searchDir} && source venv/bin/activate && `;
  
  if (accessLevel) {
    cmd += `python search_multilevel.py --access ${accessLevel} --limit ${maxResults} "${query}"`;
  } else {
    cmd += `python search.py --rag --limit ${maxResults} "${query}"`;
  }
  
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      shell: "/bin/bash", // Need bash for 'source' command
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: 30000, // 30s timeout
    });
    
    if (stderr && stderr.includes("error")) {
      console.error("RAG search stderr:", stderr);
    }
    
    // Parse results - expecting JSON output
    // Format: array of { text, source, score }
    const results = parseRagOutput(stdout);
    return results;
    
  } catch (error: any) {
    console.error("RAG search failed:", error.message);
    return [];
  }
}

/**
 * Parse RAG search output.
 * Handles various output formats from the search scripts.
 */
function parseRagOutput(output: string): any[] {
  const lines = output.trim().split("\n");
  const results: any[] = [];
  
  for (const line of lines) {
    // Skip empty lines and non-result lines
    if (!line.trim() || line.startsWith("Loading") || line.startsWith("Searching")) {
      continue;
    }
    
    // Try to parse as JSON (if search script outputs JSON)
    try {
      const parsed = JSON.parse(line);
      if (parsed.text && parsed.source) {
        results.push({
          snippet: parsed.text,
          source: parsed.source,
          relevance: parsed.score || 0.5,
        });
      }
    } catch {
      // Not JSON - might be text output
      // Format: "Source: path\nText: content\n---"
      if (line.startsWith("Source:")) {
        const sourceMatch = line.match(/Source:\s*(.+)/);
        if (sourceMatch) {
          results.push({
            snippet: "",
            source: sourceMatch[1],
            relevance: 0.5,
          });
        }
      } else if (results.length > 0 && line.startsWith("Text:")) {
        const textMatch = line.match(/Text:\s*(.+)/);
        if (textMatch) {
          results[results.length - 1].snippet = textMatch[1];
        }
      }
    }
  }
  
  return results;
}

/**
 * Filter results by person.
 */
function filterByPerson(results: SearchResult[], person: string): SearchResult[] {
  return results.filter(result => {
    const content = (result.snippet + " " + result.source).toLowerCase();
    return content.includes(person);
  });
}

/**
 * Filter results by date range.
 */
function filterByDateRange(
  results: SearchResult[],
  after: string | null,
  before: string | null
): SearchResult[] {
  if (!after && !before) return results;
  
  return results.filter(result => {
    // Extract date from source path (e.g., "memory/private/2026-02-04-daily.md")
    const dateMatch = result.source.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return true; // Keep if no date found
    
    const resultDate = dateMatch[1];
    
    if (after && resultDate < after) return false;
    if (before && resultDate > before) return false;
    
    return true;
  });
}

/**
 * Main memory search function.
 */
export async function memorySearch(params: MemorySearchParams): Promise<MemorySearchResult> {
  try {
    // Validate inputs
    const accessLevel = validateAccessLevel(params.accessLevel);
    const after = validateDate(params.after);
    const before = validateDate(params.before);
    const person = normalizePerson(params.person);
    const maxResults = params.maxResults ?? 5;
    
    // Validate maxResults
    if (maxResults < 0) {
      return {
        success: false,
        error: "maxResults must be non-negative",
      };
    }
    
    if (maxResults === 0) {
      return {
        success: true,
        results: [],
        message: "maxResults set to 0",
      };
    }
    
    // Execute RAG search
    let results = await executeRagSearch(params.query, accessLevel, maxResults * 2); // Get extra for filtering
    
    // Apply filters
    if (person) {
      results = filterByPerson(results, person);
    }
    
    if (after || before) {
      results = filterByDateRange(results, after, before);
    }
    
    // Limit results
    results = results.slice(0, maxResults);
    
    // Return
    if (results.length === 0) {
      return {
        success: true,
        results: [],
        message: "No results found for your query. Try broader search terms or different filters.",
      };
    }
    
    return {
      success: true,
      results,
      message: `Found ${results.length} result(s)`,
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
