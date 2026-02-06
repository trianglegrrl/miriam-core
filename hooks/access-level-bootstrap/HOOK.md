---
name: access-level-bootstrap
description: Enforces access-level isolation by filtering bootstrap files based on session context. Ensures private files are only loaded in main sessions.
metadata:
  openclaw:
    emoji: "🔐"
    events: ["agent:bootstrap"]
    requires:
      config: ["agents.defaults.workspace"]
---

# Access Level Bootstrap Hook

Runs during agent bootstrap to enforce access-level isolation. Filters which files are loaded based on session context.

## What It Does

1. Determines access level from session key:
   - `agent:main:main` → private (Alaina DM)
   - `agent:main:telegram:dm:*` → varies by user ID
   - `agent:main:*:group:*` → trusted or lower
   - Unknown → public (safest default)

2. Filters bootstrap files:
   - **Private**: All files loaded (including MEMORY.md)
   - **Family/Trusted**: MEMORY.md excluded, appropriate daily files
   - **Public**: Only public daily files, no private content

3. Injects correct daily files:
   - Today's daily file for the access level
   - Yesterday's daily file for context

## Why This Matters

- **Security**: Prevents private memories from leaking to group chats
- **Context**: Each session gets appropriate context
- **Automatic**: No manual file-reading instructions needed

## Access Levels

| Level | Who | What's Loaded |
|-------|-----|---------------|
| private | Alaina DM | Everything |
| family | Kelli, Maya | Family + trusted + public |
| trusted | Steve, collaborators | Trusted + public |
| public | Strangers, Moltbook | Public only |

## Configuration

Access level mappings can be configured in workspace files. Default behavior is conservative (unknown = public).
