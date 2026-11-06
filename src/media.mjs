// Keeps the media helper (src/media-helper.ps1) running and answers the page's requests through it.
// The page can only ask for a fixed set of actions with checked values; it never supplies anything that is run.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HELPER = join(dirname(fileURLToPath(import.meta.url)), 'media-helper.ps1');
const OPS = new Set(['state', 'play', 'pause', 'toggle', 'next', 'prev', 'seek', 'shuffle', 'repeat']);
const FILTERS = new Set(['spotify', 'any']);
const REPEAT = new Set(['none', 'track', 'list']);

// Returns a cleaned request, or null if anything about it is not allowed.
export function cleanRequest(m) {
  if (!m || typeof m !== 'object' || !OPS.has(m.op)) return null;
  const out = { op: m.op, filter: FILTERS.has(m.filter) ? m.filter : 'spotify' };
  if (m.op === 'state') out.art = m.art === true;
  if (m.op === 'seek') { const v = Number(m.value); if (!Number.isFinite(v) || v < 0 || v > 86400) return null; out.value = v; }
  if (m.op === 'shuffle') { if (typeof m.value !== 'boolean') return null; out.value = m.value; }
  if (m.op === 'repeat') { if (!REPEAT.has(m.value)) return null; out.value = m.value; }
  return out;
}

export function createMedia({ spawnFn = spawn, helper = HELPER, timeoutMs = 10000, platform = process.platform } = {}) {
  let proc = null, buf = '', nextId = 0;
  const pending = new Map();
  let stateInFlight = null; // a second "state" while one is running just waits for the same answer

  const failAll = (error) => { for (const p of pending.values()) { clearTimeout(p.timer); p.resolve({ ok: false, error }); } pending.clear(); stateInFlight = null; };

  function ensure() {
    if (proc) return proc;
    proc = spawnFn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d) => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let r; try { r = JSON.parse(line); } catch { continue; }
        if (r.ready) continue;
        const p = pending.get(r.id);
        if (p) { clearTimeout(p.timer); pending.delete(r.id); p.resolve(r); }
      }
    });
    const gone = () => { proc = null; buf = ''; failAll('The media helper stopped.'); };
    proc.on('exit', gone); proc.on('error', gone);
    return proc;
  }

  function request(msg) {
    const req = cleanRequest(msg);
    if (!req) return Promise.resolve({ ok: false, error: 'That request is not allowed.' });
    if (platform !== 'win32') return Promise.resolve({ ok: false, error: 'Media controls need Windows.' });
    if (req.op === 'state' && stateInFlight) return stateInFlight;
    const p = ensure();
    const id = ++nextId;
    const promise = new Promise((resolve) => {
      const timer = setTimeout(() => { pending.delete(id); if (req.op === 'state') stateInFlight = null; resolve({ ok: false, error: 'No answer from the media helper.' }); }, timeoutMs);
      pending.set(id, { resolve, timer });
    }).then((r) => { if (req.op === 'state') stateInFlight = null; return r; });
    if (req.op === 'state') stateInFlight = promise;
    try { p.stdin.write(JSON.stringify({ id, ...req }) + '\n'); } catch { /* the exit handler answers */ }
    return promise;
  }

  function stop() { try { proc?.stdin.end(); proc?.kill(); } catch { /* already gone */ } proc = null; }
  return { request, stop };
}
