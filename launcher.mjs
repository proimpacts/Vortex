// Starts Yapper with a local debug port and injects src/bootstrap.js via the Chrome DevTools Protocol.
// Nothing on disk is modified; the injection lives only as long as this process does.
//
// Why it works this way:
//  - It starts the app instead of editing it. That makes Vortex safe to remove (open Yapper normally), keeps it working across
//    Yapper updates, and means a broken Vortex can never break the app's files.
//  - The script is injected before the page runs (Page.addScriptToEvaluateOnNewDocument), so plugins can hook the app's data before
//    the first screen is drawn and nothing flashes in late.
//  - The page reaches this process through a one-way binding and only a short list of validated message kinds is accepted. Plugins run
//    with full power inside the page, so this process (the only part that can touch the PC) must never trust what the page says.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync, renameSync, readdirSync, statSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openStore } from './src/data-store.mjs';
import { readAddons, ensureAddonDirs } from './src/addons.mjs';
import { createUpdater } from './src/updater.mjs';
import { setTitleBar, setFrameHidden, windowAction, WINDOW_ACTIONS, normHex } from './src/titlebar.mjs';
import { createMedia } from './src/media.mjs';
import { createTenor } from './src/tenor.mjs';
import { findYapper } from './src/yapper-path.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
// The mod's data and some Yapin preferences are mirrored here, outside the app's profile, so they survive a reset.
// (Windows: %APPDATA%\Vortex. Linux: ~/.config/Vortex, or $XDG_CONFIG_HOME/Vortex.)
const DATA_DIR = process.env.VIXER_DATA_DIR ?? join(process.env.APPDATA ?? process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Vortex');
// Older versions used %APPDATA%\YapinVixer; move it over once so settings, backups and add-ons carry on.
if (!process.env.VIXER_DATA_DIR && process.env.APPDATA) {
  const old = join(process.env.APPDATA, 'YapinVixer');
  if (existsSync(old) && !existsSync(DATA_DIR)) {
    try { renameSync(old, DATA_DIR); console.log('[vortex] moved your data from YapinVixer to Vortex'); } catch (e) { console.warn('[vortex] could not move old data folder:', e.message); }
  }
}
const updater = createUpdater({ root: ROOT, dataDir: DATA_DIR });
const media = createMedia();
const tenor = createTenor();
process.on('exit', () => media.stop());
let onSaved = () => {};
const store = openStore(DATA_DIR, () => onSaved());
const BINDING = `vx${randomBytes(5).toString('hex')}`;
process.on('exit', () => { try { store.flush(); } catch { /* nothing more to do */ } });
const EXE = findYapper(DATA_DIR);
const PORT = Number(process.env.VIXER_PORT) || 49000 + Math.floor(Math.random() * 1000);

if (!existsSync(EXE)) { console.error(`Yapper not found at ${EXE} (set YAPPER_EXE).`); process.exit(1); }
const isRunning = () => {
  try {
    if (process.platform === 'win32') return execFileSync('tasklist', ['/FI', 'IMAGENAME eq Yapper.exe', '/NH'], { encoding: 'utf8' }).includes('Yapper.exe');
    return execFileSync('pgrep', ['-x', '-i', 'yapper|yapper-desktop'], { encoding: 'utf8' }).trim().length > 0; // pgrep exits 1 when nothing matches
  } catch { return false; }
};
const running = process.env.VIXER_ALLOW_MULTI !== '1' && isRunning();
if (running) { console.error('Yapper is already running. Quit it from the tray first (it allows one instance), then run this again.'); process.exit(1); }

// Add-ons come from the project's own folders and from the user's add-on folder (%APPDATA%\Vortex\plugins and \themes).
// Drop a .js or .css file in the user folder and it is picked up at the next start (or straight away in dev mode).
ensureAddonDirs(DATA_DIR);
if (process.argv.includes('--addons')) { // npm run addons: open the folder for your own plugins and themes, then stop
  try { spawn(process.platform === 'win32' ? 'explorer' : 'xdg-open', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref(); } catch { /* no file manager here */ }
  console.log('Your plugins and themes go in', DATA_DIR);
  process.exit(0);
}
const PLUGIN_DIRS = [join(ROOT, 'plugins'), join(DATA_DIR, 'plugins')];
const THEME_DIRS = [join(ROOT, 'themes'), join(DATA_DIR, 'themes')];
const WATCH = process.env.VIXER_WATCH === '1' || process.argv.includes('--watch');
let problems = [];
function buildBase() {
  const plugins = readAddons(PLUGIN_DIRS, '.js');
  const themes = readAddons(THEME_DIRS, '.css');
  problems = [...plugins.problems, ...themes.problems];
  const payload = {
    debug: process.env.VIXER_DEBUG === '1',
    binding: BINDING,
    appVersion: updater.config().version,
    backup: { path: store.file, savedAt: store.savedAt },
    addonsDir: DATA_DIR,
    problems,
    plugins: plugins.items.map((p) => ({ id: p.id, src: p.body, external: p.dir === PLUGIN_DIRS[1] })),
    themes: themes.items.map((t) => ({ id: t.id, css: t.body, external: t.dir === THEME_DIRS[1] })),
  };
  return { source: readFileSync(join(ROOT, 'src', 'bootstrap.js'), 'utf8').replace('__VIXER_PAYLOAD__', () => JSON.stringify(payload)), payload };
}
let { source: baseSource, payload } = buildBase();
for (const p of problems) console.warn(`add-on skipped: ${p}`);
// The saved data goes on the page right before the bootstrap, and is refreshed whenever the backup file changes,
// so a reload (or a storage wipe) in the middle of a session still restores the latest copy.
const buildSource = () => `window.__vxb=${JSON.stringify(store.data)};\n${baseSource}`;

// VS Code terminals set ELECTRON_RUN_AS_NODE, which turns Yapper.exe into a plain Node process that exits at once.
const { ELECTRON_RUN_AS_NODE: _drop, ...env } = process.env;
const args = [`--remote-debugging-port=${PORT}`, ...(process.env.VORTEX_APP_ARGS ? process.env.VORTEX_APP_ARGS.split(' ').filter(Boolean) : [])]; // e.g. VORTEX_APP_ARGS=--no-sandbox on Linux
if (process.env.VIXER_USER_DATA) args.push(`--user-data-dir=${process.env.VIXER_USER_DATA}`); // a separate profile, for testing
const child = spawn(EXE, args, { stdio: 'ignore', env });
child.on('exit', () => process.exit(0));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function findTarget() {
  for (let i = 0; i < 300; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && /yapper\.website|yapin\.gg/.test(t.url)) ?? list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(100); // poll quickly: the window is picked up the moment it exists
  }
  throw new Error('Timed out waiting for the Yapper window.');
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.method === 'Runtime.bindingCalled' && d.params?.name === BINDING) {
    let msg = null;
    try { msg = JSON.parse(d.params.payload); } catch { /* ignore a malformed message */ }
    if (msg && msg.host === 'update') hostUpdate(msg);
    else if (msg && msg.host === 'titlebar') hostTitleBar(msg);
    else if (msg && msg.host === 'media') hostMedia(msg);
    else if (msg && msg.host === 'tenor') hostTenor(msg);
    else if (msg) { try { store.apply(msg); } catch { /* ignore a bad backup message */ } }
    return;
  }
  pending.get(d.id)?.(d); pending.delete(d.id);
};
const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

// Updates: the page can only ask "check" or "apply". Where updates come from is decided here, not by the page.
async function hostUpdate(msg) {
  let r;
  try { r = msg.op === 'apply' ? await updater.apply() : await updater.check(); } catch (e) { r = { ok: false, error: String(e?.message ?? e) }; }
  const detail = { host: 'update', op: msg.op === 'apply' ? 'apply' : 'check', id: Number(msg.id) || 0, ...r };
  send('Runtime.evaluate', { expression: `window.dispatchEvent(new CustomEvent('vixer:host',{detail:${JSON.stringify(detail)}}))` });
}

// Music controls: what is playing on this PC, and play / pause / skip, through Windows' media controls (see src/media.mjs).
// GIF search through Tenor's public search page (see src/tenor.mjs): the page sends a short phrase, nothing else.
async function hostTenor(msg) {
  const home = msg.op === 'home';
  const r = home ? await tenor.home(48) : await tenor.search(String(msg.q ?? ''), 48);
  const detail = { host: 'tenor', id: Number(msg.id) || 0, op: home ? 'home' : 'search', ...r };
  send('Runtime.evaluate', { expression: `window.dispatchEvent(new CustomEvent('vixer:host',{detail:${JSON.stringify(detail)}}))` });
}

async function hostMedia(msg) {
  const r = await media.request(msg);
  const detail = { host: 'media', id: Number(msg.id) || 0, op: String(msg.op), ...r };
  send('Runtime.evaluate', { expression: `window.dispatchEvent(new CustomEvent('vixer:host',{detail:${JSON.stringify(detail)}}))` });
}

// Window title bar: the page picks a color from the app's own theme; only a plain #rrggbb value is accepted and applied to Yapper's window frame.
let lastBar = '';
let frameHidden = null;
async function hostTitleBar(msg) {
  if (typeof msg.action === 'string') { if (WINDOW_ACTIONS.has(msg.action)) await windowAction(msg.action); return; } // minimize / maximize / close, from NoTitleBar's buttons
  if (typeof msg.hide === 'boolean') { // hide or show the whole bar
    if (msg.hide === frameHidden || (msg.hide === false && frameHidden === null)) return;
    const was = frameHidden; frameHidden = msg.hide;
    const r = await setFrameHidden(msg.hide);
    if (!r.ok) frameHidden = was;
    return;
  }
  const hex = normHex(msg.color);
  if (!hex || hex === lastBar) return;
  lastBar = hex;
  const r = await setTitleBar(hex);
  if (!r.ok) lastBar = ''; // try again next time
}

await send('Page.enable');
await send('Runtime.enable');
await send('Runtime.addBinding', { name: BINDING });
const reg = await send('Page.addScriptToEvaluateOnNewDocument', { source: buildSource() });
if (reg.error) { console.error('Injection failed:', reg.error.message); child.kill(); process.exit(1); }
let scriptId = reg.result.identifier;
let swapTimer = null;
let swapping = false;
async function swapScript() {
  swapTimer = null;
  if (swapping) { swapTimer = setTimeout(swapScript, 500); return; }
  swapping = true;
  try {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: buildSource() });
    if (r.result?.identifier) scriptId = r.result.identifier;
  } finally { swapping = false; }
}
onSaved = () => { if (!swapTimer) swapTimer = setTimeout(swapScript, 2500); };
await send('Page.reload'); // the first load already started without the script

// Dev mode: save an add-on (or the core) and the app reloads with the change, so authors see results at once.
if (WATCH) {
  let watchTimer = null;
  const refresh = () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(async () => {
      try {
        ({ source: baseSource, payload } = buildBase());
        for (const p of problems) console.warn(`add-on skipped: ${p}`);
        await swapScript();
        await send('Page.reload');
        console.log(`[dev] reloaded with ${payload.plugins.length} plugin(s) and ${payload.themes.length} theme(s)`);
      } catch (err) { console.error('[dev] reload failed:', err.message); }
    }, 400);
  };
  for (const dir of [...PLUGIN_DIRS, ...THEME_DIRS, join(ROOT, 'src')]) {
    try { watch(dir, { persistent: true }, (_e, name) => { if (!name || /\.(js|css|mjs)$/.test(name)) refresh(); }); } catch { /* folder missing: nothing to watch */ }
  }
  console.log('[dev] watching add-on folders: saving a .js or .css file reloads the app.');
}
const portFile = join(ROOT, '.vixer-port');
writeFileSync(portFile, String(PORT));
const cleanup = () => { try { unlinkSync(portFile); } catch { /* already gone */ } };
process.on('exit', cleanup);
console.log(`Injected ${payload.plugins.length} plugin(s), ${payload.themes.length} theme(s). Press Ctrl+Shift+V in Yapper for settings.`);
console.log(`Data backup: ${store.file} (${Object.keys(store.data).length} saved item(s) ready to restore)`);
ws.onclose = () => process.exit(0);
