// Why: Pages made by different plugins would each look slightly different. One shared design system, built on the active theme's colours, keeps them consistent.
definePlugin({
  name: 'SettingsPages',
  description: 'Gives every settings page one clean look: clearer titles, section labels, rows, form fields and buttons. Follows your theme.',
  authors: 'proimpacts',
  tags: ['Appearance', 'Settings'],
  options: {
    restyle: { type: 'boolean', label: 'Restyle settings pages', description: 'Turn off to see the site\u2019s original settings pages.', default: true },
  },
  onOptionChange() { window.dispatchEvent(new CustomEvent('vixer:settings-pages')); },
  start(api) {
    api.addStyle(`
/* ---- Settings pages: one consistent design system, built on the active theme's colors ---- */
:root.vx-spage .settings-main {
  --vx-row-gap: 16px;
}

/* Page title */
:root.vx-spage .settings-main h2 {
  margin: 0 0 24px;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

/* Section labels: small, bold, uppercase, with a divider above each one after the first. */
:root.vx-spage .settings-main :is(.pe-section, .section-label, .acct-section, .ss2-section-title) {
  margin: 36px 0 14px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  line-height: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
:root.vx-spage .settings-main h2 + :is(.pe-section, .section-label, .acct-section),
:root.vx-spage .settings-main :is(.pe-section, .section-label, .acct-section):first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
:root.vx-spage .settings-main h3 {
  margin: 28px 0 6px;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--text);
}

/* Helper text */
:root.vx-spage .settings-main :is(.hint, p.hint, div.hint, span.hint) {
  font-size: 14px;
  line-height: 20px;
  color: var(--text-muted);
}
:root.vx-spage .settings-main p.hint,
:root.vx-spage .settings-main div.hint {
  margin: 0 0 14px;
}

/* On/off rows: title and description on the left, the switch on the right, a hairline between rows. */
:root.vx-spage .settings-main .toggle-row {
  gap: 24px;
  padding: var(--vx-row-gap) 0;
  border-bottom: 1px solid var(--border);
}
:root.vx-spage .settings-main .toggle-row .toggle-label {
  display: block;
  font-size: 16px;
  line-height: 22px;
  font-weight: 500;
  color: var(--text);
}
:root.vx-spage .settings-main .toggle-row .hint {
  display: block;
  margin: 4px 0 0;
}
:root.vx-spage .settings-main .toggle-row:hover .toggle-label {
  color: var(--text);
}
:root.vx-spage .settings-main .toggle-row:last-child {
  border-bottom: 0;
}

/* Form fields */
:root.vx-spage .settings-main .field {
  gap: 8px;
  margin-bottom: 20px;
}
:root.vx-spage .settings-main .field label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
:root.vx-spage .settings-main :is(input[type=text], input[type=search], input[type=password], input[type=email], input[type=number], input[type=url], textarea, select) {
  box-sizing: border-box;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text);
  font: inherit;
  font-size: 15px;
  transition: border-color 0.12s, box-shadow 0.12s;
}
:root.vx-spage .settings-main :is(input[type=text], input[type=search], input[type=password], input[type=email], input[type=number], input[type=url], textarea, select):focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
:root.vx-spage .settings-main textarea {
  min-height: 96px;
  line-height: 1.45;
}
:root.vx-spage .settings-main input[type=range] {
  accent-color: var(--accent);
}

/* Buttons */
:root.vx-spage .settings-main .btn {
  min-height: 38px;
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.12s, color 0.12s, border-color 0.12s;
}
:root.vx-spage .settings-main .btn.small {
  min-height: 34px;
  padding: 6px 14px;
}
:root.vx-spage .settings-main .btn.ghost {
  border: 1px solid var(--border);
  color: var(--text);
}
:root.vx-spage .settings-main .btn.ghost:hover {
  background: var(--bg-hover);
  border-color: var(--bg-active);
}
:root.vx-spage .settings-main .btn.secondary {
  background: var(--bg-active);
  color: var(--text);
}
:root.vx-spage .settings-main .btn.secondary:hover {
  background: var(--bg-hover);
}
:root.vx-spage .settings-main .btn.danger {
  border-radius: 6px;
}

/* Segmented controls and list rows */
:root.vx-spage .settings-main .seg {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
}
:root.vx-spage .settings-main .seg button {
  border-radius: 6px;
}
:root.vx-spage .settings-main .pe-row {
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
}
:root.vx-spage .settings-main .pe-row:hover {
  background: var(--bg-hover);
}

/* Option tiles (theme, tint, input mode, language) */
:root.vx-spage .settings-main .theme-option,
:root.vx-spage .settings-main .tint-tile,
:root.vx-spage .settings-main .aus-mode {
  border-radius: 10px;
}
:root.vx-spage .settings-main .aus-mode {
  border: 1px solid var(--border);
  background: var(--bg-elev);
}
:root.vx-spage .settings-main .aus-mode.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* Cards the site already groups content in */
:root.vx-spage .settings-main :is(.ss2-card, .tint-custom, .acct-card, .shards-card) {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elev);
}

/* Calm scrollbar inside the page */
:root.vx-spage .settings-main {
  scrollbar-width: thin;
}

/* Labels line up with the content (the site indents some of them by 8px). */
:root.vx-spage .settings-main :is(.pe-section, .section-label, .acct-section) {
  padding-left: 0;
  padding-right: 0;
}

/* The account banner is locked to a 3:1 ratio, which made it enormous in a wide window. Cap it. */
:root.vx-spage .settings-main .acct-banner {
  height: clamp(150px, 16vw, 230px) !important;
  overflow: hidden;
}
:root.vx-spage .settings-main .acct-banner .banner {
  aspect-ratio: auto !important;
  height: 100% !important;
}
:root.vx-spage .settings-main .acct-banner img {
  width: 100%;
  height: 100% !important;
  object-fit: cover;
}


`);
    const apply = () => document.documentElement.classList.toggle('vx-spage', !!api.options.get('restyle'));
    apply();
    window.addEventListener('vixer:settings-pages', apply);
  },
});