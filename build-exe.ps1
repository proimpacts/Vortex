# Builds dist\Vortex.exe: ONE file with everything inside it (Node.js and all of Vortex), using the compiler that ships with Windows.
# Needs Node.js installed on THIS PC only to copy it into the exe; the finished exe does not need Node, or any other file, to run.
# The exe still needs the Yapin desktop app (Yapper) installed, because that is the app it starts.
# It is built from this folder, so it includes every plugin and theme in it. Run it again after you change something.
param([string]$OutFile = '')
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here 'dist'
$stage = Join-Path $dist 'stage'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$node = (Get-Command node -ErrorAction Stop).Source

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage, (Join-Path $stage 'assets') | Out-Null
foreach ($f in 'launcher.mjs', 'package.json', 'version.json', 'LICENSE', 'NOTICE') { if (Test-Path (Join-Path $here $f)) { Copy-Item (Join-Path $here $f) $stage } }
foreach ($d in 'src', 'plugins', 'themes', 'templates', 'docs') { if (Test-Path (Join-Path $here $d)) { Copy-Item (Join-Path $here $d) (Join-Path $stage $d) -Recurse } }
foreach ($a in 'icon.ico', 'icon.png') { Copy-Item (Join-Path $here "assets\$a") (Join-Path $stage 'assets') }
Copy-Item $node (Join-Path $stage 'node.exe')

# One zip with forward-slash names (the exe unpacks it on first run).
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = Join-Path $dist 'payload.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
$z = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  $root = (Resolve-Path $stage).Path.TrimEnd('\') + '\'
  foreach ($file in Get-ChildItem $stage -Recurse -File) {
    $name = $file.FullName.Substring($root.Length).Replace('\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $file.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal)
  }
} finally { $z.Dispose() }

# The build id names the folder the exe unpacks to, so a new build never mixes with an old one.
$id = (Get-FileHash $zip -Algorithm SHA256).Hash.Substring(0, 16).ToLower()
$idFile = Join-Path $dist 'buildid.txt'
[IO.File]::WriteAllText($idFile, $id)

$out = if ($OutFile) { $OutFile } else { Join-Path $dist 'Vortex.exe' }  # build to another name if the current Vortex.exe is running
& $csc /nologo /target:winexe /optimize+ /codepage:65001 /out:"$out" /win32icon:"$here\assets\icon.ico" `
  /reference:System.Management.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll `
  /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll `
  /resource:"$zip,payload.zip" /resource:"$idFile,buildid.txt" "$here\Vortex.cs" "$here\Launcher.cs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item $stage -Recurse -Force
Write-Host ("Built {0} ({1:N1} MB, build {2})" -f $out, ((Get-Item $out).Length / 1MB), $id)
