# Vortex website

A static site (no build step), published with **GitHub Pages** at https://proimpacts.github.io/Vortex/.

To publish a change: edit the files here, commit, then run `powershell -ExecutionPolicy Bypass -File publish-website.ps1` from the project folder. It pushes this folder to the `gh-pages` branch, which Pages serves.

Any other static host works too (set its root directory to `website`). The download buttons point at the newest GitHub release: `Vortex.exe` (Windows) and `vortex.sh` (Linux).
