# @miriam/core

## Installation

### NPM
```bash
npm install @miriam/core
```

### GitHub Packages
```bash
npm install @trianglegrrl/miriam-core
```

## Usage

```javascript
import { researchTool, voiceTTS } from '@miriam/core';

// Example: Perform web research
const results = await researchTool.perplexitySearch("Your research query");
```

## Requirements
- OpenClaw 2026.2+
- Node.js 20+
- Configured API keys for external services

## Features
- Web Research
- Voice TTS
- Platform Formatting
- Machine Access Hooks

## Configuration
Requires OpenClaw configuration and API key setup.

## Development
```bash
npm test  # Run test suite
npm test:watch  # Watch mode
```