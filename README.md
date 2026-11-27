# Nexus 1.2 — Peripheral tools

## Windows launch

Download `Nexus-1.2-Windows-Portable.exe` and open it on Windows 10/11 x64. The portable launcher unpacks the included runtime temporarily, so give the first launch a moment. No Python, Node.js, or administrator access is required. The executable is unsigned.

This release uses a custom Nexus title bar: drag the top strip to move the window, double-click it to maximize, and use the matching minimize, maximize, and close buttons. The main workspace also has a themed scrollbar instead of the default browser scrollbar.

## Pages and working controls

- Home: simple starting points for each tool.
- Mouse: timed application pointer-event sampling; real data appears only when the pointer moves in the test area. Stop cancels without saving. Completed tests with at least 20 timing samples save automatically. Loss of focus cancels a test.
- Keyboard: live pressed-key feedback and a recent-key log. Turning off Listen for keys stops capture.
- Controller: live Gamepad API axes, buttons and standard-layout triggers. Connect a controller and press a button. Turning off Live monitoring stops the read loop. Preview dead zone changes only the diagram, not hardware.
- Test history: locally saved mouse tests, JSON export and confirmed deletion.
- Profiles: save/apply/delete app settings. No device parameters are stored or applied.
- Settings: working light/dark mode, animations, master sound switch, individual hover/click sounds and volume. Settings persist locally across launches. Hover sounds require an initial click to unlock audio.

## Measurement limits

The app does NOT overclock devices, scan raw USB devices, apply polling-rate settings, update firmware, edit drivers, or read battery status. It does not contain simulated device metrics.

Mouse results measure the timing of dispatched pointer events received inside this app. These are NOT raw USB polling frequency or end-to-end latency. Display refresh, event coalescing, load, and movement pauses affect the readings. Interval variation is the standard deviation of captured intervals. Results only compare the same test method under similar conditions.

Keyboard feedback checks registration, not physical switch latency or debounce. Windows may intercept shortcuts. Gamepad input only works for controllers exposed through the browser gamepad interface; labels are generic for nonstandard layouts.

## Development

The existing project is Electron; this maintenance release keeps that runtime rather than migrating to Tauri. Native Windows driver integration is not included.

Install Node.js and run `npm ci`, then `npm start`. To produce the single-file Windows x64 build, run `npm run package:portable`. Linux cross-builds require Wine for executable resource editing. The build allowlist excludes previous output archives/executables.
