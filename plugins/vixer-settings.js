// Why: Vortex needs somewhere to live in Settings. This adds the Plugins and Themes pages and the pages plugins register, and it is required because it is how you switch everything else on.
definePlugin({
  name: 'VortexSettings',
  description: 'Adds the Vortex section (Plugins, Themes and plugin pages) to User settings.',
  authors: 'proimpacts',
  tags: ['Settings'],
  start(api) {
    const GROUP = 'data-vixer-group';
    const ICONS = {
      plugins: '<path d="M9 3v3M15 3v3M7 9h10v4a5 5 0 0 1-10 0V9zM12 18v3"/>',
      themes: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 21a2.5 2.5 0 0 1 0-5h1.5a2 2 0 0 0 0-4"/>',
      log: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
      speed: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
      backup: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
      create: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
      code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
      cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      chevron: '<path d="M9 6l6 6-6 6"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      page: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
    };
    let currentNav = null;
    let active = null;
    let restore = [];
    let needsReload = false;
    let query = '';

    api.addStyle(`
      .settings-main.vixer-open > :not(.vixer-pane){display:none!important}
      /* Buttons only stretch inside a flex column, like the site's own tabs. A plain block wrapper left them as small pills. */
      [data-vixer-group]{display:flex;flex-direction:column;align-items:stretch;gap:2px}
      [data-vixer-group] > button{width:100%;box-sizing:border-box}
      .vixer-pane{padding:4px 2px}
      .vixer-h3{margin:28px 0 10px;font-size:16px;font-weight:700;color:var(--text)}
      .vixer-info{padding:16px 16px 18px;margin:0 0 12px;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px}
      .vixer-info b{display:block;margin-bottom:8px;font-size:16px;color:var(--text)}
      .vixer-info p{margin:0 0 4px;color:var(--text);font-size:14px;line-height:1.45}
      .vixer-info small{display:block;margin-top:10px;color:var(--text-muted)}
      .vixer-linkcard{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;box-sizing:border-box;padding:14px 16px;margin:0 0 4px;text-align:left;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;color:var(--text);font:inherit;cursor:pointer;transition:background .12s}
      .vixer-linkcard:hover{background:var(--bg-hover)}
      .vixer-linkcard b{display:block;font-size:16px}
      .vixer-linkcard small{display:block;margin-top:2px;color:var(--text-muted)}
      .vixer-linkcard svg{width:22px;height:22px;flex:none;color:var(--text-muted)}
      .vixer-filter-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .vixer-select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font:inherit;cursor:pointer}
      .vixer-select:focus{outline:none;border-color:var(--accent)}
      .vixer-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px}
      .vixer-pcard{display:flex;flex-direction:column;gap:8px;min-height:96px;padding:16px;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;transition:border-color .12s,opacity .12s}
      .vixer-pcard:hover{border-color:var(--bg-active)}
      .vixer-lockmark{font-size:12px;color:var(--text-faint);white-space:nowrap}
      .vixer-pcard.off .vixer-pcard-desc{opacity:.8}
      .vixer-pcard-top{display:flex;align-items:center;gap:10px}
      .vixer-pcard-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:700;color:var(--text)}
      .vixer-pcard-desc{color:var(--text-muted);font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .vixer-pcard-error{padding:8px 10px;border-radius:6px;background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger);font-size:13px;line-height:1.35;word-break:break-word}
      .vixer-yours{align-self:flex-start;padding:2px 8px;border-radius:999px;background:var(--accent-soft);color:var(--text);font-size:11px;font-weight:700}
      .vixer-iconbtn{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer;transition:background .12s,color .12s}
      .vixer-iconbtn:hover{background:var(--bg-hover);color:var(--text)}
      .vixer-iconbtn svg{width:20px;height:20px}
      .vixer-modal-back{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.6);animation:vx-fade .12s ease-out}
      .vixer-modal{display:flex;flex-direction:column;width:min(560px,100%);max-height:min(720px,100%);background:var(--bg-main);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow,0 10px 40px #00000073);overflow:hidden;animation:vx-pop .16s ease-out}
      .vixer-modal-back,.vixer-modal-back *{font-family:var(--font,"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif)}
      .vixer-modal{font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
      .vixer-modal-head h3{letter-spacing:-.01em}
      .vixer-modal-desc{font-size:14px;color:var(--text-muted)!important;line-height:1.55}
      .vixer-modal-h{font-size:11.5px!important;font-weight:700!important;letter-spacing:.06em!important}
      .vixer-opt>div>span{font-size:14px;font-weight:600;color:var(--text)}
      .vixer-opt small{font-size:12.5px;line-height:1.4;margin-top:2px;font-weight:400}
      .vixer-opt{padding:12px 0!important}
      .vixer-modal-enable{font-size:14px}
      .vixer-modal-foot .vixer-btn,.vixer-modal-foot button{font-size:14px;font-weight:600}
      .vixer-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 20px 8px}
      .vixer-modal-head h3{margin:0;font-size:20px;font-weight:700;color:var(--text)}
      .vixer-modal-head small{color:var(--text-muted)}
      .vixer-modal-body{flex:1;overflow-y:auto;padding:4px 20px 12px}
      .vixer-modal-desc{margin:0 0 12px;color:var(--text);line-height:1.5}
      .vixer-modal-h{margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted)}
      .vixer-chips{display:flex;flex-wrap:wrap;gap:6px}
      .vixer-modal-actions{display:flex;align-items:center;gap:8px}
      .vixer-roundbtn{display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:var(--bg-active);color:var(--text);cursor:pointer;transition:background .12s,transform .08s}
      .vixer-roundbtn:hover{filter:brightness(1.2)}.vixer-roundbtn:active{transform:scale(.94)}
      .vixer-avatar{border-radius:50%;object-fit:cover;flex:none;background:var(--bg-active)}
      .vixer-avatar.letter{display:inline-grid;place-items:center;font-weight:700;color:var(--text-muted)}
      .vixer-author-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .vixer-author-chip{display:inline-flex;align-items:center;gap:8px;padding:4px 12px 4px 4px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--text);font-size:13px;font-weight:600;cursor:pointer}
      .vixer-author-chip:hover{background:var(--bg-active)}
      .vixer-author-modal{width:min(640px,100%)}
      .vixer-author-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 6px}
      .vixer-author-pill{display:inline-flex;align-items:center;gap:10px;padding:4px 16px 4px 4px;border-radius:999px;background:var(--bg-active);font-size:18px;color:var(--text)}
      .vixer-author-count{margin:6px 20px 12px;font-size:14px;color:var(--text)}
      .vixer-author-count a{color:var(--accent);text-decoration:none}.vixer-author-count a:hover{text-decoration:underline}
      .vixer-author-grid{grid-template-columns:1fr!important}
      .vixer-chip{padding:3px 10px;border-radius:999px;background:var(--bg-active);color:var(--text-muted);font-size:12px;font-weight:600}
      .vixer-opts-list{border-radius:8px;background:var(--bg-elev);border:1px solid var(--border);padding:0 14px}
      .vixer-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:var(--bg-side);border-top:1px solid var(--border)}
      .vixer-modal-enable{display:flex;align-items:center;gap:12px;color:var(--text);font-weight:600}
      @keyframes vx-fade{from{opacity:0}to{opacity:1}}
      @keyframes vx-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
      .vixer-pane h2{margin:0 0 4px;font-size:var(--fs-20,20px);line-height:var(--lh-20,26px)}
      .vixer-pane .vixer-sub{margin:0 0 16px;color:var(--text-muted)}
      .vixer-search{width:100%;box-sizing:border-box;margin:0 0 14px;padding:10px 12px;border-radius:var(--row-radius,8px);border:1px solid var(--border);background:var(--bg-input);color:var(--text);font:inherit;outline:none}
      .vixer-search:focus{border-color:var(--accent)}
      .vixer-card{margin-bottom:10px;background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius,10px);overflow:hidden}
      .vixer-card.off{opacity:.72}
      .vixer-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px}
      .vixer-card-head b{display:block;color:var(--text);font-size:15px}
      .vixer-card-head .vixer-by{color:var(--text-faint);font-weight:400;font-size:12px;margin-left:6px}
      .vixer-card-head small{display:block;margin-top:3px;color:var(--text-muted)}
      .vixer-opts{border-top:1px solid var(--border);padding:6px 16px 10px;background:var(--bg-side)}
      .vixer-opt{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}
      .vixer-opt + .vixer-opt{border-top:1px solid var(--border)}
      .vixer-opt small{display:block;color:var(--text-muted)}
      .vixer-opt input[type=number],.vixer-opt select,.vixer-opt input[type=text]{background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font:inherit;min-width:110px}
      .vixer-range-wrap{display:flex;align-items:center;gap:12px;min-width:240px}
      .vixer-range{flex:1;accent-color:var(--accent)}
      .vixer-range-out{min-width:44px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-muted)}
      .vixer-empty{color:var(--text-muted);padding:12px 0}
      .vixer-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;margin-bottom:14px;background:var(--accent-soft);border-radius:var(--row-radius,8px);color:var(--text)}
      .vixer-btn{background:var(--accent-fill,var(--accent));color:var(--on-accent,#fff);border:0;border-radius:6px;padding:7px 14px;font-weight:600;cursor:pointer;font:inherit;font-weight:600}
      .vixer-btn.ghost{background:var(--bg-active);color:var(--text)}
      .vixer-btn.danger{background:var(--danger);color:#fff}
      .vixer-switch{position:relative;flex:none;width:40px;height:22px}
      .vixer-switch input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
      .vixer-switch span{position:absolute;inset:0;border-radius:11px;background:var(--bg-active);transition:background var(--dur-2,.2s);pointer-events:none}
      .vixer-switch span::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform var(--dur-2,.2s)}
      .vixer-switch input:checked+span{background:var(--accent-fill,var(--accent))}
      .vixer-switch input:checked+span::after{transform:translateX(18px)}
      .vixer-tools-box{padding:8px;border:1px solid var(--border);border-radius:var(--radius,10px);background:var(--bg-elev)}
      .vixer-tools{display:flex;flex-wrap:wrap;gap:8px}
      .vixer-tool{display:inline-flex;align-items:center;gap:10px;height:40px;padding:0 16px;border:0;border-radius:8px;background:var(--bg-active);color:var(--text);font:600 14px var(--font);cursor:pointer;transition:filter .12s}
      .vixer-tool:hover{filter:brightness(1.18)}.vixer-tool svg{width:18px;height:18px}
      .vixer-tgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      @media (max-width:900px){.vixer-tgrid{grid-template-columns:1fr}}
      .vixer-tcard{display:flex;flex-direction:column;gap:8px;padding:14px 16px;background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius,10px);transition:border-color .15s,background .15s}
      .vixer-tcard.on{border-color:color-mix(in srgb,var(--accent) 70%,var(--border))}
      .vixer-tcard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .vixer-tcard-title{display:flex;flex-direction:column;min-width:0}
      .vixer-tcard-title b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vixer-tcard-title small{color:var(--text-muted);font-size:12px}
      .vixer-tcard-desc{margin:0;color:var(--text-muted);font-size:14px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:2.9em}
      .vixer-tcard-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto}
      .vixer-tmeta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;color:var(--text-muted);font-size:12px}
      .vixer-tmeta em{font-style:normal;opacity:.8}
      .vixer-author-link{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:var(--text-muted);font:inherit;font-size:12px;cursor:pointer}
      .vixer-author-link:hover{color:var(--text);text-decoration:underline}
      .vixer-author-link .vixer-avatar{border-radius:50%}
      .vixer-dots{display:flex}.vixer-dots i{width:16px;height:16px;border-radius:50%;margin-right:-4px;border:2px solid var(--bg-elev)}
      .vixer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
      .vixer-theme{display:flex;flex-direction:column;background:var(--bg-elev);border:2px solid var(--border);border-radius:var(--radius,10px);overflow:hidden;cursor:pointer;text-align:left;color:var(--text);padding:0;font:inherit}
      .vixer-theme:hover{border-color:var(--bg-active)}
      .vixer-theme.on{border-color:var(--accent)}
      .vixer-swatch{display:flex;height:54px}
      .vixer-swatch i{flex:1}
      .vixer-theme-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px}
      .vixer-theme-body b{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .vixer-theme-body small{color:var(--text-muted);min-height:2.4em}
      .vixer-tag{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 6px;border-radius:4px;background:var(--bg-active);color:var(--text-muted);font-weight:700}
      .vixer-tag.on{background:var(--accent-fill,var(--accent));color:var(--on-accent,#fff)}
    `);

    function h(tag, props, ...kids) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(props || {})) {
        if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
      }
      el.append(...kids.filter((x) => x != null && x !== false));
      return el;
    }
    function icon(name) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
      s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = ICONS[name] ?? ICONS.page;
      return s;
    }
    function toggle(checked, onChange) {
      const input = h('input', { type: 'checkbox', onchange: () => onChange(input.checked) });
      input.checked = checked;
      return h('label', { class: 'vixer-switch', onclick: (e) => e.stopPropagation() }, input, h('span'));
    }

    function optionControl(pluginId, opt) {
      const set = (v) => { api.manager.setOption(pluginId, opt.key, v); };
      if (opt.type === 'boolean') return toggle(!!opt.value, set);
      if (opt.type === 'select') {
        const sel = h('select', { onchange: () => set(sel.value) }, ...opt.choices.map((c) => h('option', { value: c }, c)));
        sel.value = opt.value; return sel;
      }
      if (opt.type === 'number') {
        const clamp = (n) => Math.min(opt.max ?? n, Math.max(opt.min ?? n, n));
        // Applies while typing (when the value is a complete, in-range number) and is tidied up when you leave the box.
        const inp = h('input', {
          type: 'number', min: opt.min ?? '', max: opt.max ?? '',
          oninput: () => { if (inp.value === '') return; const n = Number(inp.value); if (Number.isFinite(n) && n === clamp(n)) set(n); },
          onchange: () => { const n = Number(inp.value); const v = inp.value === '' || !Number.isFinite(n) ? opt.default ?? opt.value : clamp(n); inp.value = v; set(v); },
        });
        inp.value = opt.value; return inp;
      }
      if (opt.type === 'range') {
        // A slider with a live readout: the page changes as you drag.
        const out = h('span', { class: 'vixer-range-out' }, String(opt.value));
        const inp = h('input', { type: 'range', min: opt.min ?? 0, max: opt.max ?? 100, step: opt.step ?? 1, class: 'vixer-range', oninput: () => { out.textContent = inp.value; set(Number(inp.value)); } });
        inp.value = opt.value;
        return h('div', { class: 'vixer-range-wrap' }, inp, out);
      }
      if (opt.type === 'color') {
        // Color picker plus a "reset" so an empty value means "use the theme's own color".
        const c = h('input', { type: 'color', class: 'vixer-color', oninput: () => set(c.value) });
        c.value = /^#[0-9a-f]{6}$/i.test(opt.value) ? opt.value : (opt.default && /^#[0-9a-f]{6}$/i.test(opt.default) ? opt.default : '#7c8cff');
        return h('div', { class: 'vixer-range-wrap' }, c, h('button', { class: 'vixer-btn', type: 'button', onclick: () => { set(''); } }, 'Reset'));
      }
      if (opt.type === 'textarea') {
        const ta = h('textarea', { rows: 5, class: 'vixer-code', style: 'width:100%;box-sizing:border-box;min-height:110px', onchange: () => set(ta.value) });
        ta.value = opt.value ?? ''; return ta;
      }
      if (opt.type === 'keybind') {
        // Click, then press the shortcut you want. Escape cancels, Backspace clears.
        const b = h('button', { class: 'vixer-btn', type: 'button' }, opt.value || 'Not set');
        b.onclick = () => {
          b.textContent = 'Press keys…';
          const on = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
            document.removeEventListener('keydown', on, true);
            if (e.key === 'Escape') { b.textContent = opt.value || 'Not set'; return; }
            const v = e.key === 'Backspace' ? '' : [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join('+');
            opt.value = v; b.textContent = v || 'Not set'; set(v);
          };
          document.addEventListener('keydown', on, true);
        };
        return b;
      }
      const t = h('input', { type: 'text', onchange: () => set(t.value) });
      t.value = opt.value ?? ''; return t;
    }

    // ---- Authors. A plugin lists its authors by name; the ones known here get a picture and a link to their GitHub. Clicking an author
    // opens everything they made, so people can find more from the same person. ----
    const REPO = 'https://github.com/proimpacts/Vortex';
    const AUTHORS = {
      proimpacts: { github: 'https://github.com/proimpacts', avatar: 'data:image/jpeg;base64,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' },
    };
    const authorsOf = (p) => String(p.authors || '').split(/[,&]/).map((x) => x.trim()).filter(Boolean);
    const openUrl = (u) => { try { window.open(u, '_blank', 'noopener,noreferrer'); } catch { /* blocked: nothing to do */ } };
    const SVG_GH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';
    function linkBtn(svgHtml, label, url) {
      const b = h('button', { class: 'vixer-roundbtn', title: label, 'aria-label': label, onclick: () => openUrl(url) });
      b.innerHTML = svgHtml; return b;
    }
    function avatarEl(name, size) {
      const a = AUTHORS[name];
      if (a?.avatar) return h('img', { class: 'vixer-avatar', src: a.avatar, alt: '', width: size, height: size, style: `width:${size}px;height:${size}px` });
      return h('span', { class: 'vixer-avatar letter', style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px` }, (name[0] || '?').toUpperCase());
    }
    const themeAuthors = (t) => String(t.author || '').split(/[,&]/).map((x) => x.trim()).filter(Boolean);
    const themesBy = (name) => api.manager.listThemes().filter((t) => themeAuthors(t).includes(name));
    const pluginsBy = (name) => api.manager.listPlugins().filter((p) => authorsOf(p).includes(name));

    function openAuthorModal(name, rerender) {
      closeModal();
      const list = pluginsBy(name);
      const themeList = themesBy(name);
      const back = h('div', { class: 'vixer-modal-back', onclick: (e) => { if (e.target === back) closeModal(); } });
      const dlg = h('div', { class: 'vixer-modal vixer-author-modal', role: 'dialog', 'aria-label': name });
      const known = AUTHORS[name];
      const head = h('div', { class: 'vixer-author-head' },
        h('div', { class: 'vixer-author-pill' }, avatarEl(name, 32), h('b', {}, name)),
        h('div', { class: 'vixer-modal-actions' }, known?.github ? linkBtn(SVG_GH, 'GitHub profile', known.github) : null,
          h('button', { class: 'vixer-iconbtn', 'aria-label': 'Close', onclick: closeModal }, icon('close'))));
      const count = h('p', { class: 'vixer-author-count' }, 'This person has ',
        known?.github ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); openUrl(`${REPO}/commits/main`); } }, 'contributed') : 'contributed',
        ` to ${list.length} plugin${list.length === 1 ? '' : 's'}${themeList.length ? ` and ${themeList.length} theme${themeList.length === 1 ? '' : 's'}` : ''}!`);
      const again = () => { openAuthorModal(name, rerender); rerender?.(); };
      const grid = h('div', { class: 'vixer-pgrid vixer-author-grid' }, ...list.map((p) => pluginCard(p, again)));
      const tgrid = h('div', { class: 'vixer-tgrid vixer-author-grid' }, ...themeList.map((t) => themeCard(t, again)));
      dlg.append(head, count, h('div', { class: 'vixer-modal-body' }, list.length ? grid : h('div', { class: 'vixer-empty' }, 'No plugins found.'),
        ...(themeList.length ? [h('h4', { class: 'vixer-modal-h' }, 'Themes'), tgrid] : [])));
      back.append(dlg); document.documentElement.append(back); modal = back;
    }

    // ---- Plugin details dialog: the cog (has settings) or the info icon (no settings) on a card opens this. ----
    let modal = null;
    function closeModal() { modal?.remove(); modal = null; }
    document.addEventListener('keydown', (e) => {
      if (modal && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); } // Escape closes the dialog, not Settings behind it
    }, true);

    function openPluginModal(id, rerender) {
      closeModal();
      const p = api.manager.listPlugins().find((x) => x.id === id);
      if (!p) return;
      const back = h('div', { class: 'vixer-modal-back', onclick: (e) => { if (e.target === back) closeModal(); } });
      const dlg = h('div', { class: 'vixer-modal', role: 'dialog', 'aria-label': p.name });
      const head = h('div', { class: 'vixer-modal-head' },
        h('div', {}, h('h3', {}, p.name)),
        h('div', { class: 'vixer-modal-actions' }, !p.user && authorsOf(p).some((a) => AUTHORS[a]) ? linkBtn(SVG_GH, 'View the source on GitHub', `${REPO}/blob/main/plugins/${p.id}.js`) : null,
          h('button', { class: 'vixer-iconbtn', 'aria-label': 'Close', onclick: closeModal }, icon('close'))));
      const body = h('div', { class: 'vixer-modal-body' }, h('p', { class: 'vixer-modal-desc' }, p.description || 'No description.'));
      if (p.tags.length) body.append(h('div', { class: 'vixer-chips' }, ...p.tags.map((t) => h('span', { class: 'vixer-chip' }, t))));
      if (authorsOf(p).length) body.append(h('h4', { class: 'vixer-modal-h' }, authorsOf(p).length === 1 ? 'Author' : 'Authors'),
        h('div', { class: 'vixer-author-row' }, ...authorsOf(p).map((a) => h('button', { class: 'vixer-author-chip', title: `See what ${a} made`, onclick: () => openAuthorModal(a, rerender) }, avatarEl(a, 24), h('span', {}, a)))));
      if (sealed(p)) body.append(h('p', { class: 'vixer-empty' }, 'This is part of Vortex itself. It is always on, and its settings are locked.'));
      else if (p.options.length) {
        body.append(h('h4', { class: 'vixer-modal-h' }, 'Settings'));
        if (!p.enabled) body.append(h('p', { class: 'vixer-empty' }, 'Turn this plugin on to change its settings.'));
        else {
          const box = h('div', { class: 'vixer-opts-list' });
          for (const o of p.options) box.append(h('div', { class: 'vixer-opt' }, h('div', {}, h('span', {}, o.label ?? o.key), o.description ? h('small', {}, o.description) : null), optionControl(p.id, o)));
          body.append(box);
        }
      } else body.append(h('p', { class: 'vixer-empty' }, 'This plugin has no settings.'));
      const foot = h('div', { class: 'vixer-modal-foot' },
        sealed(p) ? h('span', { class: 'vixer-lockmark' }, 'Always on') : h('label', { class: 'vixer-modal-enable' }, h('span', {}, p.required ? 'Always on' : p.enabled ? 'Plugin is on' : 'Plugin is off'),
          p.required ? lockedToggle() : toggle(p.enabled, (on) => { api.manager.setPlugin(p.id, on); needsReload = true; closeModal(); rerender(); })),
        h('button', { class: 'vixer-btn', onclick: closeModal }, 'Done'));
      dlg.append(head, body, foot);
      back.append(dlg);
      document.documentElement.append(back);
      modal = back;
    }

    // Required plugins are part of Vortex itself. Most are sealed: no description, no settings, no switch, only an info icon.
    // Settings Overhaul and Auto Update keep their settings, because those are things people reasonably want to change.
    const OPEN_REQUIRED = new Set(['settings-overhaul', 'auto-update']);
    const sealed = (p) => p.required && !OPEN_REQUIRED.has(p.id);
    function lockedToggle() {
      const t = toggle(true, () => {});
      const input = t.querySelector('input'); input.checked = true; input.disabled = true;
      t.title = 'Required: part of Vortex, so it is always on'; t.style.opacity = '.55'; t.style.cursor = 'not-allowed';
      return t;
    }
    function pluginCard(p, rerender) {
      const hasOpts = p.options.length > 0 && !sealed(p); // sealed plugins get the info icon instead of the cog
      const iconBtn = h('button', { class: 'vixer-iconbtn', title: hasOpts ? 'Settings' : 'About', 'aria-label': `${p.name} ${hasOpts ? 'settings' : 'info'}`, onclick: () => openPluginModal(p.id, rerender) }, icon(hasOpts ? 'cog' : 'info'));
      return h('div', { class: `vixer-pcard${p.enabled ? '' : ' off'}` },
        h('div', { class: 'vixer-pcard-top' },
          h('b', { class: 'vixer-pcard-name', title: p.name }, p.name), iconBtn,
          p.required ? lockedToggle() : toggle(p.enabled, (on) => { api.manager.setPlugin(p.id, on); needsReload = true; rerender(); })),
        h('div', { class: 'vixer-pcard-desc' }, p.description || 'No description.'),
        p.error ? h('div', { class: 'vixer-pcard-error' }, `Could not run: ${p.error}`) : null,
        p.user ? h('span', { class: 'vixer-yours' }, 'Made by you') : null);
    }

    const filters = { show: 'all', tag: '' };
    function renderPlugins(pane) {
      const rerender = () => renderPlugins(pane);
      const all = api.manager.listPlugins();
      pane.replaceChildren(h('h2', {}, 'Plugins'));
      if (needsReload) pane.append(h('div', { class: 'vixer-banner' }, h('span', {}, 'Reload to apply your plugin changes.'), h('button', { class: 'vixer-btn', onclick: () => api.manager.reload() }, 'Reload')));

      pane.append(h('div', { class: 'vixer-info' },
        h('b', {}, 'Plugin Management'),
        h('p', {}, 'Press the cog or the info icon on a plugin to see more about it.'),
        h('p', {}, 'Plugins with a cog have settings you can change. Turning a plugin on or off applies after a reload.'),
        h('small', {}, `${all.filter((p) => p.enabled).length} of ${all.length} plugins on`)));

      const backupView = views()['data-backup:backup'];
      if (backupView) {
        pane.append(h('button', { class: 'vixer-linkcard', onclick: () => open('data-backup:backup') },
          h('div', {}, h('b', {}, 'Data & backup'), h('small', {}, 'Your plugin settings and message history are saved to a file on this PC')),
          icon('chevron')));
      }

      if (views()['addon-studio:studio']) {
        pane.append(h('button', { class: 'vixer-linkcard', onclick: () => open('addon-studio:studio') },
          h('div', {}, h('b', {}, 'Make or import a plugin'), h('small', {}, 'Write your own, or install one that someone shared with you')),
          icon('chevron')));
      }

      pane.append(h('h3', { class: 'vixer-h3' }, 'Filters'));
      const search = h('input', { class: 'vixer-search', type: 'search', placeholder: 'Search for a plugin...', oninput: () => { query = search.value; renderGrid(); } });
      search.value = query;
      const showSel = h('select', { class: 'vixer-select', 'aria-label': 'Show', onchange: () => { filters.show = showSel.value; renderGrid(); } },
        ...[['all', 'Show All'], ['on', 'Enabled'], ['off', 'Disabled'], ['opts', 'Has settings']].map(([v, l]) => h('option', { value: v }, l)));
      showSel.value = filters.show;
      const tags = [...new Set(all.flatMap((p) => p.tags))].sort();
      const tagSel = h('select', { class: 'vixer-select', 'aria-label': 'Filter by tags', onchange: () => { filters.tag = tagSel.value; renderGrid(); } },
        h('option', { value: '' }, 'Filter by Tags'), ...tags.map((t) => h('option', { value: t }, t)));
      tagSel.value = filters.tag;
      pane.append(search, h('div', { class: 'vixer-filter-row' }, showSel, tagSel));

      pane.append(h('h3', { class: 'vixer-h3' }, 'Plugins'));
      const grid = h('div', { class: 'vixer-pgrid' });
      pane.append(grid);
      function renderGrid() {
        const q = query.trim().toLowerCase();
        const items = all.filter((p) => !p.required).filter((p) => {
          const live = api.manager.listPlugins().find((x) => x.id === p.id) ?? p;
          if (q && !`${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q)) return false;
          if (filters.show === 'on' && !live.enabled) return false;
          if (filters.show === 'off' && live.enabled) return false;
          if (filters.show === 'opts' && !p.options.length) return false;
          if (filters.tag && !p.tags.includes(filters.tag)) return false;
          return true;
        }).map((p) => api.manager.listPlugins().find((x) => x.id === p.id) ?? p);
        grid.replaceChildren(...(items.length ? items.map((p) => pluginCard(p, rerender)) : [h('div', { class: 'vixer-empty' }, 'No plugins match your filters.')]));
      }
      renderGrid();

      const req = all.filter((p) => p.required);
      if (req.length) {
        pane.append(h('h3', { class: 'vixer-h3' }, 'Required Plugins'),
          h('p', { class: 'vixer-sub' }, 'These make everyday use easier, fix problems with the platform and keep Vortex itself improving, so they are always on.'),
          h('div', { class: 'vixer-pgrid' }, ...req.map((p) => pluginCard(p, rerender))));
      }
    }

    // One theme card: name, who made it (a picture and a link to their page, like plugins), a short description and a switch.
    function themeCard(t, rerender) {
      const colors = t.swatch.length ? t.swatch : ['#222', '#333', '#444', '#888'];
      const authors = themeAuthors(t); if (!authors.length) authors.push('Unknown');
      const who = h('span', { class: 'vixer-tmeta' }, ...authors.map((a) => h('button', { class: 'vixer-author-link', title: `See what ${a} made`, onclick: () => openAuthorModal(a, rerender) }, avatarEl(a, 16), h('span', {}, `Made by ${a}`))),
        t.version ? h('em', {}, `v${t.version}`) : null, t.user ? h('em', {}, 'made by you') : null);
      return h('div', { class: `vixer-tcard${t.enabled ? ' on' : ''}` },
        h('div', { class: 'vixer-tcard-top' },
          h('div', { class: 'vixer-tcard-title' }, h('b', { title: t.name }, t.name), who),
          toggle(t.enabled, (on) => { api.manager.setTheme(t.id, on); rerender(); })),
        h('p', { class: 'vixer-tcard-desc' }, t.description || 'No description.'),
        h('div', { class: 'vixer-tcard-foot' },
          h('span', { class: 'vixer-dots' }, ...colors.map((c) => h('i', { style: `background:${c}` }))),
          h('span', { class: `vixer-tag${t.enabled ? ' on' : ''}` }, t.type === 'overlay' ? 'Overlay' : 'Base')));
    }

    // Themes: one card per theme with a switch, two to a row, with a short block of buttons above for your own themes.
    function renderThemes(pane) {
      const list = api.manager.listThemes();
      pane.replaceChildren(h('h2', {}, 'Themes'), h('p', { class: 'vixer-sub' }, 'Switch a theme on or off. A base theme replaces the other base theme; overlays stack on top of it. Changes apply instantly.'));
      const tools = h('div', { class: 'vixer-tools' });
      const tool = (label, ic, fn) => tools.append(h('button', { class: 'vixer-tool', onclick: fn }, icon(ic), h('span', {}, label)));
      if (views()['addon-studio:studio']) tool('Make or import a theme', 'plus', () => open('addon-studio:studio'));
      if (views()['quick-css:css']) tool('Edit Quick CSS', 'code', () => open('quick-css:css'));
      tool('Reload themes', 'refresh', () => api.manager.reload());
      pane.append(h('h3', { class: 'vixer-h3' }, 'Local themes'), h('div', { class: 'vixer-tools-box' }, tools));
      pane.append(h('h3', { class: 'vixer-h3' }, `Themes (${list.length})`));
      const grid = h('div', { class: 'vixer-tgrid' });
      for (const t of list) grid.append(themeCard(t, () => renderThemes(pane)));
      pane.append(list.length ? grid : h('div', { class: 'vixer-empty' }, 'No themes installed. Add .css files to the themes folder.'));
    }

    function views() {
      const v = { plugins: { label: 'Plugins', icon: 'plugins', render: renderPlugins }, themes: { label: 'Themes', icon: 'themes', render: renderThemes } };
      for (const p of api.manager.listPages()) v[p.key] = { label: p.label, icon: p.icon ?? 'page', render: (pane) => p.render(pane) };
      return v;
    }

    function mainOf() { return currentNav?.parentElement?.querySelector(':scope > section.settings-main'); }

    function close() {
      if (!active) return;
      active = null;
      currentNav?.querySelectorAll(`[${GROUP}] button`).forEach((b) => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      for (const b of restore) { b.classList.add('active'); b.setAttribute('aria-current', 'page'); }
      restore = [];
      const main = mainOf();
      main?.classList.remove('vixer-open');
      main?.querySelector(':scope > .vixer-pane')?.remove();
    }

    function open(view) {
      const main = mainOf();
      const spec = views()[view];
      if (!main || !spec) return;
      if (!active) {
        restore = [...currentNav.querySelectorAll('button.active')].filter((b) => !b.closest(`[${GROUP}]`));
        for (const b of restore) { b.classList.remove('active'); b.removeAttribute('aria-current'); }
      }
      active = view;
      currentNav.querySelectorAll(`[${GROUP}] button`).forEach((b) => {
        const on = b.dataset.vixerView === view;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      main.classList.add('vixer-open');
      let pane = main.querySelector(':scope > .vixer-pane');
      if (!pane) { pane = h('div', { class: 'vixer-pane' }); main.append(pane); }
      spec.render(pane);
    }

    function buildGroup() {
      const group = h('div', { [GROUP]: '' }, h('div', { class: 'settings-nav-label', style: 'margin-top:14px' }, 'Vortex'));
      for (const [view, spec] of Object.entries(views())) {
        group.append(h('button', { 'data-vixer-view': view, onclick: () => open(view) }, icon(spec.icon), ' ', spec.label));
      }
      return group;
    }

    function inject() {
      const nav = document.querySelector('nav.settings-nav[aria-label="User settings"]');
      if (nav !== currentNav) { currentNav = nav; active = null; restore = []; }
      if (!nav || nav.querySelector(`[${GROUP}]`)) return;
      nav.append(buildGroup());
      nav.addEventListener('click', (e) => {
        const b = e.target instanceof Element ? e.target.closest('button') : null;
        if (b && nav.contains(b) && !b.closest(`[${GROUP}]`)) close();
      });
    }

    api.manager.onPagesChange(() => {
      if (!currentNav) return;
      const was = active;
      currentNav.querySelector(`[${GROUP}]`)?.remove();
      currentNav.append(buildGroup());
      if (was) currentNav.querySelector(`[data-vixer-view="${was}"]`)?.classList.add('active');
    });
    new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
    inject();
  },
});
