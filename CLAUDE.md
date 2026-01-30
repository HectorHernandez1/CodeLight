# CodeLight - Claude AI Guidance

## Project Overview

CodeLight is a lightweight, minimalist code editor for macOS built with Electron and Monaco Editor. It provides syntax highlighting across multiple programming languages without paid licensing.

## Core Philosophy

- **Minimal is better** - Only include what developers actually need
- **Performance matters** - Fast startup (<2s), responsive UI
- **Local-first** - Files stay on user's machine, no telemetry
- **No licensing headaches** - Free and open source

## Technology Stack

- **Framework:** Electron
- **Editor Engine:** Monaco Editor
- **Language:** JavaScript/Node.js
- **Build Tool:** electron-builder
- **UI:** Vanilla JavaScript + CSS

## Project Structure

```
codelight/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── renderer.js          # Monaco editor setup
│   ├── styles.css           # Main styling
│   ├── index.html           # Main UI
│   └── modules/
│       ├── file-manager.js  # File operations
│       ├── theme.js         # Theme management
│       ├── storage.js       # Preferences
│       └── shortcuts.js     # Keyboard shortcuts
├── assets/
│   ├── icon.png
│   └── themes/
├── package.json
└── electron-builder.yml
```

## Key Commands

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build for macOS
npm run build
```

## Code Style Guidelines

- Use ES6+ JavaScript features
- Prefer async/await over callbacks
- Keep functions small and focused
- Comment complex logic
- No TypeScript (keep it simple)

## Performance Targets

| Metric | Target |
|--------|--------|
| Startup time | < 2 seconds |
| File open | < 500ms |
| Memory baseline | < 350MB |
| App size | < 200MB |

## Monaco Editor Notes

- Use latest stable version
- Lazy-load language workers
- Configure for minimal footprint
- Tier 1 languages: JS, TS, Python, Go, Rust, Java, C#, C/C++, SQL, HTML, CSS, JSON, YAML, Markdown

## Theme Colors (Dark)

```css
--background: #282C34;
--text: #ABB2BF;
--keywords: #61AFEF;
--strings: #98C379;
--comments: #5C6370;
--line-numbers: #495162;
--selection: #3E4451;
```
