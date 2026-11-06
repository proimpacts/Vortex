// Colors Yapper's own window frame (the title bar with the icon and the minimize / maximize / close buttons).
// That bar belongs to Windows, not to the web page, so the page cannot style it. This asks Windows (DWM) to draw it in a chosen
// color, with light or dark buttons. It only touches Yapper's own window, only changes how it is drawn, and sends nothing anywhere.
// Windows 11 draws the caption color; Windows 10 only switches the bar to its dark look.
import { execFile } from 'node:child_process';

export const HEX6 = /^#?[0-9a-f]{6}$/i;
export const normHex = (c) => (HEX6.test(String(c)) ? String(c).replace('#', '').toLowerCase() : null);
// Black or near-white text and buttons, whichever reads on the given color.
export function textFor(hex) {
  const n = parseInt(hex, 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '1a1a1a' : 'ececec';
}

const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class VxDwm { [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int val, int size); }'
function Col($hex) { return ([Convert]::ToInt32($hex.Substring(4,2),16) * 65536) + ([Convert]::ToInt32($hex.Substring(2,2),16) * 256) + [Convert]::ToInt32($hex.Substring(0,2),16) }
$dark = if ($env:VX_DARK -eq '1') { 1 } else { 0 }
$n = 0
foreach ($p in (Get-Process -Name Yapper -ErrorAction SilentlyContinue)) {
  if ($p.MainWindowHandle -eq 0) { continue }
  $h = $p.MainWindowHandle
  [void][VxDwm]::DwmSetWindowAttribute($h, 20, [ref]$dark, 4)
  $c = Col $env:VX_BG;  [void][VxDwm]::DwmSetWindowAttribute($h, 35, [ref]$c, 4)
  $b = Col $env:VX_BG;  [void][VxDwm]::DwmSetWindowAttribute($h, 34, [ref]$b, 4)
  $t = Col $env:VX_FG;  [void][VxDwm]::DwmSetWindowAttribute($h, 36, [ref]$t, 4)
  $n++
}
Write-Output ('windows:' + $n)
`;

export function setTitleBar(color) {
  const bg = normHex(color);
  if (!bg || process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'not available' });
  const fg = textFor(bg);
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
      env: { ...process.env, VX_BG: bg, VX_FG: fg, VX_DARK: fg === 'ececec' ? '1' : '0' }, timeout: 20000, windowsHide: true,
    }, (err, stdout) => resolve(err ? { ok: false, error: String(err.message).slice(0, 200) } : { ok: true, bg, fg, windows: Number(/windows:(\d+)/.exec(stdout)?.[1] ?? 0) }));
  });
}

// Hides or shows Yapper's window title bar (the Windows caption: icon, title, minimize / maximize / close). Hiding takes the caption
// style off the window, which gives the page that space; showing puts it back. It only changes how Yapper's own window is drawn.
// Without the bar the window cannot be dragged by it: Win+Arrow keys snap it, Alt+Space opens the window menu, Alt+F4 closes it.
const FRAME_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class VxFrame { [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr Get(IntPtr h, int i); [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW")] public static extern IntPtr Set(IntPtr h, int i, IntPtr v); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f); }'
$hide = $env:VX_HIDE -eq '1'
$n = 0
foreach ($p in (Get-Process -Name Yapper -ErrorAction SilentlyContinue)) {
  if ($p.MainWindowHandle -eq 0) { continue }
  $h = $p.MainWindowHandle
  $s = [int64][VxFrame]::Get($h, -16)
  if ($hide) { $s = $s -band (-bnot 0xC00000L) } else { $s = $s -bor 0xC00000L }
  [void][VxFrame]::Set($h, -16, [IntPtr]$s)
  [void][VxFrame]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 0, 0, 0x37)
  $n++
}
Write-Output ('windows:' + $n)
`;

export function setFrameHidden(hide) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'not available' });
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', FRAME_SCRIPT], {
      env: { ...process.env, VX_HIDE: hide ? '1' : '0' }, timeout: 20000, windowsHide: true,
    }, (err, stdout) => resolve(err ? { ok: false, error: String(err.message).slice(0, 200) } : { ok: true, hidden: !!hide, windows: Number(/windows:(\d+)/.exec(stdout)?.[1] ?? 0) }));
  });
}

// Minimize, maximize (or restore) and close for Yapper's own window, for the small buttons NoTitleBar draws in the page.
// Close is the normal "close this window" request, so Yapper decides what to do (for example hide to the tray), exactly as if you pressed X.
const ACTION_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class VxAct { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h); [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f); }'
foreach ($p in (Get-Process -Name Yapper -ErrorAction SilentlyContinue)) {
  if ($p.MainWindowHandle -eq 0) { continue }
  $h = $p.MainWindowHandle
  switch ($env:VX_ACT) {
    'minimize' { [void][VxAct]::ShowWindow($h, 6) }
    'maximize' { if ([VxAct]::IsZoomed($h)) { [void][VxAct]::ShowWindow($h, 9) } else { [void][VxAct]::ShowWindow($h, 3) } }
    'close' { [void][VxAct]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero) }
    'topmost-on' { [void][VxAct]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x13) }
    'topmost-off' { [void][VxAct]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 0x13) }
  }
  break
}
`;
export const WINDOW_ACTIONS = new Set(['minimize', 'maximize', 'close', 'topmost-on', 'topmost-off']);
export function windowAction(op) {
  if (process.platform !== 'win32' || !WINDOW_ACTIONS.has(op)) return Promise.resolve({ ok: false, error: 'not available' });
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ACTION_SCRIPT], { env: { ...process.env, VX_ACT: op }, timeout: 15000, windowsHide: true },
      (err) => resolve(err ? { ok: false, error: String(err.message).slice(0, 200) } : { ok: true, op }));
  });
}
