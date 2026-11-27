# Nexus App — Continuation Handoff

This package contains the current Nexus Windows gaming-peripheral utility source as of version **1.5.0**.

## What Nexus currently includes

- Electron 35.7.5 desktop app for Windows 10/11 x64.
- Custom frameless window chrome with drag, minimize, maximize/restore, and close controls.
- Light/dark themes, animated ambient background, click ripples, hover/click sounds, settings, profiles, and saved test history.
- Mouse test based on application pointer events. It is not a raw USB polling or end-to-end latency measurement.
- Keyboard key registration test.
- Controller visualization using the browser Gamepad API.
- Read-only Windows device scanner through PowerShell `Get-PnpDevice -PresentOnly`.
- Tuning page with 300 Hz, 500 Hz, and 1000 Hz target choices. These choices are currently saved as preferences only; they do not change hardware.
- Auto-updater built on `electron-updater` + GitHub Releases (checks at startup and every 4 hours, downloads in the background, "Install and restart" does a silent per-user install and relaunches).
- Per-user NSIS installer configuration in `package.json`.

## Important safety status

The app does **not** universally overclock mice, keyboards, or controllers. The Apply button on the Tuning page is intentionally disabled. Real device tuning must be implemented one supported vendor/model family at a time using documented vendor APIs or protocols. Unknown devices should remain read-only.

Do not claim that the mouse test measures USB polling rate. Do not send arbitrary USB or HID commands to unknown devices.

## Project files

- `main.js` — Electron main process, window setup, updater, and Windows device scan IPC.
- `preload.js` — secure context-isolated bridge.
- `index.html` — app shell, navigation, title bar, dialogs.
- `renderer.js` — page routing, tests, scanner UI, tuning UI, settings, profiles, history.
- `styles.css` — complete Nexus design system and page-specific styling.
- `ui.js` — SVG icon and reusable UI helpers.
- `package.json` / `package-lock.json` — Electron and electron-builder configuration.
- `update.json` — legacy manifest, auto-refreshed by CI, only for installs older than 1.5.0.
- `.github/workflows/release.yml` — builds the installer and publishes the GitHub Release when a `v*` tag is pushed.
- `assets/` — project assets.
- `test-interactions.py` and `interaction-results.json` — existing interaction-test material.

## Run locally

Install Node.js on Windows, open a terminal in the project folder, then run:

```bash
npm ci
npm start
```

The renderer and main-process syntax checks are:

```bash
node --check main.js
node --check renderer.js
```

## Releasing an update

1. Change the code and bump `version` in `package.json` (e.g. 1.5.1).
2. Commit to `main`, then tag and push: `git tag v1.5.1 && git push origin main v1.5.1`.
3. GitHub Actions builds `Nexus-Setup-1.5.1.exe` and publishes the release with `latest.yml` and the blockmap. Installed copies of Nexus update themselves.

The tag must match `package.json` version or the workflow fails on purpose. Local test build: `npm run package:installer` (Windows recommended). Update checks are disabled when running with `npm start`.

Never put GitHub tokens in source files. The workflow uses the built-in `GITHUB_TOKEN`.

## Suggested next development step

Add real tuning support only after selecting a specific supported device and method. Start with one model, document the protocol/API, add detection and capability validation, implement a reversible operation, and keep all unsupported devices read-only. Test disconnects, invalid rates, permission failures, and recovery before enabling any Apply action.
