---
name: voice-tts
description: Text-to-speech for stories, summaries, and engaging audio content. Use for storytelling, movie summaries, and moments where voice is more engaging than text.
metadata:
  openclaw:
    emoji: "🎭"
    requires:
      bins: ["sag"]
---

# Voice/TTS Skill

Generate spoken audio for stories, summaries, and engaging content.

## When to Use

- Long-form storytelling
- Movie/book summaries  
- "Storytime" moments
- Funny character voices
- When audio is more engaging than text walls

## Why Voice?

Way more engaging than walls of text! Use voice to:
- Surprise people with unexpected narration
- Make summaries more digestible
- Add personality through vocal performance
- Create immersive story experiences

## Usage

Use the `tts` tool (built-in) for basic speech:
```
tts("Text to speak")
```

For more control, use sag directly:
```bash
sag "Text to speak" --voice alloy
```

## Best Practices

- Keep segments under 2 minutes
- Use voice for narrative content, text for reference
- Consider your audience (family vs professional)
- Voice works great for bedtime stories for Maya!

## Available Voices

Depends on configured TTS provider (OpenAI or ElevenLabs).
