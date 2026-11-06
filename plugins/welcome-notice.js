// Why: People should know what plugins can do before they use them. A short notice on the first run says so once and then stays out of the way.
definePlugin({
  name: 'WelcomeNotice',
  description: 'Shows a short heads-up the first time Vortex opens, about Yapin’s Terms of Service and how plugins are kept in check.',
  authors: 'proimpacts',
  tags: ['Utility'],
  start(api) {
    const VERSION = '1'; // raise this if the wording ever changes in a way people should see again
    if (api.storage.get('seen', '') === VERSION) return;
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

    api.addStyle(`
      .vx-wn-back{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.6);font-family:var(--font)}
      .vx-wn{width:min(480px,100%);box-sizing:border-box;padding:24px;border-radius:14px;background:var(--bg-main);color:var(--text);border:1px solid var(--border);box-shadow:var(--shadow,0 10px 40px #00000073)}
      .vx-wn h2{margin:0 0 12px;font-size:22px}
      .vx-wn p{margin:0 0 12px;font-size:15px;line-height:1.5;color:var(--text)}
      .vx-wn p.muted{color:var(--text-muted);font-size:14px}
      .vx-wn-foot{display:flex;justify-content:flex-end;margin-top:18px}
      .vx-wn-ok{height:40px;padding:0 22px;border:0;border-radius:8px;background:var(--accent-fill,var(--accent));color:#fff;font:700 15px var(--font);cursor:pointer}
      .vx-wn-ok:hover{filter:brightness(1.08)}
      .vx-wn-ok:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    `);

    let back = null;
    function show() {
      if (back || !document.body) return;
      back = mk('div', 'vx-wn-back');
      const dlg = mk('div', 'vx-wn'); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Before you start');
      dlg.append(
        mk('h2', '', 'Before you start'),
        mk('p', '', 'Hey, using Vortex technically goes against Yapin’s Terms of Service, but it does make the platform much better.'),
        mk('p', '', 'The plugins that come with Vortex are designed to stay clear of the most serious parts of those terms. They only talk to Yapin itself (and to GitHub, for updates), and none of them sends your messages or your login anywhere else.'),
        mk('p', 'muted', 'Plugins you add yourself can do anything, including read your messages, so only install ones you wrote or trust.'),
      );
      const ok = mk('button', 'vx-wn-ok', 'I understand'); ok.type = 'button';
      ok.onclick = () => { api.storage.set('seen', VERSION); back.remove(); back = null; };
      const foot = mk('div', 'vx-wn-foot'); foot.append(ok); dlg.append(foot);
      back.append(dlg); document.body.append(back); ok.focus();
    }
    // wait until the app has opened (and the page has a body), so it does not flash over the loading screen
    const when = () => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(show, 1500), { once: true }) : setTimeout(show, 1500));
    when();
  },
});
