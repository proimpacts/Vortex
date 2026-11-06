// Finds plugins (.js) and themes (.css) on disk. Used by the launcher.
// Add-ons are read from the project's own folders first and then from the user's add-on folder,
// so anything the user drops in there replaces a built-in one with the same name.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

export const ADDON_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_ADDON_BYTES = 500 * 1024;

/** Reads every file with `ext` from the folders, later folders winning. Returns { items: [{ id, body, dir }], problems: [text] }. */
export function readAddons(dirs, ext) {
  const byId = new Map();
  const problems = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(ext)) continue;
      const id = basename(file, ext);
      if (!ADDON_ID.test(id)) { problems.push(`${file}: the file name must be lowercase letters, numbers and dashes (for example my-theme${ext}).`); continue; }
      const path = join(dir, file);
      try {
        const st = statSync(path);
        if (!st.isFile()) continue;
        if (st.size > MAX_ADDON_BYTES) { problems.push(`${file}: larger than 500 KB, so it was skipped.`); continue; }
        byId.set(id, { id, body: readFileSync(path, 'utf8'), dir });
      } catch (err) { problems.push(`${file}: ${err.message}`); }
    }
  }
  return { items: [...byId.values()], problems };
}

/** Creates the user's plugins/ and themes/ folders so there is somewhere obvious to drop files. */
export function ensureAddonDirs(base) {
  for (const name of ['plugins', 'themes']) mkdirSync(join(base, name), { recursive: true });
}
