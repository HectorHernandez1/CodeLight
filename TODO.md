# TODO

Ordered roadmap — work top to bottom. (Created 2026-07-19; bugs found while using the app slot in above features as they appear.)

## 1. Improve contrast — *quick win, target v1.6.4*

- [ ] Brighten comments (`#5C6370`, 2.32:1) and line numbers (`#495162`, 1.76:1) — both far below the WCAG AA minimum of 4.5:1 against the `#282C34` background. Main text (6.57:1), keywords (5.92:1), and strings (6.94:1) are fine.
- Pure CSS/theme change, no risk. Ship with whatever comes next.

## 2. Universal binary — *deadline: before August 20, 2026 (M-series Mac arrives), target v1.6.4*

- [ ] Build a single universal DMG (one download, works on Intel + Apple Silicon) instead of today's Intel-only `x64` build.
- Config-only change in `electron-builder.yml` (`arch: universal` on the dmg target); cross-building from the Intel laptop is supported. Est. under an hour including a test build.
- Size: DMG grows from ~111MB to roughly ~180MB — still under the 200MB target.
- Must land **before** the integrated terminal (see #5): current deps are pure JS; node-pty is a native module and is much easier to add to an already-working universal pipeline.

## 3. Code signing + notarization — *external dependency: Apple Developer account ($99/yr)*

- [ ] Get an Apple Developer ID, then sign + notarize builds in electron-builder.
- Unblocks the in-app auto-updater (electron-updater refuses to install updates into unsigned apps on macOS) — after this, releases update themselves instead of manual DMG downloads.
- Extra important on Apple Silicon: an un-notarized GitHub download needs System Settings → Privacy & Security → "Open Anyway" on first launch.
- Ordered here so the first release the M-series Mac installs is ideally signed; can proceed in parallel with #1–2 once the account exists.

## 4. Project-wide search

- [ ] Search text across all files in the open folder (Cmd+Shift+F), with results list → click to open at match.
- Today only per-file find/replace exists (Monaco built-ins). Biggest day-to-day feature gap for a code editor.

## 5. Integrated terminal window — *largest feature, deliberately last*

- [ ] Toggleable terminal panel in the editor: xterm.js in the renderer + node-pty in the main process over IPC (keeps the renderer sandboxed).
- Last because: node-pty is a native module that needs dual-arch prebuilds (wants #2 done first) and adds meaningful surface area — best built once the release pipeline (universal + signed) is stable.
