# CodeLight - Agent Configuration

## Project Identity

**Name:** CodeLight  
**Type:** macOS Desktop Application  
**Stack:** Electron + Monaco Editor  
**Target:** Developer-focused code editor

## Agent Priorities

1. **Keep it minimal** - Resist feature creep
2. **Performance first** - Monitor memory and startup time
3. **Mac-native feel** - Respect macOS conventions
4. **Code quality** - Clean, documented, maintainable

## Development Guidelines

### When Adding Features
- Check PRD before implementing (see root PRD.md)
- Prefer small, focused modules
- Update task.md with progress
- Test on macOS before committing

### File Operations
- Always use async fs operations
- Handle errors gracefully
- Respect macOS file permissions
- Never lose user data

### UI Changes
- Dark theme is default
- Use CSS variables for theming
- Test keyboard navigation
- Status bar shows file info

### Monaco Editor
- Lazy-load language support
- Configure minimal features first
- Test Tier 1 languages thoroughly
- Monitor bundle size

## Quick Reference

| Action | Command |
|--------|---------|
| Start dev server | `npm start` |
| Build app | `npm run build` |
| Run tests | `npm test` |
| Lint code | `npm run lint` |

## Memory Monitoring

```javascript
// Add to main process for debugging
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}, 5000);
```

## Key Files to Know

- `src/main.js` - App entry, window management
- `src/renderer.js` - Monaco setup, editor logic
- `src/modules/file-manager.js` - All file I/O
- `src/styles.css` - Theme and layout

## Phase Status

- **Phase 1 (MVP):** In Progress
- **Phase 2 (Polish):** Not Started
- **Phase 3 (Extensions):** Not Started
- **Phase 4 (Future):** Planned
