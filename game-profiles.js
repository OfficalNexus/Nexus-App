const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const GAME_CACHE = new Map();
const launcherNames = new Map([
  ['steam', 'Steam'], ['epic', 'Epic Games'], ['ea', 'EA app'], ['ubisoft', 'Ubisoft Connect'],
  ['battle.net', 'Battle.net'], ['riot', 'Riot Client'], ['xbox', 'Xbox / Microsoft Store'], ['gog', 'GOG Galaxy'], ['unknown', 'Game installation']
]);
const launcherWords = /steam|epicgameslauncher|ea desktop|origin|ubisoft|battle\.net|riot client|gog galaxy|xbox games/i;

function exists(file) { try { return fs.existsSync(file); } catch (_) { return false; } }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } }
function normalize(value) { return String(value || '').replace(/[\\/]+$/, ''); }
function uniqueGames(games) {
  const seen = new Set();
  return games.filter(game => {
    const key = `${game.name.toLowerCase()}|${normalize(game.installPath).toLowerCase()}`;
    if (!game.name || !game.installPath || seen.has(key) || launcherWords.test(game.name)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function profileFor(name, installPath) {
  const lower = `${name} ${installPath}`.toLowerCase();
  if (lower.includes('fortnite')) return { id: 'fortnite-safe-performance', label: 'Safe performance profile', supported: true, reason: 'Reversible Fortnite display settings only.' };
  return { id: null, label: 'Detection only', supported: false, reason: 'Nexus does not have a verified reversible profile for this game yet.' };
}
function makeGame(name, installPath, launcher, executable = '') {
  const profile = profileFor(name, installPath);
  return { id: `${name}:${installPath}`, name: String(name).trim(), installPath: normalize(installPath), launcher: launcherNames.get(launcher) || launcher || 'Game installation', executable, profileId: profile.id, profileLabel: profile.label, supported: profile.supported, profileReason: profile.reason, backup: null };
}
function parseSteamLibraries() {
  if (process.platform !== 'win32') return [];
  const roots = [process.env.PROGRAMFILES_X86, process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean);
  const vdfs = [];
  for (const root of roots) {
    vdfs.push(path.join(root, 'Steam', 'steamapps', 'libraryfolders.vdf'));
    vdfs.push(path.join(root, 'SteamLibrary', 'steamapps', 'libraryfolders.vdf'));
  }
  const libraries = [];
  for (const file of vdfs) {
    const text = readText(file);
    for (const match of text.matchAll(/"path"\s+"([^"]+)"/gi)) libraries.push(match[1].replace(/\\\\/g, '\\'));
  }
  return [...new Set(libraries.length ? libraries : vdfs.map(file => path.dirname(path.dirname(file))).filter(exists))];
}
function scanSteam() {
  const games = [];
  for (const library of parseSteamLibraries()) {
    const steamapps = path.join(library, 'steamapps');
    if (!exists(steamapps)) continue;
    for (const file of fs.readdirSync(steamapps, { withFileTypes: true })) {
      if (!file.name.startsWith('appmanifest_') || !file.name.endsWith('.acf')) continue;
      const text = readText(path.join(steamapps, file.name));
      const name = text.match(/"name"\s+"([^"]+)"/i)?.[1];
      const installDir = text.match(/"installdir"\s+"([^"]+)"/i)?.[1];
      if (name && installDir) games.push(makeGame(name, path.join(library, 'steamapps', 'common', installDir), 'steam'));
    }
  }
  return games;
}
function scanEpic() {
  const games = [];
  const roots = [process.env.PROGRAMDATA, process.env.LOCALAPPDATA].filter(Boolean);
  for (const root of roots) {
    const dir = path.join(root, 'EpicGamesLauncher', 'Data', 'Manifests');
    if (!exists(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.item'))) {
      try {
        const item = JSON.parse(readText(path.join(dir, file)));
        if (item.DisplayName && item.InstallLocation) games.push(makeGame(item.DisplayName, item.InstallLocation, 'epic', item.LaunchExecutable || ''));
      } catch (_) { /* Ignore incomplete launcher manifests. */ }
    }
  }
  return games;
}
function scanRegistry() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const script = `$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); Get-ItemProperty $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.InstallLocation -and $_.Publisher -notmatch 'Microsoft|NVIDIA|AMD|Intel|Adobe|Google|Mozilla|Discord|Valve|Epic Games' } | Select-Object DisplayName,InstallLocation,DisplayIcon | ConvertTo-Json -Compress`;
  return new Promise(resolve => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (_error, stdout) => {
    try {
      const parsed = JSON.parse(stdout || '[]');
      const list = Array.isArray(parsed) ? parsed : [parsed];
      resolve(list.filter(item => item?.DisplayName && item?.InstallLocation).map(item => makeGame(item.DisplayName, item.InstallLocation, 'unknown', item.DisplayIcon || '')));
    } catch (_) { resolve([]); }
  }));
}
function addKnownRoots() {
  const candidates = [];
  const roots = [process.env.PROGRAMFILES, process.env.PROGRAMFILES_X86, process.env.LOCALAPPDATA].filter(Boolean);
  const folders = ['EA Games', 'Ubisoft Game Launcher', 'Battle.net', 'Riot Games', 'GOG Galaxy\Games', 'XboxGames'];
  for (const root of roots) for (const folder of folders) {
    const dir = path.join(root, folder);
    if (!exists(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) candidates.push(makeGame(entry.name, path.join(dir, entry.name), folder.toLowerCase().includes('riot') ? 'riot' : 'unknown'));
  }
  return candidates;
}
async function discoverGames() {
  const detected = [...scanSteam(), ...scanEpic(), ...addKnownRoots(), ...(await scanRegistry())];
  return uniqueGames(detected).map(game => ({ ...game, profile: profileFor(game.name, game.installPath) }));
}
function findFortniteConfig(game) {
  const config = path.join(process.env.LOCALAPPDATA || '', 'FortniteGame', 'Saved', 'Config', 'WindowsClient', 'GameUserSettings.ini');
  return game?.name.toLowerCase().includes('fortnite') && exists(config) ? config : null;
}
function patchIni(original) {
  const changes = { bUseVSync: 'False', FrameRateLimit: '0', 'sg.ViewDistanceQuality': '2', 'sg.AntiAliasingQuality': '0', 'sg.ShadowQuality': '0', 'sg.PostProcessQuality': '0', 'sg.EffectsQuality': '0', 'sg.FoliageQuality': '0' };
  let output = original;
  for (const [key, value] of Object.entries(changes)) {
    const re = new RegExp(`^${key.replace('.', '\\.') }=.*$`, 'mi');
    if (re.test(output)) output = output.replace(re, `${key}=${value}`);
    else output += `${output.endsWith('\n') || !output ? '' : '\n'}${key}=${value}\n`;
  }
  return output;
}
function backupPath(file) { return `${file}.nexus-backup-${Date.now()}`; }
async function optimizeGame(game) {
  if (!game?.supported || game.profileId !== 'fortnite-safe-performance') return { ok: false, message: 'No verified reversible profile is available for this game.' };
  const config = findFortniteConfig(game);
  if (!config) return { ok: false, message: 'Fortnite’s local settings file was not found. Start Fortnite once, then try again.' };
  const original = readText(config);
  const backup = backupPath(config);
  fs.copyFileSync(config, backup);
  fs.writeFileSync(config, patchIni(original), 'utf8');
  GAME_CACHE.set(game.id, { backup, config });
  return { ok: true, backup, message: 'Fortnite safe performance settings applied. Your original settings were backed up.' };
}
async function restoreGame(game) {
  const record = GAME_CACHE.get(game?.id);
  if (!record || !exists(record.backup)) return { ok: false, message: 'No Nexus backup was found for this game.' };
  fs.copyFileSync(record.backup, record.config);
  return { ok: true, message: 'The previous game settings were restored.' };
}
module.exports = { discoverGames, optimizeGame, restoreGame };
