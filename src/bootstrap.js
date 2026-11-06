// Runs in the page's main world before any site script (injected by launcher.mjs).
// The launcher substitutes the payload placeholder below with { debug, plugins: [{ id, src }], themes: [{ id, css }] }.
(() => {
  if (window.top !== window) return;
  const PAYLOAD = __VIXER_PAYLOAD__;
  const SETTINGS_KEY = 'vixer:settings';

  // ---- Data backup: a copy of the mod's data lives in a file on Windows (kept by the launcher). ----
  // Anything missing from the app's storage is restored from it; every later change is sent back. It only adds,
  // updates or removes the exact keys that change, so the platform wiping its storage can never empty the backup.
  // The launcher puts the saved data on the page just before this script, fresh on every load.
  const BACKUP = { path: PAYLOAD.backup?.path || '', savedAt: PAYLOAD.backup?.savedAt || null, data: (() => {
    const d = window.__vxb;
    try { delete window.__vxb; } catch { /* leave it */ }
    return d && typeof d === 'object' ? d : {};
  })() };
  const sendRaw = (() => { // the launcher's one-way channel; take it and leave no global behind
    const f = PAYLOAD.binding ? window[PAYLOAD.binding] : null;
    try { delete window[PAYLOAD.binding]; } catch { /* keep the reference anyway */ }
    return typeof f === 'function' ? f : null;
  })();
  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const prefsInBackup = () => { try { return nativeGet.call(localStorage, 'vixer:plugin:data-backup:opt:includePrefs') !== 'false'; } catch { return true; } };
  const isModKey = (k) => typeof k === 'string' && k.startsWith('vixer:');
  const isPrefKey = (k) => typeof k === 'string' && /^yapper[-:.]/.test(k) && !/(token|auth|session|rum|secret|key|password)/i.test(k);
  const shouldBackUp = (k) => isModKey(k) || (isPrefKey(k) && prefsInBackup());
  let restoredCount = 0;
  let lastSentAt = null;
  try {
    for (const [k, v] of Object.entries(BACKUP.data || {})) {
      if ((isModKey(k) || isPrefKey(k)) && typeof v === 'string' && nativeGet.call(localStorage, k) === null) { nativeSet.call(localStorage, k, v); restoredCount++; }
    }
  } catch { /* storage unavailable: nothing to restore into */ }

  const pendingBackup = { set: {}, del: new Set() };
  let backupTimer = null;
  function flushBackup() {
    backupTimer = null;
    const msg = { set: pendingBackup.set, del: [...pendingBackup.del] };
    pendingBackup.set = {}; pendingBackup.del = new Set();
    if (!sendRaw || (!Object.keys(msg.set).length && !msg.del.length)) return;
    try { sendRaw(JSON.stringify(msg)); lastSentAt = Date.now(); } catch { /* launcher not listening */ }
  }
  const queueBackup = () => { if (!backupTimer) backupTimer = setTimeout(flushBackup, 1200); };
  Storage.prototype.setItem = function (k, v) {
    nativeSet.call(this, k, v); // behaves exactly as before, including quota errors
    try { if (this === localStorage && shouldBackUp(k)) { pendingBackup.set[k] = String(v); pendingBackup.del.delete(k); queueBackup(); } } catch { /* backup must never break the site */ }
  };
  Storage.prototype.removeItem = function (k) {
    nativeRemove.call(this, k);
    try { if (this === localStorage && shouldBackUp(k)) { delete pendingBackup.set[k]; pendingBackup.del.add(k); queueBackup(); } } catch { /* as above */ }
  };
  // Not hooked on purpose: localStorage.clear(). A wipe should leave the backup alone so everything can come back.
  function snapshotAll() {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (shouldBackUp(k)) pendingBackup.set[k] = nativeGet.call(localStorage, k); } } catch { /* ignore */ }
    flushBackup();
  }
  setTimeout(snapshotAll, 3000); // first run: save what is already there
  window.addEventListener('pagehide', flushBackup);
  const backupApi = {
    info: () => {
      let keys = 0; let bytes = 0;
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (shouldBackUp(k)) { keys++; bytes += k.length + (nativeGet.call(localStorage, k) || '').length; } } } catch { /* ignore */ }
      return { path: BACKUP.path, connected: !!sendRaw, savedAt: BACKUP.savedAt, restored: restoredCount, lastSentAt, keys, bytes, includePrefs: prefsInBackup(), inBackup: Object.keys(BACKUP.data || {}).length };
    },
    now: snapshotAll,
    // Put everything from the file back, overwriting what is in the app now.
    restoreAll: () => {
      let n = 0;
      for (const [k, v] of Object.entries(BACKUP.data || {})) if ((isModKey(k) || isPrefKey(k)) && typeof v === 'string') { nativeSet.call(localStorage, k, v); n++; }
      return n;
    },
  };

  const readSettings = () => {
    try { return { plugins: {}, themes: {}, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { plugins: {}, themes: {} }; }
  };
  const writeSettings = (s) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ } };
  const settings = readSettings();

  // ---- Add-ons made inside the app. They live in local storage (so they are in the data backup too) and are merged
  // with the ones the launcher found in the add-on folders. An add-on made here replaces a file add-on with the same id. ----
  const API_VERSION = 1;
  const ADDON_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const MAX_ADDON_BYTES = 500 * 1024;
  const USER_THEMES_KEY = 'vixer:user:themes';
  const USER_PLUGINS_KEY = 'vixer:user:plugins';
  const readUserMap = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
  const writeUserMap = (key, map) => { try { localStorage.setItem(key, JSON.stringify(map)); return true; } catch { return false; } };
  const userThemes = readUserMap(USER_THEMES_KEY);
  const userPlugins = readUserMap(USER_PLUGINS_KEY);
  const upsert = (list, entry) => { const i = list.findIndex((x) => x.id === entry.id); if (i >= 0) list[i] = entry; else list.push(entry); };
  for (const [id, css] of Object.entries(userThemes)) if (ADDON_ID.test(id) && typeof css === 'string') upsert(PAYLOAD.themes, { id, css, user: true });
  for (const [id, src] of Object.entries(userPlugins)) if (ADDON_ID.test(id) && typeof src === 'string') upsert(PAYLOAD.plugins, { id, src, user: true });
  const loadErrors = new Map(); // add-on id -> what went wrong, so its author can see it

  // Part of Vortex itself (settings, fixes, updates), so these are always on and cannot be switched off. Everything else is opt-in:
  // a mod that changes things by default surprises people. Most required plugins are also "sealed" (no switch) because turning one off
  // could lock you out of the very Settings you would need to turn things back on.
  const REQUIRED = new Set(['vixer-settings', 'settings-overhaul', 'settings-pages', 'ui-enhancements', 'auto-update', 'welcome-notice', 'helper-support']);
  const pluginOn = (id) => REQUIRED.has(id) || settings.plugins[id] === true; // plugins are off until turned on (existing installs are migrated below)
  const themeOn = (id) => settings.themes[id] === true || (settings.themes[id] === undefined && themeDefaults.has(id)); // off unless a theme asks for @default on
  const themeDefaults = new Set(PAYLOAD.themes.filter((t) => /@default[ \t]+on\b/.test(/^\s*\/\*([\s\S]*?)\*\//.exec(t.css)?.[1] ?? '')).map((t) => t.id));

  // One-time switch to "everything off by default". Anyone who already used Vortex keeps exactly what they have now:
  // plugins that were on by default are written down as on, and so are the two themes that used to be on by default.
  if (!settings.defaultsV2) {
    let existing = false;
    try { for (let i = 0; i < localStorage.length; i++) { const k = String(localStorage.key(i)); if (k.startsWith('vixer:') && k !== SETTINGS_KEY) { existing = true; break; } } } catch { /* storage blocked */ }
    if (existing || Object.keys(settings.plugins).length || Object.keys(settings.themes).length) {
      for (const p of PAYLOAD.plugins) if (settings.plugins[p.id] === undefined) settings.plugins[p.id] = true;
      for (const id of ['refresh', 'panels']) if (settings.themes[id] === undefined) settings.themes[id] = true;
    }
    settings.defaultsV2 = true; writeSettings(settings);
  }

  // ---- Module registry and patching: intercept Turbopack chunk registrations before the runtime sees them ----
  const patches = [];
  const nativeToString = Function.prototype.toString;
  const moduleExports = new Map();
  const moduleWatchers = new Set();
  function recordModule(id, ctx) {
    const exp = ctx && ctx.e;
    if (!exp || typeof exp !== 'object') return;
    moduleExports.set(id, exp);
    for (const cb of moduleWatchers) { try { cb(exp, id); } catch (err) { console.warn('[vixer] module watcher failed', err); } }
  }
  const hasProps = (exp, names) => { try { return names.every((n) => n in exp); } catch { return false; } };
  const modules = {
    all: () => [...moduleExports.values()],
    find: (pred) => { for (const exp of moduleExports.values()) { try { if (pred(exp)) return exp; } catch { /* getter threw */ } } return null; },
    findByProps: (...names) => modules.find((exp) => hasProps(exp, names)),
    onModule: (cb) => { moduleWatchers.add(cb); return () => moduleWatchers.delete(cb); },
    store: () => modules.findByProps('useStore', 'setState'),
  };

  function patchFactory(fn, id) {
    let src = null;
    let out = null;
    if (patches.length) {
      try { src = nativeToString.call(fn); } catch { src = null; }
      out = src;
      if (src) for (const p of patches) {
        const hit = typeof p.find === 'string' ? out.includes(p.find) : p.find.test(out);
        if (hit) out = out.replace(p.find, p.replace);
      }
    }
    let target = fn;
    if (src && out !== src) {
      try { target = (0, eval)(`(${out})`); } catch (err) { console.warn('[vixer] patch failed to compile, using original', err); }
    }
    return function (ctx) {
      const result = target.apply(this, arguments);
      try { recordModule(id, ctx); } catch { /* recording must never break the site */ }
      return result;
    };
  }
  function patchEntry(entry) {
    if (Array.isArray(entry)) {
      for (let i = 0; i < entry.length; i++) {
        if (typeof entry[i] === 'function') entry[i] = patchFactory(entry[i], typeof entry[i - 1] === 'number' || typeof entry[i - 1] === 'string' ? entry[i - 1] : `anon:${i}`);
      }
    }
    return entry;
  }
  function hookPushable(target) {
    const push = target.push;
    target.push = function (...entries) { return push.apply(this, entries.map(patchEntry)); };
    return target;
  }
  // The runtime drains the pre-seeded array, then assigns its own { push }; catch both.
  let turbopack = window.TURBOPACK;
  if (turbopack === undefined) turbopack = [];
  if (Array.isArray(turbopack)) {
    turbopack.forEach(patchEntry);
    hookPushable(turbopack);
  }
  Object.defineProperty(window, 'TURBOPACK', {
    configurable: true,
    get: () => turbopack,
    set: (v) => { if (v && typeof v.push === 'function') hookPushable(v); turbopack = v; },
  });

  if (PAYLOAD.debug) Object.defineProperty(window, '__vixer', { value: { modules, moduleExports }, configurable: true });

  // ---- Styles, themes ----
  const known = new Map(); // every defined plugin, enabled or not
  const plugins = new Map(); // enabled plugins only
  const styleEls = new Map();
  const pages = new Map(); // settings pages added by plugins
  const pageWatchers = new Set();
  const log = (...a) => console.debug('[vixer]', ...a);

  function addStyle(key, css) {
    let el = styleEls.get(key);
    if (!el) { el = document.createElement('style'); el.dataset.vixer = key; styleEls.set(key, el); }
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
    return () => { el.remove(); styleEls.delete(key); };
  }
  const removeStyle = (key) => { styleEls.get(key)?.remove(); styleEls.delete(key); };

  // Themes can start with a comment block: /* @name Dracula  @description ...  @author ...  @type base|overlay */
  function themeMeta(t) {
    const head = /^\s*\/\*([\s\S]*?)\*\//.exec(t.css)?.[1] ?? '';
    const tag = (n) => new RegExp(`@${n}[ \\t]+([^\\n@]+)`).exec(head)?.[1].trim();
    const color = (v) => new RegExp(`${v}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(t.css)?.[1];
    return {
      id: t.id,
      name: tag('name') ?? t.id,
      description: tag('description') ?? '',
      author: tag('author') ?? '',
      type: tag('type') === 'overlay' ? 'overlay' : 'base',
      version: tag('version') ?? '',
      website: tag('website') ?? '',
      user: !!t.user,
      swatch: ['--bg-rail', '--bg-side', '--bg-main', '--accent'].map(color).filter(Boolean),
    };
  }
  const themeList = PAYLOAD.themes.map(themeMeta);
  function setTheme(id, on) {
    const meta = themeList.find((t) => t.id === id);
    const t = PAYLOAD.themes.find((x) => x.id === id);
    if (!meta || !t) return;
    if (on && meta.type === 'base') {
      for (const other of themeList) if (other.type === 'base' && other.id !== id && themeOn(other.id)) { settings.themes[other.id] = false; removeStyle(`theme:${other.id}`); }
    }
    settings.themes[id] = !!on;
    writeSettings(settings);
    if (on) addStyle(`theme:${id}`, t.css); else removeStyle(`theme:${id}`);
  }

  // ---- Plugin options ----
  const optKey = (id, k) => `vixer:plugin:${id}:opt:${k}`;
  function getOption(id, k) {
    const spec = known.get(id)?.options?.[k];
    try { const v = localStorage.getItem(optKey(id, k)); if (v !== null) return JSON.parse(v); } catch { /* fall through */ }
    return spec?.default;
  }
  function setOption(id, k, v) {
    try { localStorage.setItem(optKey(id, k), JSON.stringify(v)); } catch { /* storage blocked */ }
    try { known.get(id)?.onOptionChange?.(k, v); } catch (err) { console.warn(`[vixer] ${id}.onOptionChange failed`, err); }
  }

  // ---- Right-click menus: plugins add entries to the site's own menu (one menu, not two) with api.menu.add(fn). ----
  // fn({ target, menu }) runs once for each menu that opens; target is the element that was right-clicked.
  const menuHandlers = new Map(); // fn -> plugin id
  let lastCtx = null;
  document.addEventListener('contextmenu', (e) => { lastCtx = { target: e.target instanceof Element ? e.target : null, at: Date.now() }; }, true);
  let menuQueued = false;
  const menuWatcher = new MutationObserver(() => {
    if (menuQueued || !lastCtx || Date.now() - lastCtx.at > 1500) return;
    menuQueued = true;
    requestAnimationFrame(() => {
      menuQueued = false;
      const menu = document.querySelector('.ctx-menu:not([data-vx-menu])');
      if (!menu || !lastCtx?.target) return;
      menu.dataset.vxMenu = '1';
      for (const [fn, pid] of menuHandlers) { try { fn({ target: lastCtx.target, menu }); } catch (err) { console.warn(`[vixer] menu handler of ${pid} failed`, err); } }
      requestAnimationFrame(() => { // keep the (now longer) menu on screen
        const room = innerHeight - 16;
        if (menu.scrollHeight > room) { menu.style.maxHeight = `${room}px`; menu.style.overflowY = 'auto'; }
        const bottom = menu.offsetTop + menu.offsetHeight;
        if (bottom > innerHeight - 8) menu.style.top = `${Math.max(8, innerHeight - 8 - menu.offsetHeight)}px`;
      });
    });
  });
  // This script runs before the page exists, so there is nothing to watch yet; start once the page has been created.
  const watchMenus = () => menuWatcher.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) watchMenus(); else document.addEventListener('DOMContentLoaded', watchMenus, { once: true });
  const menuItem =(menu, { label, icon = '', onClick, danger = false }) => {
    const btn = document.createElement('button');
    btn.setAttribute('role', 'menuitem'); if (danger) btn.className = 'danger';
    const span = document.createElement('span'); span.textContent = String(label);
    btn.append(span);
    if (icon) { const wrap = document.createElement('span'); wrap.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`; btn.append(wrap.firstChild); }
    btn.addEventListener('click', () => {
      // Close the site's menu first. Escape would also close anything the action opens (a dialog, say), so the action runs after it.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      setTimeout(() => { if (menu.isConnected) document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }, 60);
      onClick?.();
    });
    const anchor = menu.querySelector('button.danger');
    if (anchor) menu.insertBefore(btn, anchor); else menu.append(btn);
    return btn;
  };

  function makeApi(id) {
    const ns = `vixer:plugin:${id}:`;
    return {
      log: (...a) => log(`[${id}]`, ...a),
      addStyle: (css) => addStyle(`plugin:${id}`, css),
      storage: {
        get: (k, d) => { try { const v = localStorage.getItem(ns + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
        set: (k, v) => { try { localStorage.setItem(ns + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
      },
      options: { get: (k) => getOption(id, k), set: (k, v) => setOption(id, k, v) },
      settings: {
        addPage: (page) => {
          pages.set(`${id}:${page.id}`, { ...page, key: `${id}:${page.id}` });
          for (const cb of pageWatchers) cb();
          return () => { pages.delete(`${id}:${page.id}`); for (const cb of pageWatchers) cb(); };
        },
      },
      modules,
      backup: backupApi,
      appVersion: String(PAYLOAD.appVersion ?? ''),
      menu: {
        add: (fn) => { if (typeof fn === 'function') menuHandlers.set(fn, id); return () => menuHandlers.delete(fn); },
        item: menuItem,
      },
      // A narrow line to the launcher: send({host:'update', op:'check'|'apply', id}); answers arrive through on(cb).
      host: {
        send: (msg) => {
          if (!sendRaw || !msg) return false;
          try {
            if (msg.host === 'update') { sendRaw(JSON.stringify({ host: 'update', op: msg.op === 'apply' ? 'apply' : 'check', id: Number(msg.id) || 0 })); return true; }
            if (msg.host === 'media') {
              const op = String(msg.op);
              if (!['state', 'play', 'pause', 'toggle', 'next', 'prev', 'seek', 'shuffle', 'repeat'].includes(op)) return false;
              const out = { host: 'media', op, id: Number(msg.id) || 0, filter: msg.filter === 'any' ? 'any' : 'spotify' };
              if (op === 'state') out.art = msg.art === true;
              if (op === 'seek') { const v = Number(msg.value); if (!Number.isFinite(v) || v < 0 || v > 86400) return false; out.value = v; }
              if (op === 'shuffle') { if (typeof msg.value !== 'boolean') return false; out.value = msg.value; }
              if (op === 'repeat') { if (!['none', 'track', 'list'].includes(msg.value)) return false; out.value = msg.value; }
              sendRaw(JSON.stringify(out)); return true;
            }
            if (msg.host === 'tenor') {
              if (msg.op === 'home') { sendRaw(JSON.stringify({ host: 'tenor', op: 'home', id: Number(msg.id) || 0 })); return true; }
              const q = String(msg.q ?? '').trim();
              if (!q || q.length > 80) return false;
              sendRaw(JSON.stringify({ host: 'tenor', op: 'search', id: Number(msg.id) || 0, q })); return true;
            }
            if (msg.host === 'titlebar' && ['minimize', 'maximize', 'close', 'topmost-on', 'topmost-off'].includes(msg.action)) { sendRaw(JSON.stringify({ host: 'titlebar', action: msg.action })); return true; }
            if (msg.host === 'titlebar' && typeof msg.hide === 'boolean') { sendRaw(JSON.stringify({ host: 'titlebar', hide: msg.hide })); return true; }
            if (msg.host === 'titlebar' && /^#[0-9a-f]{6}$/i.test(String(msg.color))) { sendRaw(JSON.stringify({ host: 'titlebar', color: String(msg.color).toLowerCase() })); return true; }
          } catch { /* the launcher is gone */ }
          return false;
        },
        on: (cb, kind = 'update') => { const f = (e) => { if (e.detail && e.detail.host === kind) cb(e.detail); }; window.addEventListener('vixer:host', f); return () => window.removeEventListener('vixer:host', f); },
      },
      version: API_VERSION,
      // Tools for making, importing and sharing add-ons without touching any files.
      addons: {
        idOk: (id) => ADDON_ID.test(id),
        errors: () => Object.fromEntries(loadErrors),
        listUser: () => ({ themes: Object.keys(userThemes), plugins: Object.keys(userPlugins) }),
        isUser: (kind, id) => (kind === 'theme' ? id in userThemes : id in userPlugins),
        getSource: (kind, id) => (kind === 'theme'
          ? (userThemes[id] ?? PAYLOAD.themes.find((t) => t.id === id)?.css ?? null)
          : (userPlugins[id] ?? PAYLOAD.plugins.find((p) => p.id === id)?.src ?? null)),
        // Compiles the code without running it, so a typo is reported before anything is saved.
        checkPlugin: (src) => { try { new Function('definePlugin', src); return null; } catch (e) { return String(e?.message ?? e); } },
        preview: (css) => { if (css) addStyle('theme:preview', css); else removeStyle('theme:preview'); },
        saveTheme: (id, css) => {
          if (!ADDON_ID.test(id)) return { ok: false, error: 'Use a short name with lowercase letters, numbers and dashes, such as my-theme.' };
          if (typeof css !== 'string' || !css.trim()) return { ok: false, error: 'The theme is empty.' };
          if (css.length > MAX_ADDON_BYTES) return { ok: false, error: 'That theme is too large (500 KB limit).' };
          userThemes[id] = css;
          if (!writeUserMap(USER_THEMES_KEY, userThemes)) return { ok: false, error: 'Could not save: local storage is full or blocked.' };
          const entry = { id, css, user: true };
          upsert(PAYLOAD.themes, entry);
          const meta = themeMeta(entry); const at = themeList.findIndex((t) => t.id === id);
          if (at >= 0) themeList[at] = meta; else themeList.push(meta);
          if (themeOn(id)) addStyle(`theme:${id}`, css);
          return { ok: true };
        },
        deleteTheme: (id) => {
          delete userThemes[id]; writeUserMap(USER_THEMES_KEY, userThemes);
          const pi = PAYLOAD.themes.findIndex((t) => t.id === id); if (pi >= 0) PAYLOAD.themes.splice(pi, 1);
          const ti = themeList.findIndex((t) => t.id === id); if (ti >= 0) themeList.splice(ti, 1);
          removeStyle(`theme:${id}`); delete settings.themes[id]; writeSettings(settings);
          return { ok: true };
        },
        savePlugin: (id, src) => {
          if (!ADDON_ID.test(id)) return { ok: false, error: 'Use a short name with lowercase letters, numbers and dashes, such as my-plugin.' };
          if (typeof src !== 'string' || !src.trim()) return { ok: false, error: 'The plugin is empty.' };
          if (src.length > MAX_ADDON_BYTES) return { ok: false, error: 'That plugin is too large (500 KB limit).' };
          const bad = (() => { try { new Function('definePlugin', src); return null; } catch (e) { return String(e?.message ?? e); } })();
          if (bad) return { ok: false, error: `The code has a mistake: ${bad}` };
          userPlugins[id] = src;
          if (!writeUserMap(USER_PLUGINS_KEY, userPlugins)) return { ok: false, error: 'Could not save: local storage is full or blocked.' };
          upsert(PAYLOAD.plugins, { id, src, user: true });
          loadErrors.delete(id);
          return { ok: true, needsReload: true };
        },
        deletePlugin: (id) => {
          delete userPlugins[id]; writeUserMap(USER_PLUGINS_KEY, userPlugins);
          const pi = PAYLOAD.plugins.findIndex((p) => p.id === id); if (pi >= 0) PAYLOAD.plugins.splice(pi, 1);
          loadErrors.delete(id); delete settings.plugins[id]; writeSettings(settings);
          return { ok: true, needsReload: true };
        },
      },
      manager: {
        listPlugins: () => PAYLOAD.plugins.map(({ id: pid, user }) => {
          const def = known.get(pid);
          const options = Object.entries(def?.options ?? {}).map(([key, spec]) => ({ key, ...spec, value: getOption(pid, key) }));
          return { id: pid, name: def?.name ?? pid, description: def?.description ?? '', authors: def?.authors ?? '', tags: Array.isArray(def?.tags) ? def.tags : [], enabled: pluginOn(pid), required: REQUIRED.has(pid), options, user: !!user, error: loadErrors.get(pid) ?? null, loaded: known.has(pid) };
        }),
        listThemes: () => themeList.map((t) => ({ ...t, enabled: themeOn(t.id) })),
        listPages: () => [...pages.values()],
        onPagesChange: (cb) => { pageWatchers.add(cb); return () => pageWatchers.delete(cb); },
        setPlugin: (pid, on) => { if (REQUIRED.has(pid)) return; settings.plugins[pid] = !!on; writeSettings(settings); },
        setOption,
        setTheme,
        reload: () => location.reload(),
      },
    };
  }

  function registerPlugin(id, def) {
    known.set(id, def);
    if (!pluginOn(id)) return;
    plugins.set(id, { id, def, started: false });
    for (const p of def.patches || []) patches.push({ pluginId: id, find: p.find, replace: p.replace });
  }

  // A broken add-on must never take the others down: each one loads and starts on its own, and what went wrong is kept
  // so its author can read it in Settings.
  for (const { id, src } of PAYLOAD.plugins) {
    try {
      const definePlugin = (def) => {
        if (!def || typeof def !== 'object') throw new TypeError('definePlugin() needs an object, for example definePlugin({ name: "My plugin", start(api) {} })');
        registerPlugin(id, { name: id, description: '', ...def });
      };
      new Function('definePlugin', src)(definePlugin);
      if (!known.has(id)) loadErrors.set(id, 'The file ran but never called definePlugin({ ... }).');
    } catch (err) { loadErrors.set(id, String(err?.message ?? err)); console.warn(`[vixer] plugin ${id} failed to load`, err); }
  }

  function startAll() {
    // The title bar stays hidden only while NoTitleBar is on: when it is off (or was just turned off) put the bar back.
    if (!pluginOn('no-title-bar')) { try { sendRaw(JSON.stringify({ host: 'titlebar', hide: false })); } catch { /* no launcher */ } }
    for (const t of themeList) if (themeOn(t.id)) addStyle(`theme:${t.id}`, PAYLOAD.themes.find((x) => x.id === t.id).css);
    for (const entry of plugins.values()) {
      if (entry.started) continue;
      try { entry.def.start?.(makeApi(entry.id)); entry.started = true; } catch (err) { loadErrors.set(entry.id, `start() failed: ${String(err?.message ?? err)}`); console.warn(`[vixer] plugin ${entry.id} start failed`, err); }
    }
  }

  // ---- Fallback settings panel (Ctrl+Shift+V), independent of the site's UI. Shadow DOM keeps it isolated. ----
  let panel = null;
  function buildPanel() {
    const api = makeApi('core');
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .wrap{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0008;font:14px/1.4 system-ui,sans-serif}
      .card{width:min(520px,92vw);max-height:80vh;overflow:auto;background:#222329;color:#ececf1;border:1px solid #ffffff1f;border-radius:12px;padding:20px}
      h2{margin:0 0 4px;font-size:18px}h3{margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#a6a7b4}
      label{display:flex;gap:10px;align-items:flex-start;padding:6px 0}small{display:block;color:#a6a7b4}
      button{background:#5865f2;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;margin-right:8px}
      button.alt{background:#383944}
    </style><div class="wrap"><div class="card"><h2>Vortex</h2><small>Plugin changes apply after a reload; themes apply live.</small><div id="body"></div>
    <div style="margin-top:16px"><button id="reload">Reload</button><button class="alt" id="close">Close</button></div></div></div>`;
    const body = root.getElementById('body');
    const section = (title, items, onToggle) => {
      const h = document.createElement('h3'); h.textContent = title; body.appendChild(h);
      if (!items.length) { const s = document.createElement('small'); s.textContent = 'None installed.'; body.appendChild(s); return; }
      for (const it of items) {
        const l = document.createElement('label');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = it.enabled;
        cb.addEventListener('change', () => onToggle(it.id, cb.checked));
        const t = document.createElement('span'); t.textContent = it.name;
        if (it.description) { const s = document.createElement('small'); s.textContent = it.description; t.appendChild(s); }
        l.append(cb, t); body.appendChild(l);
      }
    };
    section('Plugins', api.manager.listPlugins(), api.manager.setPlugin);
    section('Themes', api.manager.listThemes(), (tid, on) => { api.manager.setTheme(tid, on); });
    root.getElementById('reload').onclick = () => location.reload();
    root.getElementById('close').onclick = () => togglePanel(false);
    host.addEventListener('keydown', (e) => e.stopPropagation());
    return host;
  }
  function togglePanel(force) {
    const open = force ?? !panel;
    if (open && !panel) { panel = buildPanel(); document.documentElement.appendChild(panel); }
    else if (!open && panel) { panel.remove(); panel = null; }
  }
  addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') { e.preventDefault(); togglePanel(); } }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAll, { once: true });
  else startAll();
})();
