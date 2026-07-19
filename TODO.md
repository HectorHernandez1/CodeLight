# TODO

## 2026-07-19

- [ ] **Improve contrast** — comments (`#5C6370`, 2.32:1) and line numbers (`#495162`, 1.76:1) fall well below the WCAG AA minimum of 4.5:1 against the `#282C34` background. Main text (6.57:1), keywords (5.92:1), and strings (6.94:1) are fine.
- [ ] **Integrated terminal window** — a toggleable terminal panel in the editor (xterm.js in the renderer + node-pty in the main process over IPC, so the renderer stays sandboxed).

### Proposed improvements (suggested by Claude, 2026-07-19)

- [ ] **Code signing + notarization** — get an Apple Developer ID and sign/notarize builds. This is what blocks the in-app auto-updater from installing updates today, and removes Gatekeeper warnings for new users.
- [ ] **Project-wide search** — search text across all files in the open folder (Cmd+Shift+F). Today only per-file find/replace exists via Monaco.
- [ ] **Universal binary** — builds are currently Intel-only (`x64`); Apple Silicon users run CodeLight under Rosetta. Build `universal` (or dual-arch) DMGs with electron-builder.
  - **Deadline: before August 20, 2026** (Hector's M-series Mac arrives then). Decided 2026-07-19 to hold for the next release rather than ship alone.
  - Plan: single universal DMG (one download, works on both chips) rather than separate x64/arm64 DMGs. Config-only change in `electron-builder.yml` (`arch: universal` on the dmg target); cross-building from the Intel laptop is supported, no new hardware needed. Est. under an hour including a test build.
  - Size note: universal DMG grows from ~111MB to roughly ~180MB — still under the 200MB target.
  - Ordering: do this **before** the integrated terminal — `node-pty` is a native module, and it's easier to add dual-arch prebuilds to an already-working universal pipeline. Current deps (electron-updater, monaco-editor) are pure JS, so nothing blocks it today.
  - Raises urgency of **code signing + notarization**: Apple Silicon is stricter — electron-builder ad-hoc signs so the app runs, but an un-notarized GitHub download needs System Settings → Privacy & Security → "Open Anyway" on first launch.
