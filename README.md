# CodeLight

A lightweight, minimalist code editor for macOS.

## Features

- 🎨 **Syntax Highlighting** - 50+ languages supported via Monaco Editor
- 🌙 **Dark & Light Themes** - Sublime-inspired dark theme by default
- 📁 **File Tree** - Easy folder navigation and project management
- 🗂️ **Multiple Tabs** - Work on multiple files simultaneously
- ⌨️ **Keyboard Shortcuts** - Sublime-compatible shortcuts
- 🔍 **Find & Replace** - Quick search with regex support
- 🔎 **Search Across Files** - Project-wide search with ⌘⇧F
- 💻 **Integrated Terminal** - Toggle a real shell with Ctrl+`
- 💨 **Fast Startup** - Launches in under 2 seconds
- 🔒 **Local-First** - Your files stay on your machine

## Installation

### Download

Download the latest `.dmg` from [Releases](https://github.com/HectorHernandez1/CodeLight/releases).

### Build from Source

```bash
# Clone the repository
git clone https://github.com/HectorHernandez1/CodeLight.git
cd codelight

# Install dependencies
npm install

# Run in development mode
npm start

# Build for macOS
npm run build
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New File | ⌘N |
| Open File | ⌘O |
| Open Folder | ⌘⇧O |
| Save | ⌘S |
| Save All | ⌘⇧S |
| Close Tab | ⌘W |
| Find | ⌘F |
| Replace | ⌘H |
| Find in Files | ⌘⇧F |
| Go to Line | ⌃G |
| Quick Open | ⌘P |
| Toggle Sidebar | ⌘B |
| Toggle Terminal | ⌃` |
| Increase Font | ⌘+ |
| Decrease Font | ⌘- |
| Toggle Word Wrap | ⌘⌥W |

## Supported Languages

**Tier 1 (Full Support):** JavaScript, TypeScript, Python, Go, Rust, Java, C#, C/C++, SQL, HTML, CSS, JSON, YAML, Markdown

**Tier 2 (Good Support):** Ruby, PHP, Swift, Kotlin, Scala, R, Shell/Bash, Lua, Perl

Plus 30+ more languages with basic syntax highlighting.

## Requirements

- macOS 10.13 or later

## Development

```bash
# Run with dev tools
npm start

# Run linter
npm run lint

# Run tests
npm test
```

## Tech Stack

- [Electron](https://electronjs.org/) - Cross-platform desktop framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code's editor engine

## Troubleshooting

CodeLight writes a diagnostic log to:

```
~/Library/Application Support/CodeLight/codelight.log
```

It records app startup (version, architecture), every folder open, failed
directory reads (with the OS error), file watcher and terminal failures, and
renderer crashes. If a folder fails to open, the file tree also shows the
error in red instead of staying empty.

View the log with:

```bash
tail -50 ~/Library/Application\ Support/CodeLight/codelight.log
```

If a folder under Desktop, Documents, or Downloads won't open and the log
shows "Operation not permitted", grant access in System Settings → Privacy &
Security → Files and Folders → CodeLight.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

---

Made with ❤️ by Hector
