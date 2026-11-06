<div align="center">

<img src="assets/icon.png" alt="Vortex" width="110" height="110">

# Vortex

**Plugins, themes and a better Settings for the Yapin desktop app.**
Vortex starts Yapin for you and never edits its files.

![Version](https://img.shields.io/badge/version-0.3.1-7c5cff?style=flat-square)
![Status](https://img.shields.io/badge/status-alpha-f59e0b?style=flat-square)
![Plugins](https://img.shields.io/badge/plugins-68-8b5cf6?style=flat-square)
![Themes](https://img.shields.io/badge/themes-25-ec4899?style=flat-square)
![Platforms](https://img.shields.io/badge/Windows%20%C2%B7%20Linux-5a5a6e?style=flat-square)

[Website](https://proimpacts.github.io/Vortex/) · [Install](#install) · [Plugins](#plugins) · [Repository](#the-repository) · [Support](#support)

</div>

> **Alpha.** Vortex works and is used every day, but expect some rough edges. It is an unofficial community project and is not made by, or affiliated with, the people behind Yapin.

## Install

You need the Yapin desktop app first ([yapper.website](https://www.yapper.website/download)).

### Windows

Download **`Vortex.exe`** from the [latest release](https://github.com/proimpacts/Vortex/releases/latest), open it and choose **Install**. It is one file, about 33 MB, and needs nothing else, not even Node.js. If Yapin is open, Vortex closes it and starts it again with Vortex. Then open Yapin's **Settings** and scroll to **Vortex**.

The file is not code-signed yet, so Windows may show a SmartScreen warning. Only continue if you downloaded it from this page.

### Linux

Save the Yapin AppImage in your home folder or Downloads, download **`vortex.sh`** from the latest release, then:

```bash
chmod +x vortex.sh
./vortex.sh
```

It uses your Node.js 22 or newer, or downloads the official build and checks it first. It needs no root access and keeps everything in your home folder.

### From source

Needs [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/proimpacts/Vortex.git
cd Vortex
npm start
```

| Command | What it does |
| --- | --- |
| `npm start` | Starts Yapin with Vortex |
| `npm run dev` | The same, and Yapin reloads when you save a plugin or theme file |
| `npm run addons` | Opens the folder for your own plugins and themes |

To build the one-file Windows app yourself: `powershell -ExecutionPolicy Bypass -File build-exe.ps1` (it writes `dist\Vortex.exe`).

The launcher has four choices: **Install**, **Repair**, **Uninstall**, and **Uninstall and Delete All Data**, which removes every trace of Vortex for your user. If Yapin is open when you choose one, Vortex closes it for you.

## Plugins

Vortex has **68 plugins** in the Windows app: **7 required** and **61 optional**. Optional plugins are off until you turn them on in Settings > Vortex > Plugins, and each has its own settings.

| Category | Optional plugins |
| --- | ---: |
| Appearance | 21 |
| Chat | 17 |
| Utility | 8 |
| Messages | 5 |
| Organization | 4 |
| Privacy | 3 |
| Channels, Navigation, Media | 1 each |

The **required plugins** are always on and have no switch, because they are what make Vortex usable. They are the ones in this repository:

| Plugin | What it does |
| --- | --- |
| **Vortex Settings** | The Vortex pages inside Settings: plugins, themes, add-ons |
| **Settings Overhaul** | The full-screen Settings those pages live in |
| **Settings Pages** | Lets plugins add their own pages to Settings |
| **UI Enhancements** | Small fixes Vortex relies on, and makes plugin pop-ups follow your theme |
| **Auto Update** | Checks this repository for a newer version and installs it safely |
| **Welcome Notice** | A short heads-up the first time you run Vortex |
| **Helper Support** | Offers to join the Vortex support server, once |

The 61 optional plugins come with the Windows app. They cover search, quick chat, a message logger, a saved-messages inbox, a quick switcher, a music player, fonts and sizes, focus tools and more.

### Themes

25 themes: `amber-crt` · `amoled` · `aurora-glass` · `blueprint` · `brutalist` · `catppuccin-mocha` · `compact-chat` · `deck` · `discord` · `dracula` · `larger-text` · `matrix` · `midnight` · `mountain-dusk` · `neon-tokyo` · `nord` · `ocean-deep` · `panels` · `quiet-reader` · `refresh` (default) · `retro-98` · `rose-pine` · `sakura-night` · `synthwave` · `terminal`. A theme is one `.css` file.

### Make your own

A plugin is one `.js` file:

```js
definePlugin({
  name: 'HelloWorld',
  description: 'Says hello in the console.',
  authors: 'You',
  start(api) {
    api.log('hello from my plugin');
  },
});
```

Put your own plugins and themes in `%APPDATA%\Vortex` (Windows) or `~/.config/Vortex` (Linux); `npm run addons` opens that folder, and updates never touch it. Guides: [docs/PLUGINS.md](docs/PLUGINS.md) and [docs/THEMES.md](docs/THEMES.md), with starter files in `templates/`.

> Plugins can read and change everything in Yapin, including messages. Only install ones you wrote or trust.

## The repository

| Path | What it is |
| --- | --- |
| `launcher.mjs`, `src/` | The launcher, the add-on loader, backup, updater and window helpers |
| `plugins/` | The 7 required plugins |
| `themes/` | The 25 themes |
| `Vortex.cs`, `Launcher.cs`, `build-exe.ps1` | The Windows app and its one-step build |
| `linux/vortex.sh` | The Linux launcher |
| `docs/`, `templates/` | Guides and starter files for plugin and theme authors |
| `website/` | The project website (static, no build step) |
| `CHANGELOG.md`, `LICENSE`, `NOTICE` | Change history, license and credits |

## Known limits

- Windows is the main target. Linux support is newer.
- The optional plugins ship with the Windows app, so the Linux script currently installs the 7 required ones.
- Updates read this page's releases, so they only work while it is public.
- Yapin updates can break plugins until they are fixed.

## Support

Join the Vortex support server: <https://yapin.gg/invite/Z6TnHq6ZTs>. When you report a bug, say what you did, what you expected, your Vortex version and system, and which theme and plugins are on. Never post tokens or passwords.

## License

Made by [proimpacts](https://github.com/proimpacts). Licensed under the [Apache License 2.0](LICENSE): keep the copyright notice and the [NOTICE](NOTICE) file, and don't use the Vortex name to suggest your version is the original. The Settings icons are [Material Symbols](https://github.com/google/material-design-icons) by Google (Apache 2.0).
