/**
 * Access Level Bootstrap Hook
 * 
 * Enforces access-level isolation by filtering bootstrap files
 * based on session context. Runs during agent:bootstrap.
 */

import type { HookHandler } from "@openclaw/types";
import { join } from "node:path";

// Access level hierarchy (higher index = more access)
const ACCESS_LEVELS = ["public", "household", "trusted", "family", "private"] as const;
type AccessLevel = (typeof ACCESS_LEVELS)[number];

// Known user mappings (Telegram IDs → access levels)
// This should eventually be in a config file
const USER_ACCESS_MAP: Record<string, AccessLevel> = {
  "192802611": "private",  // Alaina
  // Add other known users here
};

const handler: HookHandler = async (event) => {
  // Only trigger on bootstrap
  if (event.type !== "agent" || event.action !== "bootstrap") {
    return;
  }

  const { context } = event;
  const sessionKey = event.sessionKey || context.sessionKey || "";
  const workspaceDir = context.workspaceDir;
  
  if (!workspaceDir || !context.bootstrapFiles) {
    console.log("[access-level-bootstrap] Missing workspace or bootstrap files, skipping");
    return;
  }

  try {
    // Determine access level from session key
    const accessLevel = deriveAccessLevel(sessionKey);
    console.log(`[access-level-bootstrap] Session ${sessionKey} → access level: ${accessLevel}`);

    // Filter bootstrap files based on access level
    if (accessLevel !== "private") {
      // Remove private-only files
      context.bootstrapFiles = context.bootstrapFiles.filter((file) => {
        const path = typeof file === "string" ? file : file.path;
        
        // Always exclude MEMORY.md for non-private sessions
        if (path.endsWith("MEMORY.md") || path.includes("memory/private/MEMORY.md")) {
          console.log(`[access-level-bootstrap] Excluding: ${path}`);
          return false;
        }
        
        // Exclude files from higher access levels
        if (path.includes("memory/private/") && accessLevel !== "private") {
          console.log(`[access-level-bootstrap] Excluding private file: ${path}`);
          return false;
        }
        if (path.includes("memory/family/") && !canAccess(accessLevel, "family")) {
          console.log(`[access-level-bootstrap] Excluding family file: ${path}`);
          return false;
        }
        
        return true;
      });
    }

    // Add appropriate daily files for this access level
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    const dailyDir = `memory/${accessLevel}`;
    const todayDaily = join(dailyDir, `${today}-daily.md`);
    const yesterdayDaily = join(dailyDir, `${yesterday}-daily.md`);
    
    // Add daily files if not already present
    const existingPaths = context.bootstrapFiles.map((f) => 
      typeof f === "string" ? f : f.path
    );
    
    if (!existingPaths.some((p) => p.includes(todayDaily))) {
      context.bootstrapFiles.push({
        path: join(workspaceDir, todayDaily),
        role: "memory",
      });
    }
    
    if (!existingPaths.some((p) => p.includes(yesterdayDaily))) {
      context.bootstrapFiles.push({
        path: join(workspaceDir, yesterdayDaily),
        role: "memory",
      });
    }
    
    console.log(`[access-level-bootstrap] Bootstrap files adjusted for ${accessLevel} access`);
    
  } catch (err) {
    console.error("[access-level-bootstrap] Error:", err instanceof Error ? err.message : String(err));
    // Don't throw - use default behavior if hook fails
  }
};

/**
 * Derive access level from session key.
 * Format: agent:main:channel:type:id[:extra]
 */
function deriveAccessLevel(sessionKey: string): AccessLevel {
  // Main session = private
  if (sessionKey === "agent:main:main") {
    return "private";
  }
  
  // Parse session key
  const parts = sessionKey.split(":");
  if (parts.length < 4) {
    return "public"; // Unknown format, be conservative
  }
  
  const [, , channel, type, id] = parts;
  
  // Check known users
  if (type === "dm" && id && USER_ACCESS_MAP[id]) {
    return USER_ACCESS_MAP[id];
  }
  
  // Group chats default to trusted (not private)
  if (type === "group") {
    return "trusted";
  }
  
  // DMs from unknown users
  if (type === "dm") {
    return "public";
  }
  
  // Default to public (safest)
  return "public";
}

/**
 * Check if an access level can access content at a target level.
 */
function canAccess(currentLevel: AccessLevel, targetLevel: AccessLevel): boolean {
  const currentIndex = ACCESS_LEVELS.indexOf(currentLevel);
  const targetIndex = ACCESS_LEVELS.indexOf(targetLevel);
  return currentIndex >= targetIndex;
}

export default handler;
