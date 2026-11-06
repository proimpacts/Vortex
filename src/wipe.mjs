// Clears Vortex's own settings out of Yapin's storage, for "Uninstall and delete all data".
// Why this exists: Vortex keeps its settings, plugin data and saved items inside Yapin's own browser storage (keys that start with "vixer:"),
// with a copy in a file under the user's profile. Deleting only the file would leave the first copy behind, and it would come back if Vortex
// were installed again. So this opens Yapin once, removes only those keys (nothing of Yapin's own, and nobody is signed out), and closes it.
// Usage (Yapin must not already be running): node wipe.mjs      Prints "wiped N" on success.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findYapper } from './yapper-path.mjs';

const DATA_DIR = process.env.VIXER_DATA_DIR ?? join(process.env.APPDATA ?? process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Vortex');
const EXE = findYapper(DATA_DIR);
const PORT = 49000 + Math.floor(Math.random() * 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ELECTRON_RUN_AS_NODE: _drop, ...env } = process.env;
const args = [`--remote-debugging-port=${PORT}`];
if (process.env.VIXER_USER_DATA) args.push(`--user-data-dir=${process.env.VIXER_USER_DATA}`); // a separate profile, for testing

const child = spawn(EXE, args, { stdio: 'ignore', env });
let exited = false; child.on('exit', () => { exited = true; });
child.on('error', (e) => { console.error('could not start Yapin:', e.message); process.exit(2); });

async function target() {
  for (let i = 0; i < 120 && !exited; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const t = list.find((x) => x.type === 'page' && /yapper\.website|yapin\.gg/.test(x.url || ''));
      if (t) return t;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  return null;
}

const t = await target();
if (!t) { try { child.kill(); } catch { /* gone */ } console.error('Yapin did not open in time'); process.exit(3); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('no connection')); });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); pending.delete(d.id); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { let n = 0; for (const s of [localStorage, sessionStorage]) for (const k of Object.keys(s)) if (k.startsWith('vixer:') || k === '__vxb') { s.removeItem(k); n++; } return n; })()` });
const n = r.result?.result?.value ?? 0;
await sleep(2500); // give the browser time to write the change to disk
await Promise.race([send('Browser.close'), sleep(3000)]);
for (let i = 0; i < 20 && !exited; i++) await sleep(500);
if (!exited) { try { child.kill(); } catch { /* gone */ } }
console.log(`wiped ${n}`);
process.exit(0);
