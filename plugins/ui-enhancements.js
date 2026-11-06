// Why: Small fixes that Vortex relies on (the call panel on the account card, menu colours, the inbox, always-dark mode) live in one required plugin so every install gets them.
// UI Enhancements: the home for small layout and polish fixes to Yapin's own interface.
//
// To add a fix, add one entry to FIXES below: { id, label, description, css }. It gets its own on/off switch in this plugin's
// settings and is on by default. This plugin is required (it cannot be switched off as a whole), so fixes land for everyone.
const FIXES = [
  {
    id: 'callConnected',
    label: 'Voice call panel joined to your account card',
    description: 'The "Voice Connected" panel sits directly on top of your account card as one block, instead of floating above it.',
    css: () => `
      .app:has(.user-bar.floating) .voice-bar{margin:0!important;border-radius:10px 10px 0 0!important;padding:10px 10px 14px!important;background:var(--vx-card-bg,var(--bg-side-solid,var(--bg-side)))!important;box-shadow:none!important;border-bottom:1px solid var(--border)!important}
      .app:has(.voice-bar) .user-bar.floating{border-radius:0 0 10px 10px!important;box-shadow:none!important;background:var(--vx-card-bg,var(--bg-side-solid,var(--bg-side)))!important}
      /* The site fixes the call panel 90px up; sit it exactly on top of the (slimmer) account card instead, and keep the channel list clear of it */
      @media (min-width:761px){
        .app:has(.user-bar.floating) .voice-bar{bottom:calc(var(--vx-ub-h,66px) + 8px)!important}
        .app:has(.user-bar.floating):has(.voice-bar) .sidebar-scroll{padding-bottom:calc(var(--vx-ub-h,66px) + 24px + var(--voice-bar-h,120px))!important}
        .app:has(.user-bar.floating):has(.voice-bar) .rail{padding-bottom:calc(var(--vx-ub-h,66px) + 32px + var(--voice-bar-h,120px))!important}
      }
      /* the big call bar paints a muted mic / deafened headset white; make it red like the small one in the side panel */
      .cc.off[aria-label="Unmute"],.cc.off[aria-label="Undeafen"]{background:rgba(242,85,90,.22)!important;color:rgb(242,100,106)!important}
      .cc.off[aria-label="Unmute"]:hover,.cc.off[aria-label="Undeafen"]:hover{background:rgba(242,85,90,.32)!important}
      .voice-bar .voice-bar-info{padding:2px 4px 8px}
      .voice-bar .voice-status{font-size:14px;font-weight:700}
      .voice-bar .voice-where{font-size:12px;color:var(--text-muted)}
      .voice-bar .clip-note{margin:0 4px 8px;font-size:11px;color:var(--text-faint)}
      /* the big call bar shows a muted mic / deafened headset as plain white; make them red like the small call panel */
      .cc.off[aria-label="Unmute"],.cc.off[title="Unmute"],.cc.off[aria-label="Undeafen"],.cc.off[title="Undeafen"]{background:rgba(242,85,90,.18)!important;color:rgb(242,100,106)!important}
      .cc.off[aria-label="Unmute"]:hover,.cc.off[title="Unmute"]:hover,.cc.off[aria-label="Undeafen"]:hover,.cc.off[title="Undeafen"]:hover{background:rgba(242,85,90,.3)!important}
      .voice-bar .voice-buttons{gap:8px}
      .voice-bar .vb{height:36px;border-radius:8px;transition:background .12s,color .12s}
      .voice-bar .vb svg{width:20px;height:20px}
      .voice-bar .vb.hangup{background:var(--danger);color:#fff}`,
  },
  {
    id: 'callUnclipped',
    label: 'Voice call panel no longer cut off',
    description: 'The panel overlaps the server list so it lines up with your account card; the site clipped its left edge there.',
    css: () => `@media (min-width:761px){.app:has(.voice-bar) .stage{overflow:visible!important}.app:has(.voice-bar) .sidebar{overflow:visible!important}}`,
  },
  {
    id: 'accountMenuOnTop',
    label: 'Account menu above the call panel',
    description: 'The menu that opens from your account card (status, custom status, notification sounds) is drawn over the voice call panel and the music player instead of being cut off underneath them.',
    css: () => `.user-bar.floating:has(.me-pop){z-index:30!important}`,
  },
  {
    id: 'alwaysDark',
    label: 'Always use the dark look',
    description: 'Yapin always uses its dark look, so every theme works the same way and there is nothing to switch. The Dark / Light / System choice in Settings > Appearance is hidden.',
    css: () => `.appearance-page .theme-options,.appearance-page .pe-section:has(+ .theme-options){display:none!important}`,
  },
  {
    id: 'inboxPolish',
    label: 'Roomier inbox with underlined tabs',
    description: 'The inbox opens wider, with the tabs underlined and each item on its own card. With Discord Icons switched on, it also gets the Discord inbox icon.',
    css: () => `.modal.inbox-sheet{width:100%;max-width:min(560px,100%)!important}
      .inbox-sheet .modal-head{padding:18px 20px 4px}
      .inbox-sheet .modal-head h2{display:flex;align-items:center;gap:10px;font-size:20px}
      .inbox-sheet .modal-head h2 svg{width:24px;height:24px;flex:none}
      .inbox-sheet .inbox-bar{margin:6px -20px 12px;padding:0 20px;border-bottom:1px solid var(--border);align-items:flex-end;flex-wrap:nowrap}
      .inbox-sheet .inbox-tabs button{border-radius:0;background:transparent;padding:10px 12px;border-bottom:2px solid transparent;margin-bottom:-1px}
      .inbox-sheet .inbox-tabs button.on{background:transparent;color:var(--text);border-bottom-color:var(--accent)}
      .inbox-sheet .inbox-markall{margin:0 0 6px}
      .inbox-sheet .inbox-list{gap:10px}
      .inbox-sheet .inbox-item{border:1px solid var(--border);border-radius:10px;background:var(--bg-elev);overflow:hidden}
      @media (max-width:600px){.inbox-sheet .inbox-bar{flex-wrap:wrap}.inbox-sheet .inbox-tabs button{flex:1 1 0}}`,
  },
  {
    id: 'noProfileGlow',
    label: 'No glow around profile text',
    description: 'Profiles with a full-screen effect (such as Confetti) make Yapin draw a soft halo around all the text and icons so they stay readable. This turns the halo off, so the text is sharp.',
    css: () => `.pv2[data-pfx-full],.pv2[data-pfx-full] *{text-shadow:none!important}
      .pv2[data-pfx-full] :is(svg,.pv-chips,.pv-btn,.pv-bubble,.avatar,.avatar-clip,.pc2-mini-icon,.pv-sv-icon,.mention,code,pre,kbd,.spoiler,input,textarea,select,.steam-card,.steam-hero){filter:none!important}`,
  },
  {
    id: 'menuColors',
    label: 'Menus use your theme’s panel color',
    description: 'Right-click menus, the status menu, dropdowns, tooltips and notices are drawn in the same panel color as the channel list in whatever theme you picked, instead of a near-black that no theme chose. Yapin’s own tint setting still wins when it is on.',
    css: () => `html .ctx-menu,html .status-menu,html .pc-menu,html .dd-menu,html .disc-menu,html .threads-pop,html .reaction-tip,html .toast,html .me-sub,html .fmt-bar{background:var(--bg-side-solid,var(--bg-side))}
      html .status-menu button .status-dot::after{background:var(--bg-side-solid,var(--bg-side))}`,
  },
  {
    id: 'highlightBars',
    label: 'Flat highlight bars on messages',
    description: 'The colored bar on messages that mention or reply to you, on deleted messages and on keyword matches stays a flat, straight line, like the bars on embeds, instead of curving with the message’s rounded corners.',
    css: () => `.msg.mentioned,.msg.vixer-deleted,.msg.vx-keyword{border-radius:0 var(--r-md,8px) var(--r-md,8px) 0!important}
      .smooth:not(.motion-off) .msg.flash::after{border-radius:0 4px 4px 0!important}`,
  },
];

definePlugin({
  name: 'UIEnhancements',
  description: 'Small fixes and polish for Yapin’s interface, such as the voice call panel joining your account card. New fixes are added here and can be switched off one by one.',
  authors: 'proimpacts',
  tags: ['Appearance', 'Fixes'],
  options: {
    ...Object.fromEntries(FIXES.map((f) => [f.id, { type: 'boolean', label: f.label, description: f.description, default: true }])),
    railTone: { type: 'select', label: 'Server bar color', description: 'The strip with the server icons. "Match the channel list" gives it the same color as the channel list, so the two always fit together in any theme. "A little darker" keeps a soft step. "Theme default" leaves the theme’s own choice.', choices: ['Match the channel list', 'A little darker', 'Theme default'], default: 'Match the channel list' },
    darkTitleBar: { type: 'boolean', label: 'Window title bar matches the app', description: 'Colors the window’s own title bar (the bar with the icon and the minimize, maximize and close buttons) to match your theme instead of white. It follows theme changes. Turning it off puts the normal bar back the next time you start Vortex.', default: true },
  },
  onOptionChange() { window.dispatchEvent(new CustomEvent('vixer:ui-enhancements')); },
  start(api) {
    // ---- Window title bar. The bar is drawn by Windows, so the page asks the launcher (which can reach the window) for a color. ----
    const toHex = (css) => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 1;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.fillStyle = '#000'; g.fillStyle = css; g.clearRect(0, 0, 1, 1); g.fillRect(0, 0, 1, 1);
        const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
        return a < 200 ? null : `#${[r, gr, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      } catch { return null; }
    };
    const pickColor = () => {
      for (const sel of ['.topbar.app-titlebar', '.app', 'body']) {
        const el = document.querySelector(sel);
        const c = el && toHex(getComputedStyle(el).backgroundColor);
        if (c) return c;
      }
      return toHex(getComputedStyle(document.documentElement).getPropertyValue('--bg-rail').trim() || '#1e1f22');
    };
    // ---- Always dark: the page's own switch is the data-theme attribute on <html>, so it is put back whenever something changes it ----
    const holdDark = () => { if (!api.options.get('alwaysDark')) return; const r = document.documentElement; if (r.getAttribute('data-theme') !== 'dark') r.setAttribute('data-theme', 'dark'); };
    holdDark();
    new MutationObserver(holdDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('DOMContentLoaded', holdDark, { once: true });
    let lastBar = '', barTimer = null;
    const syncBar = () => {
      if (!api.options.get('darkTitleBar')) return;
      const c = pickColor();
      if (c && c !== lastBar && api.host?.send({ host: 'titlebar', color: c })) lastBar = c;
    };
    const syncSoon = () => { clearTimeout(barTimer); barTimer = setTimeout(syncBar, 700); };
    setTimeout(syncBar, 1500);
    new MutationObserver(syncSoon).observe(document.head, { childList: true, subtree: true, characterData: true });
    new MutationObserver(syncSoon).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-look', 'class', 'style'] });
    window.addEventListener('focus', syncSoon);
    window.addEventListener('vixer:ui-enhancements', () => { lastBar = ''; holdDark(); syncSoon(); });

    // ---- Server bar tone. Each theme sets the server bar and the channel list colors on their own, and often only a few shades
    // apart, which looks like a mismatch. Here the server bar (and the frame around the main panel and the top strip) is
    // worked out from the channel list's own color, so it fits every theme, including ones people make themselves. ----
    const toneCss = () => {
      const mode = api.options.get('railTone');
      const base = 'var(--bg-side-solid,var(--bg-side))';
      const sel = 'html .app,html .app.ui-refresh,html nav.rail,html .rail-wrap,html .topbar.app-titlebar';
      if (mode === 'Match the channel list') return `/* railTone */${sel}{background:${base}!important}`;
      // Darker, but gently: a dark theme can lose a fifth of its light, a light theme only a few percent (otherwise it turns gray).
      if (mode === 'A little darker') return `/* railTone */${sel}{background:color-mix(in srgb,${base} 80%,#000)!important}\n:root[data-theme=light] :is(.app,.app.ui-refresh,nav.rail,.rail-wrap,.topbar.app-titlebar){background:color-mix(in srgb,${base} 95%,#000)!important}`;
      return '';
    };

    // ---- Plugin surfaces. Themes restyle Yapin's own cards and menus (shape, border, shadow, colour), but a plugin's player, pop-ups and dialogs
    // are not Yapin's own, so they used to keep their default look and clash. Here the look of Yapin's account card and of its menus is read back
    // from whatever theme is on, and plugin surfaces borrow it. That works for every theme, including ones people make themselves. ----
    const SURFACES = `/* pluginSurfaces */
html .vx-spot{background:var(--vx-pc-bg,var(--bg-side-solid,var(--bg-side)))!important;border:var(--vx-pc-border,1px solid var(--border))!important;border-bottom:0!important;border-radius:var(--vx-pc-r,10px) var(--vx-pc-r,10px) 0 0!important;box-shadow:var(--vx-pc-shadow,none)!important}
html :is(.vx-qc,.vx-inbox,.vx-sd,.vx-pv,.vx-ts,.vx-sm,.vx-si,.vx-hs,.vx-wn){background:var(--vx-pop-bg,var(--bg-float))!important;border:var(--vx-pop-border,1px solid var(--border))!important;border-radius:var(--vx-pop-r,12px)!important;box-shadow:var(--vx-pop-shadow,0 10px 40px #00000073)!important;color:var(--text)}
/* Light themes. The page's own dark switch stays on (so every theme's colours apply), but some of Yapin's rules assume a dark page, for example text boxes
   take the server bar colour. On a light theme that gave black boxes with black text, so form fields use the theme's own field colour instead. */
html.vx-light{color-scheme:light}
html.vx-light :is(textarea,select,.input,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit])){background-color:var(--bg-input)!important;color:var(--text)!important;color-scheme:light}`;
    const probe = document.createElement('div');
    probe.className = 'ctx-menu'; probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;pointer-events:none;animation:none;transition:none';
    document.documentElement.append(probe);
    const lightProbe = document.createElement('div'); // reads the theme's main background, to tell a light theme from a dark one
    lightProbe.setAttribute('aria-hidden', 'true'); lightProbe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;background:var(--bg-main)';
    document.documentElement.append(lightProbe);
    const opaque = (c) => !!c && !/^rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent';
    const edge = (cs) => (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : 'none');
    const setVar = (k, v) => { const r = document.documentElement.style; if (r.getPropertyValue(k) !== v) r.setProperty(k, v); };
    function syncSurfaces() {
      try {
        const lm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(lightProbe).backgroundColor);
        if (lm) document.documentElement.classList.toggle('vx-light', (0.2126 * lm[1] + 0.7152 * lm[2] + 0.0722 * lm[3]) / 255 > 0.6);
        const pc = getComputedStyle(probe);
        setVar('--vx-pop-bg', opaque(pc.backgroundColor) ? pc.backgroundColor : 'var(--bg-float)');
        setVar('--vx-pop-border', edge(pc)); setVar('--vx-pop-r', pc.borderTopLeftRadius);
        setVar('--vx-pop-shadow', pc.boxShadow && pc.boxShadow !== 'none' ? pc.boxShadow : '0 10px 40px #00000073');
        const ub = document.querySelector('.user-bar.floating');
        if (ub) {
          const u = getComputedStyle(ub);
          setVar('--vx-pc-bg', opaque(u.backgroundColor) ? u.backgroundColor : 'var(--bg-side-solid,var(--bg-side))');
          setVar('--vx-pc-border', edge(u)); setVar('--vx-pc-r', u.borderTopLeftRadius); setVar('--vx-pc-shadow', u.boxShadow || 'none');
        }
      } catch { /* leave the defaults */ }
    }
    let surfQueued = false;
    const surfSoon = () => { if (surfQueued) return; surfQueued = true; setTimeout(() => { surfQueued = false; syncSurfaces(); }, 120); };
    new MutationObserver(surfSoon).observe(document.head, { childList: true, subtree: true, characterData: true });
    setInterval(syncSurfaces, 2000); // a theme can change several things at once; this also catches changes that leave the page's styles alone
    syncSurfaces();

    let off = null;
    const apply = () => {
      off?.();
      const css = [...FIXES.filter((f) => api.options.get(f.id)).map((f) => `/* ${f.id} */${f.css()}`), toneCss(), SURFACES].filter(Boolean).join('\n');
      off = css ? api.addStyle(css) : null;
    };
    window.addEventListener('vixer:ui-enhancements', apply);
    apply();
  },
});
