// Why: The small Settings pop-up is cramped for the number of pages Vortex adds. A full page gives them room and keeps a close button always in reach.
definePlugin({
  name: 'SettingsOverhaul',
  description: 'Turns Settings into a full-screen page with a centered sidebar and content column, a round close button, and a new icon set. Follows your theme.',
  authors: 'proimpacts',
  tags: ['Appearance', 'Settings'],
  options: {
    fullScreen: { type: 'boolean', label: 'Full-screen layout', description: 'Settings fills the window instead of floating in a box.', default: true },
    betterIcons: { type: 'boolean', label: 'New icons', default: true },
    contentWidth: { type: 'range', label: 'Content width', description: 'How wide the settings content can grow. It always shrinks to fit a narrower window.', min: 520, max: 1800, step: 10, default: 1000 },
  },
  onOptionChange() { window.dispatchEvent(new CustomEvent('vixer:settings-overhaul')); },
  start(api) {
    const svg = (body, fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${fill ? 'black' : 'none'}' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`;
    const ICONS = {
      account: svg("<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'/>"),
      profile: svg("<rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='11' r='2'/><path d='M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M15 10h3M15 14h3'/>"),
      apps: svg("<rect x='4' y='4' width='6' height='6' rx='1'/><rect x='14' y='4' width='6' height='6' rx='1'/><rect x='4' y='14' width='6' height='6' rx='1'/><path d='M17 14v6M14 17h6'/>"),
      appearance: svg("<path d='M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z'/><circle cx='7.5' cy='11' r='1'/><circle cx='10' cy='7' r='1'/><circle cx='15' cy='7' r='1'/>"),
      chat: svg("<path d='M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'/>"),
      language: svg("<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z'/>"),
      voice: svg("<rect x='9' y='3' width='6' height='11' rx='3'/><path d='M5 11a7 7 0 0 0 14 0M12 18v3'/>"),
      sounds: svg("<path d='M4 10v4h4l5 4V6l-5 4H4z'/><path d='M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11'/>"),
      keybinds: svg("<rect x='2.5' y='6' width='19' height='12' rx='2'/><path d='M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'/>"),
      desktop: svg("<rect x='3' y='4' width='18' height='12' rx='2'/><path d='M8 20h8M12 16v4'/>"),
      advanced: svg("<path d='M4 7h10M18 7h2M4 17h2M10 17h10'/><circle cx='16' cy='7' r='2'/><circle cx='8' cy='17' r='2'/>"),
      developer: svg("<path d='M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14'/>"),
      subscriptions: svg("<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 10h18M7 15h4'/>"),
      creators: svg("<path d='M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'/>"),
      leaderboards: svg("<path d='M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4'/>"),
      shards: svg("<path d='M6 4h12l3 5-9 11L3 9l3-5zM3 9h18M9 4l3 5 3-5M12 9v11'/>"),
      plus: svg("<path d='M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z'/>"),
      plugins: svg("<path d='M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4'/>"),
      themes: svg("<circle cx='12' cy='12' r='9'/><path d='M12 3v18'/><path d='M12 3a9 9 0 0 1 0 18z'/>", true),
      overview: svg("<rect x='3' y='3' width='8' height='8' rx='1.5'/><rect x='13' y='3' width='8' height='8' rx='1.5'/><rect x='3' y='13' width='8' height='8' rx='1.5'/><rect x='13' y='13' width='8' height='8' rx='1.5'/>"),
      roles: svg("<path d='M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z'/>"),
      members: svg("<circle cx='9' cy='8' r='3.5'/><path d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.5 2.4 3.5 5.5'/>"),
      channels: svg("<path d='M9 4L7 20M17 4l-2 16M4 9h17M3 15h17'/>"),
      bell: svg("<path d='M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 21h4'/>"),
      link: svg("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>"),
      shield: svg("<path d='M12 3l8 3v6c0 4.4-3.2 7.8-8 9-4.8-1.2-8-4.6-8-9V6l8-3z'/><path d='M9 12l2 2 4-4'/>"),
      backup: svg("<ellipse cx='12' cy='6' rx='7' ry='3'/><path d='M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6'/>"),
      create: svg("<rect x='3' y='3' width='18' height='18' rx='4'/><path d='M12 8v8M8 12h8'/>"),
      // Vortex's own pages: one filled set (Material Symbols by Google, Apache License 2.0, https://github.com/google/material-design-icons)
      vx_plugins: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M352-120H200q-33 0-56.5-23.5T120-200v-152q48 0 84-30.5t36-77.5q0-47-36-77.5T120-568v-152q0-33 23.5-56.5T200-800h160q0-42 29-71t71-29q42 0 71 29t29 71h160q33 0 56.5 23.5T800-720v160q42 0 71 29t29 71q0 42-29 71t-71 29v160q0 33-23.5 56.5T720-120H568q0-50-31.5-85T460-240q-45 0-76.5 35T352-120Z'/></svg>",
      vx_themes: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 32.5-156t88-127Q256-817 330-848.5T488-880q80 0 151 27.5t124.5 76q53.5 48.5 85 115T880-518q0 115-70 176.5T640-280h-74q-9 0-12.5 5t-3.5 11q0 12 15 34.5t15 51.5q0 50-27.5 74T480-80ZM260-440q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120-160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm200 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120 160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Z'/></svg>",
      vx_create: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560q0 17 11.5 28.5T560-600h160L520-800v160Zm-80 280v80q0 17 11.5 28.5T480-240q17 0 28.5-11.5T520-280v-80h80q17 0 28.5-11.5T640-400q0-17-11.5-28.5T600-440h-80v-80q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v80h-80q-17 0-28.5 11.5T320-400q0 17 11.5 28.5T360-360h80Z'/></svg>",
      vx_updates: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q82 0 155.5 35T760-706v-54q0-17 11.5-28.5T800-800q17 0 28.5 11.5T840-760v160q0 17-11.5 28.5T800-560H640q-17 0-28.5-11.5T600-600q0-17 11.5-28.5T640-640h70q-41-56-101-88t-129-32q-117 0-198.5 81.5T200-480q0 117 81.5 198.5T480-200q95 0 170-57t99-147q5-16 18-24t29-6q17 2 27 14.5t6 27.5q-29 119-126 195.5T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z'/></svg>",
      vx_folders: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z'/></svg>",
      vx_backup: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520v-286l36 35q11 11 27.5 11t28.5-12q11-11 11-28t-11-28L508-572q-12-12-28-12t-28 12L348-468q-11 11-11.5 27.5T348-412q11 11 27.5 11.5T404-411l36-35v286H260Z'/></svg>",
      vx_css: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='m193-479 155 155q11 11 11 28t-11 28q-11 11-28 11t-28-11L108-452q-6-6-8.5-13T97-480q0-8 2.5-15t8.5-13l184-184q12-12 28.5-12t28.5 12q12 12 12 28.5T349-635L193-479Zm574-2L612-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L668-268q-12 12-28 11.5T612-269q-12-12-12-28.5t12-28.5l155-155Z'/></svg>",
      vx_saved: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='black'><path d='m480-240-168 72q-40 17-76-6.5T200-241v-519q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v519q0 43-36 66.5t-76 6.5l-168-72Z'/></svg>",
      generic: svg("<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='2.5'/>"),
    };
    // Label (lowercase) contains -> icon. First match wins.
    const RULES = [
      ['custom commands', 'vx_css'], ['create & import', 'vx_create'], ['update', 'vx_updates'], ['folder', 'vx_folders'], ['data backup', 'vx_backup'],
      ['quick css', 'vx_css'], ['saved messages', 'vx_saved'], ['plugins', 'vx_plugins'], ['themes', 'vx_themes'],
      ['my account', 'account'], ['my profile', 'profile'], ['authorized', 'apps'], ['appearance', 'appearance'], ['chat', 'chat'],
      ['language', 'language'], ['voice', 'voice'], ['sound', 'sounds'], ['keybind', 'keybinds'], ['desktop', 'desktop'],
      ['advanced', 'advanced'], ['developer', 'developer'], ['subscription', 'subscriptions'], ['creator', 'creators'],
      ['leaderboard', 'leaderboards'], ['shard', 'shards'], ['plus', 'plus'], ['plugin', 'plugins'], ['theme', 'themes'], ['backup', 'backup'], ['create', 'create'], ['css', 'developer'], ['saved', 'log'],
      ['overview', 'overview'], ['role', 'roles'], ['member', 'members'], ['channel', 'channels'], ['notification', 'bell'],
      ['invite', 'link'], ['moderation', 'shield'], ['safety', 'shield'], ['verification', 'shield'],
    ];
    const iconFor = (label) => { const l = label.trim().toLowerCase(); for (const [needle, key] of RULES) if (l.includes(needle)) return key; return 'generic'; };
    const enc = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
    const iconCss = Object.entries(ICONS).map(([k, s]) => `:root.vx-sico .settings-nav button[data-vx-ico="${k}"]{--vx-ico:${enc(s)}}`).join('\n');

    api.addStyle(`
      :root{--vx-content-w:1000px;--vx-nav-w:clamp(256px,18vw,320px);--vx-base:#14151a}
      :root[data-theme=light]{--vx-base:#eef0f4}

      /* ---- Full-screen page ---- */
      /* Many themes use see-through panel colors (the tint system). Paint the page over one solid base so the app never shows through. */
      :root.vx-sfull .overlay:has(> .modal > .settings){padding:0!important;place-items:stretch!important;background:var(--vx-base)!important;backdrop-filter:none!important}
      :root.vx-sfull .modal.wide:has(> .settings),:root.vx-sfull .modal.bare:has(> .settings){max-width:none!important;width:100vw!important;height:100vh!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important}
      :root.vx-sfull .settings{height:100%;min-height:0;background:transparent!important}
      :root.vx-sfull .settings-nav{background:linear-gradient(var(--bg-side),var(--bg-side)) var(--vx-base)!important;border:0}
      :root.vx-sfull .settings-main{background:linear-gradient(var(--bg-main),var(--bg-main)) var(--vx-base)!important}
      :root.vx-sfull .settings-main h2{font-size:20px;line-height:24px;font-weight:700;margin:0 0 20px}

      /* ---- Wide windows: the sidebar sits flush against the left edge and the content fills the rest. Above the site's 760px mobile breakpoint only. ---- */
      @media (min-width:761px){
        :root.vx-sfull .settings-nav{flex:0 0 var(--vx-nav-w);width:var(--vx-nav-w);min-width:0;align-items:stretch;padding:64px 12px 48px 20px;overflow-y:auto;gap:2px;box-sizing:border-box}
        :root.vx-sfull .settings-nav > *{width:auto;max-width:100%;box-sizing:border-box}
        /* The content takes all remaining width, up to the chosen maximum, and shrinks with the window. */
        :root.vx-sfull .settings-main{flex:1 1 0;min-width:0;overflow-y:auto;padding:64px 72px 80px 56px}
        :root.vx-sfull .settings-main > *{max-width:var(--vx-content-w)}
        :root.vx-sfull .settings > .settings-close{top:64px!important;right:auto!important;left:min(calc(var(--vx-nav-w) + 56px + var(--vx-content-w) + 24px), calc(100% - 60px))!important}
      }
      /* Narrow windows: leave the site's own stacked layout and pill-style tabs alone. */
      @media (max-width:760px){
        /* Opening Settings focuses the search box, and the site then stacks the whole tab list as a column. Cap it so the content keeps its room. */
        :root.vx-sfull .settings-nav{padding:10px 56px 6px 12px;align-items:stretch;max-height:42vh;overflow-y:auto;flex-shrink:0}
        :root.vx-sfull .settings > .settings-close{top:10px!important;right:10px!important;left:auto!important}
        :root.vx-sfull .settings > .settings-close::after{display:none}
        :root.vx-sfull .settings-main{flex:1 1 0;min-height:140px;padding:14px 14px 24px}
      }

      /* ---- Sidebar ---- */
      :root.vx-sfull .settings-nav button{min-height:36px;padding:6px 10px;border-radius:var(--r-sm,6px);font-size:15px;font-weight:500;gap:10px;color:var(--text-muted);transition:background .12s,color .12s}
      :root.vx-sfull .settings-nav button:hover{background:var(--bg-hover);color:var(--text)}
      :root.vx-sfull .settings-nav button.active{background:var(--bg-active);color:var(--text)}
      :root.vx-sfull .settings-nav-label{margin-top:14px;padding:6px 10px 4px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--text-faint);opacity:1}
      :root.vx-sfull .settings-nav > :first-child.settings-nav-label{margin-top:0}
      :root.vx-sfull .settings-search{margin-bottom:8px}
      /* The search field is one box (the wrapper); the input inside must not draw a second one, in user, server or channel settings. */
      .settings-search-box{box-sizing:border-box;min-width:0}
      .settings-search-box input,.settings-search-box input:focus,.settings-search-box input:focus-visible{flex:1 1 auto;min-width:0;width:100%;height:auto!important;min-height:0!important;margin:0!important;padding:0 0 0 2px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;outline:0!important}
      .settings-search-box:focus-within{border-color:var(--accent,var(--text-muted))}

      /* ---- Profile card at the top of the sidebar ---- */
      .settings-nav button.vx-sprofile,:root.vx-sfull .settings-nav button.vx-sprofile{display:flex;flex:0 0 auto;align-items:center;gap:10px;width:100%;height:auto;min-height:52px;box-sizing:border-box;margin:0 0 8px;padding:6px 8px;border:0;border-radius:var(--r-sm,8px);background:transparent;color:inherit;text-align:left;font-weight:400;cursor:pointer;transition:background .12s}
      .settings-nav button.vx-sprofile:hover,:root.vx-sfull .settings-nav button.vx-sprofile:hover{background:var(--bg-hover);color:inherit}
      .settings-nav button.vx-sprofile::before,:root.vx-sico .settings-nav button.vx-sprofile::before{content:none!important;display:none!important}
      .vx-sp-av{position:relative;flex:0 0 38px;width:38px;height:38px;border-radius:50%;background:var(--bg-active);display:grid;place-items:center;font-weight:700;font-size:16px;color:var(--text)}
      .vx-sp-av img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}
      .vx-sp-dot{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;box-sizing:border-box;border-radius:50%;background:var(--text-faint);border:3px solid var(--bg-side)}
      .vx-sp-dot.online{background:var(--success,#23a55a)}.vx-sp-dot.idle{background:var(--warning,#f0b132)}.vx-sp-dot.dnd{background:var(--danger,#f23f43)}
      .vx-sp-text{min-width:0;display:flex;flex-direction:column;gap:2px}
      .vx-sp-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:700;line-height:1.2;color:var(--text)}
      .vx-sp-text{flex:1 1 auto}.vx-sp-text>*{flex:none}
      .vx-sp-sub{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)}
      .vx-sp-sub svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .vx-sprofile:hover .vx-sp-sub{color:var(--text)}
      @media (max-width:760px){.vx-sprofile{display:none}}

      /* ---- Close button with an ESC hint ---- */
      :root.vx-sfull .settings > .settings-close{width:36px!important;height:36px!important;background:transparent!important;border:2px solid var(--text-faint);color:var(--text-muted);z-index:10}
      :root.vx-sfull .settings > .settings-close:hover{background:var(--bg-hover)!important;color:var(--text);border-color:var(--text-muted)}
      :root.vx-sfull .settings > .settings-close::after{content:"ESC";position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);font-size:12px;font-weight:800;letter-spacing:.04em;color:var(--text-faint)}

      /* ---- Icons: our set replaces the site's, drawn in the current text color so every theme applies ---- */
      :root.vx-sico .settings-nav button[data-vx-ico] > svg{display:none}
      :root.vx-sico .settings-nav button[data-vx-ico]::before{content:"";flex:none;width:20px;height:20px;background:currentColor;opacity:.9;-webkit-mask:var(--vx-ico) center/contain no-repeat;mask:var(--vx-ico) center/contain no-repeat}
      ${iconCss}
    `);

    // The old content width box was hard to change and defaulted to 740px; a saved value from that range kept the page narrow.
    // Reset it once so the new fluid default (and the slider) take over.
    try {
      const flag = 'vixer:plugin:settings-overhaul:migrated-width';
      const key = 'vixer:plugin:settings-overhaul:opt:contentWidth';
      if (localStorage.getItem(flag) === null) {
        const saved = Number(JSON.parse(localStorage.getItem(key) ?? 'null'));
        if (Number.isFinite(saved) && saved <= 760) localStorage.removeItem(key);
        localStorage.setItem(flag, '1');
      }
    } catch { /* storage unavailable: nothing to migrate */ }

    const root = document.documentElement;
    function applyOptions() {
      root.classList.toggle('vx-sfull', !!api.options.get('fullScreen'));
      root.classList.toggle('vx-sico', !!api.options.get('betterIcons'));
      root.style.setProperty('--vx-content-w', `${Number(api.options.get('contentWidth')) || 740}px`);
    }
    applyOptions();
    window.addEventListener('vixer:settings-overhaul', applyOptions);

    function tag() {
      for (const b of document.querySelectorAll('.settings-nav button:not(.vx-sprofile)')) {
        const label = b.textContent;
        if (b.dataset.vxLabel === label) continue; // already tagged for this text
        b.dataset.vxLabel = label;
        b.dataset.vxIco = iconFor(label);
      }
    }
    // Your picture, name and status, taken from the account card in the corner, with a shortcut to My Profile.
    function profile() {
      const nav = document.querySelector('.settings-nav');
      if (!nav) return;
      const bar = document.querySelector('.user-bar');
      const name = bar?.querySelector('.uname')?.textContent?.trim();
      let card = nav.querySelector(':scope > .vx-sprofile');
      if (!name) { card?.remove(); return; }
      const src = bar.querySelector('.avatar img')?.currentSrc || bar.querySelector('.avatar img')?.getAttribute('src') || '';
      const dotClass = (bar.querySelector('.status-dot')?.className || '').split(/\s+/).find((c) => ['online', 'idle', 'dnd', 'offline'].includes(c)) || '';
      const sig = `${name}|${src}|${dotClass}`;
      if (card && card.dataset.sig === sig && nav.firstElementChild === card) return;
      if (!card) {
        card = document.createElement('button'); card.type = 'button'; card.className = 'vx-sprofile'; card.title = 'Edit your profile';
        card.addEventListener('click', () => { [...nav.querySelectorAll('button')].find((b) => /^\s*My Profile\s*$/.test(b.textContent))?.click(); });
      }
      card.dataset.sig = sig;
      const av = document.createElement('span'); av.className = 'vx-sp-av';
      if (src) { const img = document.createElement('img'); img.alt = ''; img.src = src; img.draggable = false; av.append(img); } else av.textContent = name.slice(0, 1).toUpperCase();
      const dot = document.createElement('span'); dot.className = `vx-sp-dot ${dotClass}`; av.append(dot);
      const text = document.createElement('span'); text.className = 'vx-sp-text';
      const nm = document.createElement('span'); nm.className = 'vx-sp-name'; nm.textContent = name;
      const sub = document.createElement('span'); sub.className = 'vx-sp-sub';
      sub.append(document.createTextNode('Edit profile'));
      const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ic.setAttribute('viewBox', '0 0 24 24'); ic.innerHTML = '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'; sub.append(ic);
      text.append(nm, sub); card.replaceChildren(av, text);
      if (nav.firstElementChild !== card) nav.prepend(card);
    }
    const refresh = () => { tag(); profile(); };
    new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    refresh();
  },
});
