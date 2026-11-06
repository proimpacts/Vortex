# Making a theme

A theme is one `.css` file. If you can write CSS you can make one, and you can try it live without leaving Yapin.

## The fastest way

1. Start Yapin with `npm start`.
2. Open **Settings > Vortex > Create & Import** and press **New theme**.
3. Change the colors in the starter template. Press **Preview** to see them on the real app as you type.
4. Name it and press **Save**, then turn it on from **Themes**.
5. Press **Export file** to get a `.css` file you can send to anyone.

Prefer your own editor? Save a `.css` file in `%APPDATA%\Vortex\themes` (run `npm run addons` to open it), then start Yapin with `npm run dev`. The app reloads every time you save.

## The file

Start the file with a comment block. Everything in it is optional except the name you want people to see.

```css
/*
 * @name My Theme
 * @description One sentence about how it looks.
 * @author Your name
 * @version 1.0.0
 * @website https://example.com/my-theme
 * @type base
 */
```

| Tag | What it does |
| --- | --- |
| `@name` | The title shown on the theme card. |
| `@description` | One line under the title. |
| `@author`, `@version`, `@website` | Shown on the card so people know who to thank. |
| `@type base` | A full look. Turning one on turns another base theme off. This is the default. |
| `@type overlay` | An add-on layer (for example "compact chat") that stacks on top of any base theme. |
| `@default on` | Turn the theme on the first time it is installed. Use sparingly. |

The **file name** is the theme's id: lowercase letters, numbers and dashes, such as `ocean-night.css`. Files that don't follow that are skipped, and the launcher prints why.

The card's color swatch is read from `--bg-rail`, `--bg-side`, `--bg-main` and `--accent`, so set those four.

## Colors: use the variables

Yapin's whole look comes from CSS variables on `:root`. Change the variables and the entire app follows. This is how every built-in theme works.

Put dark colors under `:root:not([data-theme=light])` and light colors under `:root[data-theme=light]`. Both selectors are more specific than the site's own `:root`, so yours win.

### Surfaces

| Variable | What it paints |
| --- | --- |
| `--bg-rail` | The far-left server list and the frame around everything. |
| `--bg-side` | The channel list and side panels. |
| `--bg-main` | The chat area. |
| `--bg-elev` | Cards and raised surfaces. |
| `--bg-hover`, `--bg-active` | Hover and selected states. |
| `--bg-input` | Text boxes. |
| `--bg-float`, `--bg-floating` | Popups and menus. |

### Text and lines

| Variable | What it paints |
| --- | --- |
| `--text` | Main text. |
| `--text-muted` | Secondary text, descriptions. |
| `--text-faint` | The quietest text, timestamps. |
| `--border` | Hairlines between things. |

### Accent and status

| Variable | What it paints |
| --- | --- |
| `--accent` | Links, highlights, the active-channel bar. |
| `--accent-hover`, `--accent-soft` | Hover color and a see-through version for backgrounds. |
| `--accent-fill`, `--accent-fill-hover` | Filled buttons. Make sure white text is readable on it. |
| `--on-accent` | Text on a filled button. |
| `--danger`, `--success`, `--warning` | Errors, "on" switches and online dots, cautions. |

### Shape and type

`--radius`, `--row-radius`, `--shadow`, `--font`.

The Yapin Refresh theme adds `--r-sm`, `--r-md`, `--r-lg` (6, 10 and 16 px) and `--display`, the heading font. Use them when you build on it.

### Voice panel and account card

The voice-call panel and your account card are styled by the **Panels** theme from these variables, so you can restyle both without writing a selector:

| Variable | Meaning |
| --- | --- |
| `--vx-card-bg`, `--vx-card-border` | Card background and outline. |
| `--vx-card-radius`, `--vx-card-shadow`, `--vx-card-pad` | Corners, shadow, inner spacing. |
| `--vx-btn-bg`, `--vx-btn-hover` | The round call buttons. |
| `--vx-btn-radius`, `--vx-btn-h` | Their shape and height. |

```css
:root:not([data-theme=light]) {
  --vx-card-bg: #1b1030;
  --vx-card-radius: 20px;
  --vx-btn-radius: 999px;
}
```

## Going beyond colors

Write normal CSS for anything else. Useful class names:

| Part of the app | Selector |
| --- | --- |
| Server list | `nav.rail`, `.rail-item`, `.rail-pill` |
| Channel list | `.sidebar`, `.sidebar-head`, `.channel-row`, `.channel-row.active` |
| Chat header | `.main-head` |
| A message | `.msg`, `.msg-author`, `.msg-time`, `.msg-text`, `.msg-actions` |
| Message box | `.composer`, `.composer-box` |
| Member list | `.members-panel`, `.pick-row` |
| Right-click menus | `.ctx-menu` |
| Settings pages | `.settings`, `.settings-nav`, `.settings-main` |

To find more, start Yapin with `npm run dev`, open Chrome, go to `http://127.0.0.1:` followed by the number in the `.vixer-port` file (in the Vortex folder), and press **inspect** on the Yapin page. You get the normal browser developer tools for the real app.

## Things that trip people up

- **My color doesn't change.** Some elements set colors inline. Add `!important` to your rule for those.
- **Panels look see-through.** If the user has a color tint on, the site makes the theme colors partly transparent on purpose. Layer over a solid color if you need a solid panel.
- **Class names can change.** Yapin is updated by its own team. Variables are far more stable than class names, so prefer variables where you can.
- **Test light mode too.** Add a `:root[data-theme=light]` block, or say in `@description` that the theme is dark only.

## Publishing checklist

- Fill in `@name`, `@description`, `@author`, `@version`.
- Check it in dark and light, and with the voice panel open.
- Keep the file under 500 KB.
- Don't include other people's images or fonts you don't have the right to share. Link to them instead.
