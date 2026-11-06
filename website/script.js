// Vortex website: a working copy of the launcher, plugin switches, theme-colour chips, and the download section's small helpers.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  // ---- The launcher, working. Same four choices as the real one. ----
  (function () {
    var term = $('term'); if (!term) return;
    var BANNER = [
      ['t1', '██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗'],
      ['t1', '██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝'],
      ['t2', '██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ '],
      ['t2', '╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ '],
      ['t3', ' ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗'],
      ['t3', '  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝']
    ];
    var ITEMS = [['Install', 'Start Yapin with Vortex'], ['Repair', "Put Vortex's files back"], ['Uninstall', 'Keep your settings'], ['Uninstall and Delete All Data', 'Wipe every trace']];
    var SCRIPTS = [
      [['pr', '> ', 'Closing Yapin...'], ['ok', '+ ', 'Yapin is closed.'], ['pr', '> ', 'Setting up Vortex...'], ['ok', '+ ', 'Vortex 0.3.2 is ready.'], ['pr', '> ', 'Adding a desktop shortcut...'], ['ok', '+ ', 'Shortcut added.'], ['pr', '> ', 'Starting Yapin with Vortex...'], ['m', '  ', 'That was a demo, so nothing was installed.']],
      [['pr', '> ', 'Closing Yapin...'], ['ok', '+ ', 'Yapin is closed.'], ['pr', '> ', "Putting Vortex's files back..."], ['ok', '+ ', 'Done. Your settings, plugins and backups were not touched.'], ['m', '  ', 'That was a demo.']],
      [['pr', '> ', 'Remove files from this PC? Your settings are kept.'], ['m', '  ', 'The real launcher asks first.'], ['m', '  ', 'That was a demo, so nothing was removed.']],
      [['pr', '> ', 'Delete everything and remove Vortex? (asks first)'], ['pr', '> ', 'Closing Yapin...'], ['pr', '> ', "Clearing Vortex's settings from Yapin..."], ['ok', '+ ', 'Done.'], ['pr', '> ', 'Removing Vortex...'], ['ok', '+ ', "All of Vortex's data was deleted."], ['m', '  ', 'That was a demo, so nothing was removed.']]
    ];
    var sel = 0, log = [], busy = false, touched = false;
    var pad = function (s, n) { return (s + new Array(n + 1).join(' ')).slice(0, n); };
    function draw() {
      var out = [];
      BANNER.forEach(function (b) { out.push('   <span class="' + b[0] + '">' + b[1] + '</span>'); });
      out.push('', '   <span class="m">plugins and themes for Yapin  ·  v0.3.2</span>', '');
      out.push('   <span class="bd">╭' + new Array(67).join('─') + '╮</span>');
      ITEMS.forEach(function (it, i) {
        var line = pad('  ' + (i === sel ? '▸' : ' ') + ' ' + (i + 1) + '  ' + pad(it[0], 31) + it[1], 65);
        out.push('   <span class="bd">│</span><span class="row' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' + line + ' </span><span class="bd">│</span>');
      });
      out.push('   <span class="bd">╰' + new Array(67).join('─') + '╯</span>', '');
      log.forEach(function (l) { out.push('   <span class="' + l[0] + '">' + l[1] + '</span><span class="step">' + l[2] + '</span>'); });
      out.push('', '   <span class="m">↑ ↓ to move  ·  Enter to choose  ·  Esc to leave</span>' + (busy ? '' : ' <span class="cur"></span>'));
      term.innerHTML = out.join('\n');
    }
    function run(i) {
      if (busy) return; busy = true; sel = i; log = []; draw();
      var s = SCRIPTS[i], k = 0;
      (function next() {
        if (k >= s.length) { busy = false; draw(); return; }
        log.push(s[k++]); draw();
        setTimeout(next, reduce ? 0 : 480);
      })();
    }
    term.addEventListener('click', function (e) {
      var r = e.target.closest ? e.target.closest('.row') : null; touched = true;
      if (r) run(Number(r.dataset.i)); else term.focus();
    });
    term.addEventListener('keydown', function (e) {
      if (busy) return; touched = true;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % 4; draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + 3) % 4; draw(); }
      else if (e.key >= '1' && e.key <= '4') { e.preventDefault(); run(Number(e.key) - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      else if (e.key === 'Escape') { log = []; draw(); }
    });
    draw();
    // once, when it first comes into view, it shows what Install does
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && !touched) { io.disconnect(); setTimeout(function () { if (!touched) run(0); }, 1100); }
      }, { threshold: 0.6 });
      io.observe(term);
    }
  })();

  // ---- Plugin switches ----
  var tg = $('toggles');
  if (tg) tg.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });

  // ---- Theme colours: clicking one gives this page that theme's main colour ----
  (function () {
    var box = $('chips'), note = $('chip-note'); if (!box) return;
    var THEMES = [
      ['Vortex violet', '#6d4aff'], ['Terminal', '#12a650'], ['Amber CRT', '#d98e00'], ['Matrix', '#0fa84a'], ['Retro 98', '#000080'],
      ['Brutalist', '#ff2e00'], ['Blueprint', '#1d6fb8'], ['Synthwave', '#d416a8'], ['Neon Tokyo', '#ff3fd0'], ['Aurora Glass', '#7b63ff'],
      ['Mountain Dusk', '#e2692a'], ['Sakura Night', '#d6457f'], ['Ocean Deep', '#139e92'], ['Deck', '#2f6df0'], ['Nord', '#5e81ac'],
      ['Dracula', '#9b6dff'], ['Rose Pine', '#907aa9'], ['Midnight', '#5566ee']
    ];
    var root = document.documentElement;
    function onColor(hex) {
      var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? '#17122b' : '#ffffff';
    }
    THEMES.forEach(function (t, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.innerHTML = '<i style="background:' + t[1] + '"></i>' + t[0];
      b.addEventListener('click', function () {
        root.style.setProperty('--accent', t[1]); root.style.setProperty('--on-accent', onColor(t[1]));
        var all = box.children; for (var k = 0; k < all.length; k++) all[k].setAttribute('aria-pressed', all[k] === b ? 'true' : 'false');
        note.textContent = i === 0 ? 'Showing the Vortex violet.' : 'Showing the ' + t[0] + ' colour. In Vortex the whole app changes, not just the buttons.';
      });
      box.appendChild(b);
    });
  })();

  // ---- Downloads: mark the card for the visitor's system, and fill in the version and sizes when GitHub answers ----
  var linux = /linux|x11/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);
  var cards = document.querySelectorAll('.os');
  if (cards.length === 2) {
    var mine = cards[linux ? 1 : 0], tag = document.createElement('span');
    tag.className = 'pill for-you'; tag.textContent = 'For your computer'; mine.querySelector('.os-top').appendChild(tag);
    if (linux) mine.parentNode.insertBefore(mine, cards[0]);
  }
  var size = function (n) { return n >= 1048576 ? Math.round(n / 1048576) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
  var gv = $('get-ver');
  if (window.fetch) {
    fetch('https://api.github.com/repos/proimpacts/Vortex/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.tag_name) return;
        if (gv) gv.textContent = 'Latest release: version ' + String(j.tag_name).replace(/^v/, '');
        (j.assets || []).forEach(function (a) {
          var el = a.name === 'Vortex.exe' ? $('size-win') : a.name === 'vortex.sh' ? $('size-lin') : null;
          if (el) el.textContent = size(a.size);
        });
      })
      .catch(function () { /* offline, or not published yet: keep the plain text */ });
  }

  // ---- Copy button for the Linux commands ----
  var copy = $('copy-cmd'), cmd = $('linux-cmd');
  if (copy && cmd) copy.addEventListener('click', function () {
    var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(cmd.textContent).then(done, done); else done();
  });
})();
