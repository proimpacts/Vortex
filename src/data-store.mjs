// The on-disk copy of the mod's data. Lives next to the launcher, never inside the app's own profile,
// so it survives the platform clearing its storage or being reinstalled. Login and session data are deliberately left out:
// a backup file is easy to copy by accident, and a stolen session is far worse than a lost setting.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

// Same rule as the page: the mod's own keys, plus Yapin display preferences. Never login or session data.
export const isBackupKey = (k) =>
  typeof k === 'string' && k.length < 200 &&
  (k.startsWith('vixer:') || (/^yapper[-:.]/.test(k) && !/(token|auth|session|rum|secret|key|password)/i.test(k)));

export function openStore(dir, onFlush) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'data.json');
  let data = {};
  let savedAt = null;
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    if (j && typeof j.data === 'object' && j.data) {
      for (const [k, v] of Object.entries(j.data)) if (isBackupKey(k) && typeof v === 'string') data[k] = v;
      savedAt = j.savedAt ?? null;
    }
  } catch { /* first run, or an unreadable file: start empty */ }
  // Keep the file as it was when this session began, in case this session writes something worse.
  try { if (existsSync(file)) copyFileSync(file, `${file}.prev`); } catch { /* best effort */ }

  let dirty = false;
  let timer = null;
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!dirty) return false;
    dirty = false;
    const body = JSON.stringify({ version: 1, savedAt: (savedAt = new Date().toISOString()), data });
    writeFileSync(`${file}.tmp`, body);
    renameSync(`${file}.tmp`, file); // never leaves a half-written file
    try { onFlush?.(); } catch { /* a listener must not break saving */ }
    return true;
  }
  // msg: { set: { key: string }, del: [key] }. Only ever adds, updates or deletes named keys.
  function apply(msg) {
    let changed = false;
    if (msg && typeof msg.set === 'object' && msg.set) {
      for (const [k, v] of Object.entries(msg.set)) if (isBackupKey(k) && typeof v === 'string' && data[k] !== v) { data[k] = v; changed = true; }
    }
    if (msg && Array.isArray(msg.del)) for (const k of msg.del) if (isBackupKey(k) && k in data) { delete data[k]; changed = true; }
    if (changed) {
      dirty = true;
      if (!timer) timer = setTimeout(() => { try { flush(); } catch (e) { console.error('backup write failed:', e.message); } }, 1500);
    }
    return changed;
  }
  return { file, data, get savedAt() { return savedAt; }, apply, flush };
}
