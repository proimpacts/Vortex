// Checks a public GitHub repository for a newer Vortex and installs it.
//
// Safety rules (this downloads code that then runs on this PC, so they matter):
//  - The repository comes from the launcher's own files (version.json, or %APPDATA%\Vortex\update.json), never from the page,
//    so nothing running inside the app window can point updates somewhere else.
//  - Only GitHub over HTTPS is contacted, and only the exact URLs built here.
//  - The download is size-limited, unpacked in a temp folder, checked (required files, version number, syntax of the launcher
//    and core scripts) and only then copied in. The old files are saved to a backup folder first and restored if copying fails.
//  - Only the listed project items are replaced. Your data, your own add-ons, and anything else in the folder are left alone.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

export const REPO_RE = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9_./-]{1,60}$/;
const SEMVER = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:-[0-9A-Za-z.-]+)?$/;
export const MANAGED = ['launcher.mjs', 'src', 'plugins', 'themes', 'docs', 'templates', 'README.md', 'LICENSE', 'NOTICE', 'version.json', 'package.json', 'start.bat', 'start-dev.bat', 'open-addons-folder.bat'];
const MERGE = new Set(['plugins', 'themes']);
const MAX_ZIP = 60 * 1024 * 1024;
const KEEP_BACKUPS = 3;

export const parseVersion = (s) => { const m = SEMVER.exec(String(s ?? '').trim()); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
// 1 if a is newer than b, -1 if older, 0 if equal, null if either is not a version.
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

// Windows' own tar.exe (not whichever "tar" comes first on the PATH, which can be a tool that cannot read zips).
export const winTar = () => join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe');
function defaultUnzip(zip, dest) {
  // tar (bsdtar, built into Windows 10+) refuses entries that climb out of the folder; elsewhere use unzip.
  if (process.platform === 'win32') execFileSync(winTar(), ['-xf', zip, '-C', dest], { stdio: 'ignore', timeout: 120000 });
  else execFileSync('unzip', ['-q', zip, '-d', dest], { stdio: 'ignore', timeout: 120000 });
}

export function createUpdater({ root, dataDir, doFetch = globalThis.fetch, unzip = defaultUnzip, syntaxCheck = true }) {
  const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

  function config() {
    const base = readJson(join(root, 'version.json')) ?? {};
    const own = readJson(join(dataDir, 'update.json')) ?? {}; // lets someone follow a fork without editing the project
    const pick = (k) => (typeof own[k] === 'string' && own[k] ? own[k] : base[k]);
    const channel = pick('channel') === 'branch' ? 'branch' : 'releases';
    const branch = BRANCH_RE.test(pick('branch') ?? '') ? pick('branch') : 'main';
    return { version: String(base.version ?? '0.0.0'), repo: String(pick('repo') ?? ''), channel, branch };
  }

  async function getJson(url, headers = {}) {
    const res = await doFetch(url, { headers: { 'User-Agent': 'Vortex-Updater', ...headers }, signal: AbortSignal.timeout(15000) });
    return res;
  }

  let found = null; // what the last check saw, so "apply" installs exactly that and nothing the caller supplies

  async function check() {
    const cfg = config();
    if (!REPO_RE.test(cfg.repo)) return { ok: false, code: 'no-repo', current: cfg.version, error: 'No GitHub repository is set up for updates yet.' };
    found = null;
    try {
      let latest, zip, notes = '', page = `https://github.com/${cfg.repo}`;
      if (cfg.channel === 'releases') {
        const res = await getJson(`https://api.github.com/repos/${cfg.repo}/releases/latest`, { Accept: 'application/vnd.github+json' });
        if (res.status === 404) return { ok: true, current: cfg.version, latest: null, newer: false, repo: cfg.repo, channel: cfg.channel, note: 'There are no releases yet.' };
        if (!res.ok) return { ok: false, current: cfg.version, error: `GitHub answered ${res.status}.` };
        const j = await res.json();
        latest = String(j.tag_name ?? '');
        notes = String(j.body ?? '').slice(0, 2000);
        page = typeof j.html_url === 'string' && j.html_url.startsWith('https://github.com/') ? j.html_url : page;
        zip = `https://api.github.com/repos/${cfg.repo}/zipball/${encodeURIComponent(latest)}`;
      } else {
        const res = await getJson(`https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/version.json`);
        if (!res.ok) return { ok: false, current: cfg.version, error: `GitHub answered ${res.status}.` };
        latest = String((await res.json()).version ?? '');
        zip = `https://codeload.github.com/${cfg.repo}/zip/refs/heads/${cfg.branch}`;
      }
      const cmp = compareVersions(latest, cfg.version);
      if (cmp === null) return { ok: false, current: cfg.version, error: `The newest version (“${latest.slice(0, 30)}”) is not a version number.` };
      const newer = cmp > 0;
      if (newer) found = { latest: latest.replace(/^v/, ''), zip };
      return { ok: true, current: cfg.version, latest: latest.replace(/^v/, ''), newer, notes, page, repo: cfg.repo, channel: cfg.channel };
    } catch (e) {
      return { ok: false, current: cfg.version, error: `Could not reach GitHub (${e?.name === 'TimeoutError' ? 'timed out' : e?.message ?? 'network error'}).` };
    }
  }

  const syntaxOf = (file) => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe', timeout: 30000 });

  function backup(cfg) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join(dataDir, 'backups', `${cfg.version}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    for (const item of MANAGED) if (existsSync(join(root, item))) cpSync(join(root, item), join(dir, item), { recursive: true });
    const all = join(dataDir, 'backups');
    const old = readdirSync(all).map((n) => ({ n, t: statSync(join(all, n)).mtimeMs })).sort((a, b) => b.t - a.t).slice(KEEP_BACKUPS);
    for (const o of old) rmSync(join(all, o.n), { recursive: true, force: true });
    return dir;
  }

  function restore(dir) {
    for (const item of MANAGED) {
      const from = join(dir, item), to = join(root, item);
      if (!existsSync(from)) continue;
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
    }
  }

  async function apply() {
    const cfg = config();
    if (!found) { const c = await check(); if (!c.ok) return c; if (!found) return { ok: false, current: cfg.version, error: 'Vortex is already up to date.' }; }
    const { latest, zip } = found;
    const tmp = mkdtempSync(join(tmpdir(), 'vortex-update-'));
    try {
      const res = await getJson(zip, { Accept: 'application/vnd.github+json' });
      if (!res.ok) return { ok: false, current: cfg.version, error: `The download failed (GitHub answered ${res.status}).` };
      const len = Number(res.headers?.get?.('content-length') ?? 0);
      if (len > MAX_ZIP) return { ok: false, current: cfg.version, error: 'The download is larger than expected, so it was not installed.' };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_ZIP || buf.length < 100) return { ok: false, current: cfg.version, error: 'The download was the wrong size, so it was not installed.' };
      const zipFile = join(tmp, 'update.zip'), out = join(tmp, 'out');
      writeFileSync(zipFile, buf); mkdirSync(out);
      unzip(zipFile, out);

      // GitHub zips hold one top-level folder; find the one that is a Vortex project.
      const looksRight = (d) => existsSync(join(d, 'launcher.mjs')) && existsSync(join(d, 'src', 'bootstrap.js')) && existsSync(join(d, 'plugins')) && existsSync(join(d, 'version.json'));
      const top = looksRight(out) ? out : readdirSync(out).map((n) => join(out, n)).find((p) => statSync(p).isDirectory() && looksRight(p));
      if (!top) return { ok: false, current: cfg.version, error: 'The download is not a Vortex project (required files are missing), so it was not installed.' };
      const nv = readJson(join(top, 'version.json'))?.version;
      if (compareVersions(nv, cfg.version) !== 1) return { ok: false, current: cfg.version, error: `The download says it is version ${String(nv).slice(0, 30)}, which is not newer, so it was not installed.` };
      if (syntaxCheck) {
        syntaxOf(join(top, 'launcher.mjs')); syntaxOf(join(top, 'src', 'bootstrap.js'));
        for (const f of readdirSync(join(top, 'src'))) if (f.endsWith('.mjs')) syntaxOf(join(top, 'src', f));
      }

      const saved = backup(cfg);
      try {
        for (const item of MANAGED) {
          const from = join(top, item), to = join(root, item);
          if (!existsSync(from)) continue;
          // plugins and themes are merged, not replaced: the project on GitHub ships only the required plugins, and the ones you added must stay
          if (statSync(from).isDirectory() && !MERGE.has(item)) rmSync(to, { recursive: true, force: true });
          cpSync(from, to, { recursive: true, force: true });
        }
      } catch (e) {
        try { restore(saved); } catch { /* the backup folder still has everything */ }
        return { ok: false, current: cfg.version, error: `Installing failed and your old files were put back (${e?.message ?? e}).` };
      }
      found = null;
      return { ok: true, applied: true, from: cfg.version, to: String(nv), backup: saved, current: String(nv), latest: String(nv), newer: false, restart: true };
    } catch (e) {
      return { ok: false, current: cfg.version, error: `Updating failed (${e?.message ?? e}). Nothing was changed.` };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  return { config, check, apply };
}
