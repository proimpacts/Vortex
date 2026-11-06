# Publishes the website/ folder to GitHub Pages by pushing its files to the gh-pages branch.
# Run it after you change something in website/:   powershell -ExecutionPolicy Bypass -File publish-website.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$remote = (git -C $root remote get-url origin).Trim()
$tmp = Join-Path $env:TEMP ('vortex-pages-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $tmp | Out-Null
try {
  Copy-Item (Join-Path $root 'website\*') $tmp -Recurse -Exclude 'README.md', 'vercel.json'
  New-Item -ItemType File (Join-Path $tmp '.nojekyll') | Out-Null   # no Jekyll build: the files are served as they are
  git -C $tmp init -q -b gh-pages
  git -C $tmp config user.name  (git -C $root config user.name)
  git -C $tmp config user.email (git -C $root config user.email)
  git -C $tmp add -A
  git -C $tmp commit -q -m 'Publish the website'
  git -C $tmp push --force -q $remote gh-pages
  Write-Host 'Published. It is live at https://proimpacts.github.io/Vortex/ in a minute or two.'
} finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
