import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Where the Yapin app is. Windows: the installer's folder. Linux: Yapin ships as an AppImage that runs from wherever it was saved, so there
// is no fixed place; look in the usual ones (newest file wins). YAPPER_EXE always wins, and the Linux launcher script can remember a choice.
export function findYapper(dataDir) {
  if (process.env.YAPPER_EXE) return process.env.YAPPER_EXE;
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? '', 'Programs', 'yapper-desktop', 'Yapper.exe');
  const saved = join(dataDir, 'yapper-path');
  try { const t = readFileSync(saved, 'utf8').trim(); if (t && existsSync(t)) return t; } catch { /* nothing saved */ }
  const home = homedir();
  const dirs = [join(home, 'Applications'), join(home, 'Downloads'), join(home, 'Desktop'), join(home, '.local', 'bin'), join(home, 'bin'), '/opt', '/opt/Yapper', '/usr/local/bin', home];
  const hits = [];
  for (const d of dirs) {
    let names = []; try { names = readdirSync(d); } catch { continue; }
    for (const n of names) if (/^yapper.*\.appimage$/i.test(n)) { try { hits.push(join(d, n)); } catch { /* skip */ } }
  }
  const mtime = (f) => { try { return statSync(f).mtimeMs; } catch { return 0; } };
  return hits.sort((a, b) => mtime(b) - mtime(a))[0] ?? join(home, 'Applications', 'Yapper-Setup.AppImage');
}
