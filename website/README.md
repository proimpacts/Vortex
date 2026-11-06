# Vortex website

A static site (no build step). To put it on Vercel: import the repository, set the **Root Directory** to `website`, and deploy. Any static host works the same way.

The download buttons point at the newest GitHub release: `Vortex.exe` (Windows) and `vortex.sh` (Linux). Upload those two files to each release (`dist\Vortex.exe` from `build-exe.ps1`, and `linux/vortex.sh`) and the site always links to the latest ones.
