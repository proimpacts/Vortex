// Why: People should not have to re-download the project by hand, but the download is code that then runs on their PC. So every step is checked and reversible (see src/updater.mjs), and the update source comes from version.json, never from the page.
definePlugin({
  name: 'AutoUpdate',
  description: 'Keeps Vortex up to date from its public GitHub page. It checks when Vortex starts, tells you when there is a new version, and installs it when you say so (or by itself, if you choose).',
  authors: 'proimpacts',
  tags: ['Utility'],
  options: {
    check: { type: 'select', label: 'Check for updates', choices: ['When Vortex starts', 'Every day', 'Never'], default: 'When Vortex starts' },
    install: { type: 'select', label: 'When an update is found', description: '"Install automatically" downloads and installs it for you. Either way a copy of your current files is saved first, and the new version takes over the next time you start Vortex.', choices: ['Ask me first', 'Install automatically'], default: 'Install automatically' },
  },
  start(api) {
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const DAY = 24 * 3600 * 1000;
    const st = { status: 'idle', result: null, error: '', checkedAt: api.storage.get('checkedAt', 0), applied: null };
    let reqId = 0, activeId = 0, timer = null, redraw = null, toast = null;

    function request(op) {
      activeId = ++reqId;
      st.status = op === 'apply' ? 'updating' : 'checking'; st.error = '';
      if (!api.host?.send({ host: 'update', op, id: activeId })) {
        st.status = 'error'; st.error = 'Updates need the Vortex launcher (npm start) to be running.';
      }
      clearTimeout(timer);
      if (st.status !== 'error') timer = setTimeout(() => { if (st.status === 'checking' || st.status === 'updating') { st.status = 'error'; st.error = 'No answer from the launcher. Try again.'; ui(); } }, op === 'apply' ? 120000 : 30000);
      ui();
    }

    api.host?.on((d) => {
      if (d.id !== activeId) return;
      clearTimeout(timer);
      if (d.op === 'check') {
        st.checkedAt = Date.now(); api.storage.set('checkedAt', st.checkedAt);
        if (!d.ok) { st.status = 'error'; st.result = d.code === 'no-repo' ? d : null; st.error = d.error || 'The check failed.'; if (d.code === 'no-repo') st.status = 'norepo'; }
        else { st.result = d; st.status = d.newer ? 'available' : 'current'; }
        if (st.status === 'available') {
          if (api.options.get('install') === 'Install automatically') request('apply');
          else if (api.storage.get('dismissed', '') !== d.latest) showToast(d);
        }
      } else if (d.op === 'apply') {
        if (d.ok) { st.status = 'done'; st.applied = d; removeToast(); showToast(d, true); }
        else { st.status = 'error'; st.error = d.error || 'The update failed.'; }
      }
      ui();
    });

    // ---- A small notice in the corner ----
    api.addStyle(`
      .vixer-update-toast{position:fixed;right:18px;bottom:18px;z-index:2147482500;width:min(340px,calc(100vw - 36px));box-sizing:border-box;padding:14px 16px;border-radius:12px;background:var(--bg-side);color:var(--text);border:1px solid var(--border);box-shadow:var(--shadow,0 10px 40px #00000073);font:14px/1.45 var(--font)}
      .vixer-update-toast b{display:block;font-size:15px;margin-bottom:2px}
      .vixer-update-toast p{margin:0 0 12px;color:var(--text-muted);font-size:13px}
      .vixer-update-toast .row{display:flex;gap:8px;justify-content:flex-end}
      .vixer-update-toast button{padding:7px 14px;border:0;border-radius:6px;font:600 13px var(--font);cursor:pointer}
      .vixer-update-toast .go{background:var(--accent-fill,var(--accent));color:#fff}
      .vixer-update-toast .later{background:transparent;color:var(--text-muted)}
      .vixer-update-toast .later:hover{color:var(--text)}
    `);
    function removeToast() { toast?.remove(); toast = null; }
    function showToast(d, done) {
      removeToast();
      toast = mk('div', 'vixer-update-toast'); toast.setAttribute('role', 'status');
      const row = mk('div', 'row');
      if (done) {
        toast.append(mk('b', '', `Vortex ${d.to} is installed`), mk('p', '', 'Close Yapin and start Vortex again to use it.'));
        const ok = mk('button', 'go', 'OK'); ok.onclick = removeToast; row.append(ok);
      } else {
        toast.append(mk('b', '', `Vortex ${d.latest} is available`), mk('p', '', `You have ${d.current}. Install it now, or do it later from Settings > Vortex > Updates.`));
        const later = mk('button', 'later', 'Later'); later.onclick = () => { api.storage.set('dismissed', d.latest); removeToast(); };
        const go = mk('button', 'go', 'Update now'); go.onclick = () => { removeToast(); request('apply'); };
        row.append(later, go);
      }
      toast.append(row); document.body.append(toast);
    }

    // ---- The settings page ----
    const ago = (t) => { if (!t) return 'not yet'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
    function draw(pane) {
      const cur = api.appVersion || st.result?.current || '';
      pane.replaceChildren(mk('h2', '', 'Updates'), mk('p', 'vixer-sub', 'Vortex updates itself from its public page on GitHub. Only Vortex’s own files are replaced: your settings, saved data and your own plugins and themes are never touched.'));
      const card = mk('div', 'vixer-card');
      const head = mk('div', 'vixer-card-head'); const left = mk('div');
      left.append(mk('b', '', `Vortex ${cur || '(unknown version)'}`));
      const line = mk('small', '');
      const s = st.status;
      line.textContent = s === 'checking' ? 'Checking GitHub…'
        : s === 'updating' ? 'Downloading and installing…'
        : s === 'available' ? `Version ${st.result.latest} is available.`
        : s === 'current' ? `You are on the latest version. Last checked ${ago(st.checkedAt)}.`
        : s === 'done' ? `Updated to ${st.applied?.to}. Close Yapin and start Vortex again to use it.`
        : s === 'norepo' ? 'Updates are not switched on yet: the project’s GitHub address is added when it goes public.'
        : s === 'error' ? st.error
        : `Last checked ${ago(st.checkedAt)}.`;
      left.append(line); head.append(left); card.append(head);

      if (s === 'available' && st.result?.notes) {
        const det = mk('details'); det.style.cssText = 'margin:10px 0 0';
        det.append(mk('summary', '', 'What’s new'));
        const pre = mk('pre', '', st.result.notes); pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;font:13px/1.5 var(--font);color:var(--text-muted);max-height:240px;overflow:auto';
        det.append(pre); card.append(det);
      }
      if (s === 'done' && st.applied?.backup) card.append(mk('p', 'vixer-sub', `Your previous files were saved to: ${st.applied.backup}`));

      const actions = mk('div'); actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0';
      const busy = s === 'checking' || s === 'updating';
      const chk = mk('button', 'vixer-btn ghost', 'Check now'); chk.disabled = busy; chk.onclick = () => request('check');
      if (s === 'available') { const up = mk('button', 'vixer-btn', 'Update now'); up.onclick = () => request('apply'); actions.append(up); }
      actions.append(chk);
      if (st.result?.page && /^https:\/\/github\.com\//.test(st.result.page)) { const a = mk('a', 'vixer-btn ghost', 'View on GitHub'); a.href = st.result.page; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.textDecoration = 'none'; actions.append(a); }
      card.append(actions); pane.append(card);
      const src = st.result?.repo ? `Updates come from github.com/${st.result.repo} (${st.result.channel === 'branch' ? 'latest code on the main branch' : 'official releases'}).` : 'Where updates come from is set in Vortex’s own files (version.json), not in the app window, so nothing on a web page can change it.';
      pane.append(mk('p', 'vixer-sub', src), mk('p', 'vixer-sub', 'Before each update a copy of your current files is saved in the Vortex folder, and if anything goes wrong while installing they are put back.'));
    }
    function ui() { if (redraw) redraw(); }
    api.settings.addPage({
      id: 'updates', label: 'Updates', icon: 'backup',
      render(pane) { redraw = () => { if (!pane.isConnected) { redraw = null; return; } draw(pane); }; draw(pane); },
    });

    // ---- When to look ----
    const maybeCheck = () => {
      const mode = api.options.get('check');
      if (mode === 'Never' || st.status === 'checking' || st.status === 'updating') return;
      if (mode === 'Every day' && Date.now() - st.checkedAt < DAY) return;
      request('check');
    };
    setTimeout(maybeCheck, 5000);                   // shortly after start, once the app has settled
    setInterval(() => { if (api.options.get('check') === 'Every day') maybeCheck(); }, 3600 * 1000);
  },
});
