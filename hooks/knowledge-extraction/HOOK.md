---
name: knowledge-extraction
description: Extracts knowledge from conversations when starting a new session. Saves important facts, decisions, and patterns to memory files.
metadata:
  openclaw:
    emoji: "🧠"
    events: ["command:new"]
    requires:
      config: ["agents.defaults.workspace"]
---

# Knowledge Extraction Hook

Runs when `/new` command is issued. Reviews recent conversation and extracts knowledge to memory files.

## What It Does

1. Reads the pre-reset session transcript (last 50 messages)
2. Extracts significant knowledge:
   - Facts about people
   - Technical decisions
   - Project status updates
   - Preferences discovered
   - Lessons learned
3. Updates appropriate memory files:
   - `MEMORY.md` - Long-term significant memories
   - `memory/private/lessons-learned.md` - Patterns and insights
   - `memory/private/YYYY-MM-DD-daily.md` - Today's events

## Why Hook Instead of Cron?

- **Event-driven**: Triggers exactly when context is about to be lost
- **More relevant**: Processes the conversation that just happened
- **Efficient**: No hourly polling, only runs when needed
- **Better timing**: Extracts BEFORE the session resets

## Configuration

No additional configuration needed. Uses workspace directory from agent config.

## Output

Silently updates memory files. No user-facing output unless significant knowledge was found.
