(() => {
  'use strict';
  const { icon, escape, heading, toggle, notice, empty } = window.UI;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const defaults = { sound: true, hoverSound: true, clickSound: true, volume: 20, animations: true, dark: false };
  const storageKey = 'nexus-tools-v11';
  const lastSeenVersionKey = 'nexus-last-seen-version';
  const builtInChangelog = {
    '1.5.3': ['Added a What’s new window after updates.', 'Added a toolbar shortcut so release notes can be opened anytime.', 'Improved update messaging with a clear version and change summary.'],
    '1.5.2': ['Introduced the new geometric Nexus logo in the sidebar and title bar.', 'Added a modern gradient emblem with light and dark theme support.'],
    '1.5.1': ['Improved the Windows installer update flow.', 'Fixed update packaging so the installer and update metadata are delivered together.'],
    '1.5.0': ['Added the Electron updater with silent install and restart.', 'Added read-only device scanning and safe tuning target choices.']
  };
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { /* Use defaults for invalid data. */ }
  const state = {
    page: 'home',
    settings: { ...defaults, ...(stored.settings || {}) },
    history: Array.isArray(stored.history) ? stored.history : [],
    profiles: Array.isArray(stored.profiles) ? stored.profiles : [],
    duration: [5, 10, 20].includes(stored.duration) ? stored.duration : 10,
    deadzone: Number.isFinite(stored.deadzone) ? stored.deadzone : 10,
    tuningRate: [300, 500, 1000].includes(stored.tuningRate) ? stored.tuningRate : 500,
    tuningDevice: stored.tuningDevice || ''
  };
  function renderUpdateDialog() {
    const dialog = $('#update-dialog');
    if (!dialog) return;
    const s = updateState || { status: 'idle' };
    const title = $('#update-title'), message = $('#update-message');
    const bar = $('#update-progress'), barFill = bar?.firstElementChild, button = $('#restart-app');
    $('#update-version').textContent = appVersion;
    bar.hidden = true;
    button.hidden = true;
    button.disabled = false;
    button.textContent = 'Install and restart';
    if (s.status === 'checking') { title.textContent = 'Checking for updates…'; message.textContent = 'Connecting to the Nexus update feed.'; }
    else if (s.status === 'downloading') {
      title.textContent = `Downloading Nexus ${s.version || ''}…`.replace(' …', '…');
      message.textContent = `${s.percent || 0}% downloaded. You can keep using Nexus.`;
      bar.hidden = false; barFill.style.width = `${s.percent || 0}%`;
    }
    else if (s.status === 'ready') {
      title.textContent = `Nexus ${s.version} is ready`;
      message.textContent = s.notes || 'The update has been downloaded. Restart Nexus to finish installing it.';
      button.hidden = false;
    }
    else if (s.status === 'none') { title.textContent = 'You’re up to date'; message.textContent = 'Nexus is running the latest version.'; }
    else if (s.status === 'dev') { title.textContent = 'Updates run in the installed app'; message.textContent = 'This is a development build, so update checks are turned off.'; }
    else if (s.status === 'error') { title.textContent = 'Update check unavailable'; message.textContent = 'The update feed could not be reached. You can try again later.'; }
    else { title.textContent = 'Check for updates'; message.textContent = 'Nexus will check the official update feed.'; }
    const toolbarButton = $('#update-button');
    if (toolbarButton) {
      toolbarButton.classList.toggle('has-update', s.status === 'ready');
      const label = toolbarButton.querySelector('span:last-child');
      if (label) label.textContent = s.status === 'ready' ? 'Update ready' : s.status === 'downloading' ? 'Downloading update…' : 'Check for updates';
    }
  }
  window.aurora?.onUpdateState?.(state => { updateState = state; renderUpdateDialog(); });
  window.aurora?.getUpdateState?.().then(state => { if (state) { updateState = state; renderUpdateDialog(); } }).catch(() => {});
  const pageTitles = { home: 'Home', mouse: 'Mouse', keyboard: 'Keyboard', controller: 'Controller', devices: 'Devices', tuning: 'Tuning', history: 'Test history', profiles: 'Profiles', settings: 'Settings' };
  let appVersion = '1.5.3';
  let updateState = { status: 'idle' };
  function changelogEntries(version = appVersion, notes = '') {
    const external = String(notes || '').split(/\n+/).map(item => item.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    return external.length ? external : (builtInChangelog[version] || ['Bug fixes and small improvements for a smoother Nexus experience.']);
  }
  function showChangelog(version = appVersion, notes = '') {
    const dialog = $('#changelog-dialog');
    if (!dialog) return;
    $('#changelog-title').textContent = `What’s new in Nexus ${version}`;
    $('#changelog-intro').textContent = version === appVersion ? 'Here are the latest changes in this version.' : `Changes included in Nexus ${version}.`;
    $('#changelog-list').innerHTML = changelogEntries(version, notes).map(item => `<div class="changelog-item"><span class="changelog-check">${icon('check')}</span><span>${escape(item)}</span></div>`).join('');
    if (!dialog.open) dialog.showModal();
  }
  function markVersionSeen(version) {
    try { localStorage.setItem(lastSeenVersionKey, version); } catch (_) { /* Optional convenience only. */ }
  }
  window.aurora?.version?.().then(v => {
    if (!v) return;
    appVersion = v;
    const previous = localStorage.getItem(lastSeenVersionKey);
    const versionLabel = $('.sidebar-version');
    if (versionLabel) versionLabel.innerHTML = `Nexus ${escape(appVersion)} <span>·</span> Windows`;
    $('#update-version').textContent = appVersion;
    if (previous && previous !== appVersion) showChangelog(appVersion);
    markVersionSeen(appVersion);
  }).catch(() => {});
  let audioContext;
  let toastTimer;
  let mouseTimer;
  let mouseStart = 0;
  let mouseLast = null;
  let mouseIntervals = [];
  let mouseRunning = false;
  let mouseResult = null;
  let keyboardEnabled = true;
  let keyCount = 0;
  let keyLog = [];
  const pressedKeys = new Set();
  let controllerEnabled = true;
  let controllerFrame;
  let controllerId = '';
  let selectedController = null;
  let scannedDevices = [];
  let deviceScanMessage = '';
  let deviceScanBusy = false;
  let hasScannedDevices = false;

  function save() {
    try {
      const { settings, history, profiles, duration, deadzone, tuningRate, tuningDevice } = state;
      localStorage.setItem(storageKey, JSON.stringify({ settings, history, profiles, duration, deadzone, tuningRate, tuningDevice }));
      return true;
    } catch (_) {
      toast('Changes could not be saved. Local storage is unavailable.');
      return false;
    }
  }

  function applyAppearance() {
    document.body.classList.toggle('dark', Boolean(state.settings.dark));
    document.body.classList.toggle('no-motion', !state.settings.animations);
  }

  function fillIcons() {
    $$('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  }

  function toast(message) {
    $('#toast-message').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3300);
  }

  function ripple(event) {
    const target = event.target.closest('button');
    if (!target || target.disabled || target.classList.contains('window-control')) return;
    const rect = target.getBoundingClientRect();
    const ring = document.createElement('i');
    ring.className = 'click-ripple';
    ring.style.left = `${event.clientX - rect.left}px`;
    ring.style.top = `${event.clientY - rect.top}px`;
    target.appendChild(ring);
    setTimeout(() => ring.remove(), 480);
  }

  function sound(type = 'click') {
    const settings = state.settings;
    if (!settings.sound || Number(settings.volume) <= 0) return;
    if (type === 'hover' && !settings.hoverSound) return;
    if (type === 'click' && !settings.clickSound) return;
    if (type === 'hover' && (!audioContext || audioContext.state !== 'running')) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime;
      const length = type === 'hover' ? 0.035 : 0.08;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'hover' ? 520 : 420, start);
      oscillator.frequency.exponentialRampToValueAtTime(type === 'hover' ? 590 : 570, start + length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.volume / 100 * 0.07), start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + length + 0.01);
    } catch (_) { /* Audio must never interrupt a device test. */ }
  }

  function navigate(page) {
    if (!(page in pageTitles)) return;
    if (mouseRunning) stopMouse(false);
    cancelAnimationFrame(controllerFrame);
    pressedKeys.clear();
    state.page = page;
    $$('.nav-button').forEach(button => {
      const selected = button.dataset.page === page;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('#breadcrumb').textContent = pageTitles[page];
    render();
    $('#page').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.querySelector('.workspace')?.scrollTo(0, 0);
  }

  function homePage() {
    return heading('Your devices, made simple.', 'A few useful tools to check how your gaming gear responds.') +
      `<section class="welcome"><div><h2>Start with a quick check</h2><p>Move your mouse, try your keyboard, or check your controller. No setup, driver tweaks, or administrator access needed.</p><button class="button" data-page="mouse">Test my mouse <span class="nav-icon">${icon('arrow')}</span></button></div><div class="welcome-symbol"><span class="nav-icon">${icon('mouse')}</span></div></section>
      <div class="section-heading"><h2>Choose a tool</h2><span>Three simple ways to get started</span></div>
      <section class="tool-grid">
        <article class="card tool-card"><div class="tool-icon">${icon('mouse')}</div><h3>Mouse test</h3><p>Check the timing of pointer events while you move your mouse.</p><button class="button secondary" data-page="mouse">Open mouse test <span class="nav-icon">${icon('arrow')}</span></button></article>
        <article class="card tool-card"><div class="tool-icon sky">${icon('keyboard')}</div><h3>Keyboard test</h3><p>See which keys are pressed and check that they register correctly.</p><button class="button secondary" data-page="keyboard">Open keyboard test <span class="nav-icon">${icon('arrow')}</span></button></article>
        <article class="card tool-card"><div class="tool-icon teal">${icon('controller')}</div><h3>Controller test</h3><p>Watch your sticks, triggers, and buttons respond in real time.</p><button class="button secondary" data-page="controller">Open controller test <span class="nav-icon">${icon('arrow')}</span></button></article>
      </section>
      <div class="section-heading"><h2>Good to know</h2></div>
      ${notice('This version is a testing tool, not an overclocking driver. It does not detect USB model details, change polling settings, or modify firmware. There are no simulated results or made-up connected devices.')}
      <section class="split equal"><article class="card"><h3>Your test history</h3><p class="small-copy">${state.history.length ? `${state.history.length} saved mouse test${state.history.length === 1 ? '' : 's'} ready to review.` : 'Your completed mouse tests will appear here.'}</p><button class="button link" style="margin-top:17px" data-page="history">View history ${iconButtonArrow()}</button></article><article class="card"><h3>Make it feel like yours</h3><p class="small-copy">Change the theme, turn sounds off, or keep animations subtle.</p><button class="button link" style="margin-top:17px" data-page="settings">Open settings ${iconButtonArrow()}</button></article></section>`;
  }

  function iconButtonArrow() { return `<span class="nav-icon">${icon('arrow')}</span>`; }

  function mousePage() {
    return heading('Mouse test', 'Check pointer-event timing while you move your mouse.') +
      notice('These are application-level pointer events, not raw USB polling or end-to-end latency. Display refresh rate, event batching, system load, and pauses affect the result. This tool cannot verify 1,000–8,000 Hz hardware polling.') +
      `<section class="split"><article class="card"><h2>Run a quick test</h2><p class="small-copy">Choose a duration, then move in circles inside the test area.</p><label class="form-label" for="test-duration">Test duration</label><div class="row"><select id="test-duration">${[5, 10, 20].map(value => `<option value="${value}" ${state.duration === value ? 'selected' : ''}>${value} seconds</option>`).join('')}</select><button class="button" id="start-mouse">Start test</button><button class="button secondary" id="stop-mouse" disabled>Stop</button></div><div id="mouse-area" class="test-area"><span class="nav-icon">${icon('mouse')}</span><strong id="mouse-instruction">Your test starts here</strong><small id="mouse-status">Click Start test, then keep your mouse moving in this area.</small></div><div class="progress-track"><div id="mouse-progress" class="progress-fill"></div></div><div class="field-hint" id="mouse-time">Ready when you are</div></article>
      <article class="card"><div class="row space-between"><h2>Results</h2><span class="badge neutral" id="mouse-result-label">No test yet</span></div><p class="small-copy" style="margin-bottom:20px">Numbers only appear after real movement.</p><div class="metrics"><div class="metric"><small>Observed event rate</small><b id="event-rate">—</b></div><div class="metric"><small>Average interval</small><b id="event-interval">—</b></div><div class="metric"><small>Interval variation</small><b id="event-variation">—</b></div><div class="metric"><small>Timing samples</small><b id="event-samples">0</b></div></div><ul class="helper-list"><li>Keep moving for the whole test.</li><li>Pauses lower the observed event rate.</li><li>Use the same movement for comparisons.</li><li>Variation is timing spread, not input latency.</li></ul></article></section>`;
  }

  const keyCodes = ['Escape', ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`), ...'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map(value => `Key${value}`), 'ShiftLeft', 'ControlLeft', 'AltLeft', 'Space', 'Enter', 'Backspace', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
  function keyLabel(code) {
    const names = { Escape: 'Esc', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Space: 'Space', Enter: 'Enter', Backspace: '⌫', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', ArrowRight: '→' };
    return names[code] || code.replace(/^Key|^Digit/, '');
  }

  function keyboardPage() {
    return heading('Keyboard test', 'Press a few keys and check what this app receives.', `<button class="button secondary" id="clear-keys">Clear test</button>`) +
      notice('This checks key registration inside the app. It does not measure switch latency or change debounce settings. Windows may intercept shortcuts before they reach this window.') +
      `<section class="split"><article class="card"><h2>Live key feedback</h2>${toggle('keyboard-enabled', 'Listen for keys', 'Off stops key capture. On shows your key presses below.', keyboardEnabled)}<div class="key-grid">${keyCodes.map(code => `<span class="key" data-code="${code}">${keyLabel(code)}</span>`).join('')}</div><p class="field-hint" style="margin-top:18px">Click a blank part of this window before testing. Keys light up while held.</p></article><article class="card"><h2>Recent key presses</h2><p class="small-copy" style="margin-bottom:17px"><b id="key-count">${keyCount}</b> key presses in this session</p><div id="key-events">${keyLog.length ? keyRows() : empty('keyboard', 'Nothing pressed yet', 'Press any key to see it here.')}</div></article></section>`;
  }

  function keyRows() {
    return keyLog.map(entry => `<div class="key-event"><strong>${escape(entry.name)}</strong><span>${escape(entry.time)}</span></div>`).join('');
  }

  function controllerPage() {
    return heading('Controller test', 'Connect a controller, then press one of its buttons.') +
      notice('Works with controllers exposed by the Windows browser gamepad interface. Button labels are generic for unmapped devices. Dead zone changes only this visualizer, not your controller or games.') +
      `<section class="split"><article class="card"><div class="row space-between"><h2>Live input</h2><span class="badge neutral" id="controller-badge">Looking for a controller</span></div>${toggle('controller-enabled', 'Live monitoring', 'Off stops reading input. On resumes sticks, triggers, and buttons.', controllerEnabled)}<div id="controller-connection">${empty('controller', 'Waiting for your controller', 'Connect via USB or Bluetooth and press a button to make it visible.')}</div><div id="controller-input" hidden><label class="form-label" for="controller-select">Controller</label><select id="controller-select" style="width:100%"></select><p id="controller-name" class="field-hint"></p><div class="stick-grid"><div><div class="stick-disc"><i class="stick-marker" id="left-stick"></i></div><h3>Left stick</h3><small id="left-coordinates">X 0.00 · Y 0.00</small></div><div><div class="stick-disc"><i class="stick-marker" id="right-stick"></i></div><h3>Right stick</h3><small id="right-coordinates">X 0.00 · Y 0.00</small></div></div><div class="trigger"><span>Left trigger</span><div class="progress-track"><div class="progress-fill" id="left-trigger"></div></div><span id="left-trigger-value">0%</span></div><div class="trigger"><span>Right trigger</span><div class="progress-track"><div class="progress-fill" id="right-trigger"></div></div><span id="right-trigger-value">0%</span></div><h3 style="margin-top:21px;font-size:12px">Buttons</h3><div class="controller-buttons" id="controller-buttons"></div></div></article>
      <article class="card"><h2>Visualizer settings</h2><label class="form-label" for="deadzone">Preview dead zone</label><div class="range-row"><input type="range" id="deadzone" min="0" max="30" value="${state.deadzone}"><output id="deadzone-value">${state.deadzone}%</output></div><p class="small-copy">Small stick movements below this threshold are hidden in the diagram. The coordinates still show raw input.</p><ul class="helper-list"><li>Let go of the sticks to check for drift.</li><li>Press each button to see it light up.</li><li>Device battery data is not available here.</li><li>This app never alters device settings.</li></ul></article></section>`;
  }

  function devicesPage() {
    const groups = scannedDevices.reduce((result, device) => { const key = device.className || 'Unknown'; (result[key] ||= []).push(device); return result; }, {});
    const content = deviceScanBusy ? '<div class="device-empty">Reading present Windows devices…</div>' : deviceScanMessage ? `<div class="device-empty"><strong>Scan unavailable</strong><p>${escape(deviceScanMessage)}</p></div>` : scannedDevices.length ? Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, devices]) => `<section class="device-group"><div class="device-group-title"><h3>${escape(group)}</h3><span>${devices.length} device${devices.length === 1 ? '' : 's'}</span></div>${devices.map(device => `<article class="device-row"><div class="device-leading">${icon('controller')}</div><div class="device-details"><strong>${escape(device.name)}</strong><small>${escape(device.instanceId || 'Instance ID unavailable')}</small></div><span class="badge ${String(device.status).toLowerCase() === 'ok' ? 'green' : 'neutral'}">${escape(device.status)}</span></article>`).join('')}</section>`).join('') : '<div class="device-empty"><strong>No scan performed yet</strong><p>Click Scan devices to read the devices currently present in Windows.</p></div>';
    return heading('Devices', 'See hardware currently visible to Windows. Nexus only reads this information.', `<button class="button" id="scan-devices" ${deviceScanBusy ? 'disabled' : ''}>${deviceScanBusy ? 'Scanning…' : 'Scan devices'} <span class="nav-icon">${icon('arrow')}</span></button>`) + notice('Read-only scan. Nexus does not install drivers, change firmware, alter polling settings, or overclock anything. Unknown devices remain informational only.') + `<section class="card devices-card"><div class="row space-between"><div><h2>Present devices</h2><p class="small-copy">Windows Plug and Play devices reported as present at scan time.</p></div><span class="badge neutral">${scannedDevices.length} found</span></div><div class="device-list">${content}</div></section>`;
  }

  function tuningPage() {
    const choices = scannedDevices.filter(device => device.name).map(device => `<option value="${escape(device.instanceId)}" ${state.tuningDevice === device.instanceId ? 'selected' : ''}>${escape(device.name)}</option>`).join('');
    return heading('Tuning', 'Choose a target polling rate for a future supported-device integration.') +
      notice('These controls currently save a preference only. No driver, firmware, USB descriptor, polling interval, or hardware setting is changed. Applying an unsupported value could make a device unstable, so Nexus will only enable it after a verified vendor-specific implementation exists.') +
      `<section class="split"><article class="card"><h2>Target settings</h2><label class="form-label" for="tuning-device">Device</label><select id="tuning-device" style="width:100%"><option value="">Select a scanned device</option>${choices}</select><label class="form-label" for="tuning-rate">Target polling rate</label><select id="tuning-rate" style="width:100%"><option value="300" ${state.tuningRate === 300 ? 'selected' : ''}>300 Hz</option><option value="500" ${state.tuningRate === 500 ? 'selected' : ''}>500 Hz</option><option value="1000" ${state.tuningRate === 1000 ? 'selected' : ''}>1000 Hz</option></select><button class="button tuning-apply" id="apply-tuning" disabled title="No supported device integration is installed yet">Apply target (not available yet)</button><p class="field-hint">Your selected target is remembered on this computer. It is not applied to the device.</p></article><article class="card"><h2>Compatibility status</h2><div class="tuning-status"><span class="badge neutral">Read-only planning</span><strong>No supported tuning adapter connected</strong><p>Nexus can identify Windows devices, but it cannot safely change every mouse, keyboard, or controller. Real support must be added one vendor/model family at a time using documented vendor APIs or protocols.</p></div><ul class="helper-list"><li>300 Hz is not universally supported.</li><li>500 Hz and 1000 Hz also depend on the device.</li><li>Unknown devices stay read-only.</li><li>Use the manufacturer utility when it is the supported option.</li></ul></article></section>`;
  }

  function historyPage() {
    const action = state.history.length ? `<div class="row"><button class="button secondary" id="export-history"><span class="nav-icon">${icon('download')}</span>Export JSON</button><button class="button secondary" id="clear-history">Clear history</button></div>` : '';
    return heading('Test history', 'Review your real pointer-event tests. Saved only on this computer.', action) +
      (state.history.length ? `<article class="card table-wrap"><table><thead><tr><th>Date</th><th>Test</th><th>Event rate</th><th>Average interval</th><th>Samples</th></tr></thead><tbody>${state.history.map(entry => `<tr><td>${escape(new Date(entry.date).toLocaleString())}</td><td>Mouse · ${entry.duration}s</td><td>${entry.rate.toFixed(1)} events/s</td><td>${entry.mean.toFixed(2)} ms</td><td>${entry.samples}</td></tr>`).join('')}</tbody></table></article>${notice('Event rate is an estimate of what this application received, not your USB polling setting. Results from different test methods are not directly comparable.')}` : `<article class="card">${empty('history', 'No tests saved yet', 'Run a mouse test and move inside the test area. A completed test with enough samples saves automatically.')}<div style="text-align:center;padding-bottom:15px"><button class="button" data-page="mouse">Run a mouse test</button></div></article>`);
  }

  function profilesPage() {
    return heading('Profiles', 'Save your favorite app preferences and switch between them.') +
      notice('Profiles store sound, theme, animation, test duration, and the visualizer dead zone. They do not change device polling rates or game settings.') +
      `<article class="card"><h2>Save current preferences</h2><p class="small-copy">Give this setup a name, like Quiet mode or Evening gaming.</p><form class="profile-form" id="profile-form"><input type="text" id="profile-name" maxlength="40" required placeholder="Profile name" aria-label="Profile name"><button class="button" type="submit"><span class="nav-icon">${icon('plus')}</span>Save profile</button></form></article>
      <section class="profile-list">${state.profiles.length ? state.profiles.map(profile => `<article class="card profile-card"><span class="tool-icon" style="margin:0;width:38px;height:38px">${icon('profiles')}</span><div><h3>${escape(profile.name)}</h3><p>${profile.settings.dark ? 'Dark' : 'Light'} theme · Sounds ${profile.settings.sound ? 'on' : 'off'} · ${profile.duration}s mouse test</p></div><button class="button secondary" data-apply-profile="${escape(profile.id)}">Apply</button><button class="icon-button" aria-label="Delete ${escape(profile.name)} profile" data-delete-profile="${escape(profile.id)}"><span class="nav-icon">${icon('trash')}</span></button></article>`).join('') : `<article class="card">${empty('profiles', 'Your profiles will appear here', 'Change a few settings, then save them with a name.')}</article>`}</section>`;
  }

  function settingsPage() {
    const s = state.settings;
    return heading('Settings', 'Simple controls. Changes are saved automatically.') +
      `<div class="settings-width"><section class="card settings-card"><h2>Appearance</h2>${toggle('dark', 'Dark theme', 'Switch between a light and dark interface.', s.dark)}${toggle('animations', 'Subtle animations', 'Gentle page transitions and hover effects. Off makes changes instant.', s.animations)}</section>
      <section class="card settings-card"><h2>Sound feedback</h2>${toggle('sound', 'Enable sounds', 'The master switch for all interface sounds.', s.sound)}${toggle('hoverSound', 'Hover sounds', 'A soft tone when you move over a button.', s.hoverSound)}${toggle('clickSound', 'Click sounds', 'A small sound when you click a button.', s.clickSound)}<label class="form-label" for="volume">Volume</label><div class="range-row"><input id="volume" type="range" min="0" max="100" value="${s.volume}"><output id="volume-value">${s.volume}%</output><button class="button secondary" id="test-sound" ${s.sound ? '' : 'disabled'}>Test sound</button></div><p class="field-hint">Hover audio begins after your first click. Individual preferences are remembered even when all sounds are off.</p></section>
      <section class="card settings-card"><h2>About Nexus</h2><p class="small-copy">Version ${appVersion} · Local peripheral tools for Windows 10/11.<br>Real pointer events, keyboard feedback, and gamepad visualization. No device scanning, hardware overclocking, firmware updates, or background services.</p><div class="row" style="margin-top:20px"><button class="button secondary" id="reset-settings">Restore default settings</button></div></section></div>`;
  }

  function render() {
    const pages = { home: homePage, mouse: mousePage, keyboard: keyboardPage, controller: controllerPage, devices: devicesPage, tuning: tuningPage, history: historyPage, profiles: profilesPage, settings: settingsPage };
    const page = $('#page');
    page.innerHTML = pages[state.page]();
    page.classList.remove('enter');
    void page.offsetWidth;
    page.classList.add('enter');
    if (state.page === 'settings') syncSoundControls();
    if (state.page === 'mouse' && mouseResult) updateMouseMetrics(mouseResult);
    if (state.page === 'controller') {
      controllerId = '';
      if (controllerEnabled) controllerLoop();
      else {
        $('#controller-badge').textContent = 'Monitoring paused';
        $('#controller-connection').innerHTML = empty('controller', 'Monitoring is off', 'Turn on Live monitoring to read your controller input.');
      }
    }
    if (state.page === 'devices' && !deviceScanBusy && !hasScannedDevices) scanDevices();
    fillIcons();
  }

  async function scanDevices() {
    if (deviceScanBusy || !window.aurora?.scanDevices) return;
    deviceScanBusy = true;
    hasScannedDevices = true;
    deviceScanMessage = '';
    render();
    try {
      const result = await window.aurora.scanDevices();
      scannedDevices = Array.isArray(result?.devices) ? result.devices : [];
      deviceScanMessage = result?.message || '';
    } catch (_) {
      scannedDevices = [];
      deviceScanMessage = 'The device scan could not be completed.';
    } finally {
      deviceScanBusy = false;
      if (state.page === 'devices') render();
    }
  }

  function syncSoundControls() {
    for (const key of ['hoverSound', 'clickSound', 'volume']) {
      if ($(`#${key}`)) $(`#${key}`).disabled = !state.settings.sound;
    }
    if ($('#test-sound')) $('#test-sound').disabled = !state.settings.sound || Number(state.settings.volume) === 0;
  }

  function analyzeMouse() {
    if (!mouseIntervals.length) return null;
    const mean = mouseIntervals.reduce((sum, value) => sum + value, 0) / mouseIntervals.length;
    const variance = mouseIntervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / mouseIntervals.length;
    return { mean, variation: Math.sqrt(variance), rate: 1000 / mean, samples: mouseIntervals.length };
  }

  function updateMouseMetrics(result) {
    if (!$('#event-rate') || !result) return;
    $('#event-rate').innerHTML = `${result.rate.toFixed(1)} <em>events/s</em>`;
    $('#event-interval').innerHTML = `${result.mean.toFixed(2)} <em>ms</em>`;
    $('#event-variation').innerHTML = `${result.variation.toFixed(2)} <em>ms</em>`;
    $('#event-samples').textContent = result.samples;
    $('#mouse-result-label').textContent = mouseRunning ? 'Recording' : 'Measured events';
  }

  function startMouse() {
    if (mouseRunning) return;
    mouseRunning = true;
    mouseIntervals = [];
    mouseLast = null;
    mouseResult = null;
    mouseStart = performance.now();
    $('#start-mouse').disabled = true;
    $('#stop-mouse').disabled = false;
    $('#test-duration').disabled = true;
    $('#mouse-area').classList.add('running');
    $('#mouse-instruction').textContent = 'Keep moving your mouse here';
    $('#mouse-status').textContent = 'Move continuously in circles until the timer finishes.';
    $('#event-rate').textContent = '—';
    $('#event-interval').textContent = '—';
    $('#event-variation').textContent = '—';
    $('#event-samples').textContent = '0';
    $('#mouse-result-label').textContent = 'Recording';
    mouseTimer = setInterval(() => {
      const elapsed = (performance.now() - mouseStart) / 1000;
      const remaining = Math.max(0, state.duration - elapsed);
      $('#mouse-progress').style.width = `${Math.min(100, elapsed / state.duration * 100)}%`;
      $('#mouse-time').textContent = `${remaining.toFixed(1)} seconds remaining`;
      updateMouseMetrics(analyzeMouse());
      if (elapsed >= state.duration) stopMouse(true);
    }, 100);
  }

  function stopMouse(complete) {
    clearInterval(mouseTimer);
    mouseRunning = false;
    mouseLast = null;
    mouseResult = analyzeMouse();
    if ($('#start-mouse')) {
      $('#start-mouse').disabled = false;
      $('#stop-mouse').disabled = true;
      $('#test-duration').disabled = false;
      $('#mouse-area').classList.remove('running');
      $('#mouse-instruction').textContent = complete ? 'Test finished' : 'Test stopped';
      $('#mouse-status').textContent = complete ? 'Start another test to compare your results.' : 'This stopped test was not saved.';
      $('#mouse-time').textContent = complete ? 'Complete' : 'Stopped';
      updateMouseMetrics(mouseResult);
    }
    if (complete && mouseResult && mouseResult.samples >= 20) {
      state.history.unshift({ ...mouseResult, duration: state.duration, date: new Date().toISOString() });
      state.history = state.history.slice(0, 100);
      if (save()) toast('Mouse test saved to your history.');
    } else if (complete) {
      if ($('#mouse-result-label')) $('#mouse-result-label').textContent = 'Not enough movement';
      toast('Not enough movement to save a result. Try moving for the whole test.');
    }
  }

  document.addEventListener('pointermove', event => {
    if (!mouseRunning) return;
    const area = $('#mouse-area');
    if (!area || !area.contains(event.target)) { mouseLast = null; return; }
    const timestamp = performance.now();
    if (mouseLast !== null && timestamp > mouseLast && mouseIntervals.length < 100000) mouseIntervals.push(timestamp - mouseLast);
    mouseLast = timestamp;
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    const area = $('#mouse-area');
    if (mouseRunning && area && area.contains(event.target) && !area.contains(event.relatedTarget)) mouseLast = null;
  }, { passive: true });

  document.addEventListener('keydown', event => {
    if (state.page !== 'keyboard' || !keyboardEnabled || event.target.closest('input, select, textarea')) return;
    if (event.code === 'Tab') return;
    const key = $(`[data-code="${event.code}"]`);
    if (key) key.classList.add('pressed');
    pressedKeys.add(event.code);
    if (!event.repeat) {
      keyCount += 1;
      keyLog.unshift({ name: event.code === 'Space' ? 'Space' : event.key, time: new Date().toLocaleTimeString() });
      keyLog = keyLog.slice(0, 8);
      $('#key-count').textContent = keyCount;
      $('#key-events').innerHTML = keyRows();
    }
    if (!event.target.closest('button') && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  document.addEventListener('keyup', event => {
    pressedKeys.delete(event.code);
    $$('[data-code]').find(node => node.dataset.code === event.code)?.classList.remove('pressed');
  });
  window.addEventListener('blur', () => {
    pressedKeys.clear();
    $$('.key.pressed').forEach(node => node.classList.remove('pressed'));
    if (mouseRunning) { stopMouse(false); toast('Mouse test stopped because the window lost focus.'); }
  });

  function gamepads() {
    try { return [...navigator.getGamepads()].filter(Boolean); } catch (_) { return []; }
  }

  function controllerLoop() {
    cancelAnimationFrame(controllerFrame);
    if (state.page !== 'controller' || !controllerEnabled) return;
    const pads = gamepads();
    const selector = $('#controller-select');
    if (!pads.length) {
      $('#controller-badge').textContent = 'Not detected yet';
      $('#controller-connection').hidden = false;
      $('#controller-input').hidden = true;
      controllerId = '';
    } else {
      $('#controller-badge').textContent = 'Connected';
      $('#controller-connection').hidden = true;
      $('#controller-input').hidden = false;
      const listId = pads.map(pad => `${pad.index}:${pad.id}`).join('|');
      if (selector.dataset.list !== listId) {
        selector.innerHTML = pads.map(pad => `<option value="${pad.index}">${escape(pad.id)}</option>`).join('');
        selector.dataset.list = listId;
        if (pads.some(pad => pad.index === selectedController)) selector.value = String(selectedController);
      }
      const pad = pads.find(item => item.index === Number(selector.value)) || pads[0];
      if (controllerId !== `${pad.index}:${pad.id}`) {
        controllerId = `${pad.index}:${pad.id}`;
        $('#controller-name').textContent = `${pad.mapping === 'standard' ? 'Standard layout' : 'Generic layout'} · ${pad.buttons.length} buttons · ${pad.axes.length} axes`;
        $('#controller-buttons').innerHTML = pad.buttons.map((_, i) => `<span data-button="${i}">B${i + 1}</span>`).join('');
      }
      for (const [name, offset] of [['left', 0], ['right', 2]]) {
        const x = pad.axes[offset] || 0;
        const y = pad.axes[offset + 1] || 0;
        const magnitude = Math.hypot(x, y);
        const px = magnitude < state.deadzone / 100 ? 0 : x;
        const py = magnitude < state.deadzone / 100 ? 0 : y;
        $(`#${name}-stick`).style.left = `${50 + px * 44}%`;
        $(`#${name}-stick`).style.top = `${50 + py * 44}%`;
        $(`#${name}-coordinates`).textContent = `X ${x.toFixed(2)} · Y ${y.toFixed(2)}`;
      }
      pad.buttons.forEach((button, i) => {
        $(`[data-button="${i}"]`)?.classList.toggle('pressed', button.pressed);
      });
      for (const [name, index] of [['left', 6], ['right', 7]]) {
        const value = Math.round((pad.buttons[index]?.value || 0) * 100);
        $(`#${name}-trigger`).style.width = `${value}%`;
        $(`#${name}-trigger-value`).textContent = `${value}%`;
      }
    }
    controllerFrame = requestAnimationFrame(controllerLoop);
  }

  async function confirmClear(title, description) {
    const dialog = $('#confirmation');
    $('#confirm-title').textContent = title;
    $('#confirm-description').textContent = description;
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id !== 'test-sound') sound('click');
    if (button.id === 'window-minimize') { window.aurora?.window?.minimize(); return; }
    if (button.id === 'window-maximize') {
      const maximized = await window.aurora?.window?.toggleMaximize();
      button.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
      button.classList.toggle('is-maximized', Boolean(maximized));
      return;
    }
    if (button.id === 'window-close') { window.aurora?.window?.close(); return; }
    if (button.id === 'update-button') {
      $('#update-dialog').showModal();
      renderUpdateDialog();
      if (updateState.status !== 'downloading' && updateState.status !== 'ready') {
        updateState = { status: 'checking' };
        renderUpdateDialog();
        const result = await window.aurora?.checkForUpdate?.();
        if (result) { updateState = result; renderUpdateDialog(); }
      }
      return;
    }
    if (button.id === 'changelog-button') {
      showChangelog();
      return;
    }
    if (button.id === 'changelog-close') {
      $('#changelog-dialog')?.close();
      return;
    }
    if (button.id === 'restart-app') {
      if (updateState.status !== 'ready') return;
      button.disabled = true;
      button.textContent = 'Restarting…';
      let started = false;
      try { started = await window.aurora?.installUpdate?.(); } catch (_) {}
      if (!started) { button.disabled = false; button.textContent = 'Install and restart'; toast('The update could not be installed. Try again.'); }
      return;
    }
    if (button.id === 'update-later') { $('#update-dialog').close(); return; }
    if (button.dataset.page) { navigate(button.dataset.page); return; }
    if (button.id === 'quick-settings') navigate('settings');
    if (button.id === 'start-mouse') startMouse();
    if (button.id === 'stop-mouse') stopMouse(false);
    if (button.id === 'scan-devices') { hasScannedDevices = false; scanDevices(); }
    if (button.id === 'clear-keys') {
      keyCount = 0; keyLog = []; pressedKeys.clear(); render(); toast('Keyboard test cleared.');
    }
    if (button.id === 'test-sound') sound('test');
    if (button.id === 'reset-settings') {
      state.settings = { ...defaults }; applyAppearance();
      const persisted = save(); render();
      if (persisted) toast('Default settings restored.');
    }
    if (button.id === 'clear-history' && await confirmClear('Clear test history?', 'This removes your saved mouse tests from this computer. Profiles and settings are kept.')) {
      state.history = [];
      const persisted = save(); render();
      if (persisted) toast('Test history cleared.');
    }
    if (button.id === 'export-history') {
      const data = { app: 'Nexus 1.1', method: 'Application pointer-event timing; not raw USB polling or latency', tests: state.history };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'nexus-test-history.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('History export requested.');
    }
    if (button.dataset.applyProfile) {
      const profile = state.profiles.find(item => item.id === button.dataset.applyProfile);
      if (!profile) return;
      state.settings = { ...defaults, ...profile.settings }; state.duration = profile.duration; state.deadzone = profile.deadzone;
      applyAppearance();
      const persisted = save(); render();
      if (persisted) toast(`“${profile.name}” applied to app preferences.`);
    }
    if (button.dataset.deleteProfile) {
      state.profiles = state.profiles.filter(item => item.id !== button.dataset.deleteProfile);
      const persisted = save(); render();
      if (persisted) toast('Profile deleted.');
    }
  });

  document.addEventListener('pointerover', event => {
    const button = event.target.closest('button');
    if (button && !button.disabled && !button.contains(event.relatedTarget)) sound('hover');
  }, { passive: true });
  document.addEventListener('pointerdown', ripple, { passive: true });

  $('#window-drag-area')?.addEventListener('dblclick', () => $('#window-maximize')?.click());

  document.addEventListener('change', event => {
    const element = event.target;
    const id = element.id;
    if (id in defaults && element.type === 'checkbox') {
      state.settings[id] = element.checked;
      $(`#${id}-state`).textContent = element.checked ? 'On' : 'Off';
      applyAppearance(); save(); syncSoundControls();
    }
    if (id === 'test-duration') { state.duration = Number(element.value); save(); }
    if (id === 'keyboard-enabled') {
      keyboardEnabled = element.checked;
      $('#keyboard-enabled-state').textContent = keyboardEnabled ? 'On' : 'Off';
      if (!keyboardEnabled) { pressedKeys.clear(); $$('.key.pressed').forEach(node => node.classList.remove('pressed')); }
    }
    if (id === 'controller-enabled') {
      controllerEnabled = element.checked;
      $('#controller-enabled-state').textContent = controllerEnabled ? 'On' : 'Off';
      if (controllerEnabled) {
        $('#controller-connection').innerHTML = empty('controller', 'Waiting for your controller', 'Connect via USB or Bluetooth and press a button to make it visible.');
        controllerLoop();
      }
      else { cancelAnimationFrame(controllerFrame); $('#controller-badge').textContent = 'Monitoring paused'; }
    }
    if (id === 'controller-select') { selectedController = Number(element.value); controllerId = ''; }
    if (id === 'tuning-device') { state.tuningDevice = element.value; save(); }
    if (id === 'tuning-rate') { state.tuningRate = Number(element.value); save(); }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'volume') {
      state.settings.volume = Number(event.target.value); $('#volume-value').textContent = `${state.settings.volume}%`; save(); syncSoundControls();
    }
    if (event.target.id === 'deadzone') {
      state.deadzone = Number(event.target.value); $('#deadzone-value').textContent = `${state.deadzone}%`; save();
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'profile-form') return;
    event.preventDefault();
    const name = $('#profile-name').value.trim();
    if (!name) { $('#profile-name').focus(); return; }
    if (state.profiles.length >= 30) { toast('You can save up to 30 profiles. Delete one to add another.'); return; }
    state.profiles.push({ id: crypto.randomUUID(), name, settings: { ...state.settings }, duration: state.duration, deadzone: state.deadzone });
    const persisted = save(); render();
    if (persisted) toast(`“${name}” saved.`);
  });

  applyAppearance();
  fillIcons();
  render();
})();
