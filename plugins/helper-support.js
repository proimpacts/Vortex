// Why: People who hit a problem or have an idea need somewhere to go. The support server is that place, so the first time Vortex runs it offers to
// add you to it. It asks once and remembers the answer: joining a server on someone's account without their say-so is not something a mod should do.
// It is required so every install makes the offer, and it has no settings page of its own.
definePlugin({
  name: 'HelperSupport',
  description: 'Offers to join the Vortex support server the first time you run Vortex, so help is always one click away. It asks once and remembers your answer.',
  authors: 'proimpacts',
  tags: ['Utility'],
  start(api) {
    const CODE = 'Z6TnHq6ZTs';
    const LINK = `https://yapin.gg/invite/${CODE}`;
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const state = () => api.modules.store()?.useStore?.getState?.();
    const fn = (name) => { for (const e of api.modules.all()) { try { if (typeof e[name] === 'function') return e[name]; } catch { /* a getter threw */ } } return null; };

    api.addStyle(`.vx-hs-back{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.6);font-family:var(--font)}
      .vx-hs{width:min(420px,100%);padding:24px;border-radius:14px;background:var(--bg-main);color:var(--text);border:1px solid var(--border);box-shadow:var(--shadow,0 10px 40px #00000073)}
      .vx-hs h3{margin:0 0 8px;font-size:20px}.vx-hs p{margin:0 0 6px;color:var(--text-muted);font-size:14px;line-height:1.55}
      .vx-hs .note{font-size:12.5px;color:var(--text-faint,var(--text-muted))}
      .vx-hs-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
      .vx-hs-foot button{height:38px;padding:0 18px;border:0;border-radius:8px;font:600 14px var(--font);cursor:pointer}
      .vx-hs-foot .go{background:var(--accent-fill,var(--accent));color:#fff}.vx-hs-foot .no{background:var(--bg-hover);color:var(--text)}
      .vx-hs-foot button:disabled{opacity:.6;cursor:default}`);

    function offer() {
      const back = mk('div', 'vx-hs-back'); const dlg = mk('div', 'vx-hs'); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'Vortex support server');
      const msg = mk('p', '', 'Get help, report problems and hear about new versions in the Vortex support server. Joining is your choice, and you can leave any time.');
      const note = mk('p', 'note', `Invite: ${LINK}`);
      const go = mk('button', 'go', 'Join'); go.type = 'button'; const no = mk('button', 'no', 'No thanks'); no.type = 'button';
      const foot = mk('div', 'vx-hs-foot'); foot.append(no, go);
      dlg.append(mk('h3', '', 'Join the Vortex support server?'), msg, note, foot); back.append(dlg); document.documentElement.append(back);
      const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
      const decline = () => { api.storage.set('asked', true); close(); };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); decline(); } };
      document.addEventListener('keydown', onKey, true);
      no.onclick = decline;
      go.onclick = async () => {
        const join = fn('joinServer');
        if (!join) { msg.textContent = 'Could not join from here. Open the invite link in your browser instead.'; return; }
        go.disabled = no.disabled = true; msg.textContent = 'Joining…';
        try { await join(CODE); api.storage.set('asked', true); msg.textContent = 'You are in. Welcome!'; setTimeout(close, 1400); }
        catch (e) {
          if (/already/i.test(String(e?.message ?? e))) { api.storage.set('asked', true); msg.textContent = 'You are already in the server.'; setTimeout(close, 1400); return; }
          msg.textContent = 'Could not join right now. You can try again next time Vortex starts, or use the invite link.'; go.disabled = no.disabled = false;
        }
      };
    }

    // Wait until someone is logged in and the app has loaded, then ask (once).
    if (api.storage.get('asked', false)) return;
    let tries = 0;
    const timer = setInterval(() => {
      const s = state();
      if (s?.userId && s.servers && Object.keys(s.servers).length >= 0 && fn('joinServer')) { clearInterval(timer); setTimeout(() => { if (!api.storage.get('asked', false) && !document.querySelector('.vx-hs-back')) offer(); }, 4000); }
      else if (++tries > 120) clearInterval(timer);
    }, 1000);
  },
});
