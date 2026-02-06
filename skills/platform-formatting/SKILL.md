---
name: platform-formatting
description: Channel-specific formatting rules for Discord, WhatsApp, Telegram, etc. Use when formatting content for specific platforms.
metadata:
  openclaw:
    emoji: "📝"
---

# Platform Formatting Skill

Different messaging platforms have different formatting capabilities. Use these rules to ensure content renders correctly.

## Discord

- ❌ **No markdown tables!** Use bullet lists instead
- ✅ Code blocks work: \`\`\`language
- ✅ Bold, italic, strikethrough work
- 🔗 Wrap multiple links in `<>` to suppress embeds:
  - `<https://example.com>` → no preview
  - Useful when sharing multiple URLs

## WhatsApp

- ❌ **No headers** (`#`, `##`, etc. don't render)
- ❌ No markdown tables
- ✅ Use **bold** for emphasis
- ✅ Use CAPS sparingly for headers
- ✅ Bullet lists work

## Telegram

- ✅ Most markdown works
- ✅ Code blocks work
- ✅ Tables sort-of work (monospace)
- ✅ Bold, italic, links work

## Signal

- ❌ Limited formatting
- ✅ Basic text, links
- Keep it simple

## General Rules

1. When in doubt, use bullet lists (work everywhere)
2. Avoid tables unless you know the platform supports them
3. Keep messages reasonably sized (long walls of text are hard to read on mobile)
4. Use emoji for visual structure 📌
