// Vortex.exe: one self-contained file that starts Yapin with Vortex, with no console window. Build with build-exe.ps1 (no extra tools needed).
// The file carries everything it needs: Node.js and all of Vortex's own files are packed inside it (payload.zip). The first time it runs,
// it unpacks them to %LOCALAPPDATA%\Vortex\runtime\<build id>, and every later start reuses that folder. Why unpack instead of running
// from memory: Node and the launcher read real files (plugins, themes, scripts), and an unpacked copy lets Auto Update replace them.
using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

static partial class Vortex
{
    static void Fail(string text) { MessageBox.Show(text, "Vortex", MessageBoxButtons.OK, MessageBoxIcon.Warning); }


    // ---- Make Yapin's window look like Vortex: our icon in the title bar, Alt-Tab and taskbar, and its own taskbar identity ----
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr h);
    [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr h, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore store);
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant pv);
    [StructLayout(LayoutKind.Sequential)] struct PropKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Sequential)] struct PropVariant { public ushort vt, r1, r2, r3; public IntPtr p; public IntPtr p2; }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint c);
        [PreserveSig] int GetAt(uint i, out PropKey k);
        [PreserveSig] int GetValue(ref PropKey k, out PropVariant v);
        [PreserveSig] int SetValue(ref PropKey k, ref PropVariant v);
        [PreserveSig] int Commit();
    }
    static readonly Guid AumidGuid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
    static Icon bigIcon, smallIcon;

    static List<IntPtr> YapinWindows()
    {
        var pids = new HashSet<uint>(); foreach (var p in Process.GetProcessesByName("Yapper")) pids.Add((uint)p.Id);
        var found = new List<IntPtr>();
        EnumWindows((h, l) =>
        {
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pids.Contains(pid) && IsWindowVisible(h) && GetWindow(h, 4) == IntPtr.Zero && GetWindowTextLength(h) > 0) found.Add(h); // top-level, visible, titled
            return true;
        }, IntPtr.Zero);
        return found;
    }
    static void SetProp(IPropertyStore store, uint pid, string value)
    {
        var key = new PropKey { fmtid = AumidGuid, pid = pid };
        var pv = new PropVariant { vt = 31, p = Marshal.StringToCoTaskMemUni(value) }; // VT_LPWSTR
        store.SetValue(ref key, ref pv); PropVariantClear(ref pv);
    }
    static void Brand(string exePath, string icoPath)
    {
        if (bigIcon == null)
        {
            try { bigIcon = new Icon(icoPath, 32, 32); smallIcon = new Icon(icoPath, 16, 16); }
            catch { return; }
        }
        foreach (var h in YapinWindows())
        {
            SendMessage(h, 0x80, (IntPtr)1, bigIcon.Handle);   // WM_SETICON, ICON_BIG
            SendMessage(h, 0x80, (IntPtr)0, smallIcon.Handle); // ICON_SMALL
            try
            {
                Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"); IPropertyStore store;
                if (SHGetPropertyStoreForWindow(h, ref iid, out store) == 0 && store != null)
                {
                    SetProp(store, 5, "Vortex.App");                       // AppUserModel.ID: its own taskbar group
                    SetProp(store, 2, "\"" + exePath + "\" --launch");               // RelaunchCommand: pinning it starts Vortex
                    SetProp(store, 3, icoPath + ",0");                      // RelaunchIconResource
                    SetProp(store, 4, "Vortex");                            // RelaunchDisplayNameResource
                    store.Commit(); Marshal.ReleaseComObject(store);
                }
            }
            catch { /* the icon is already changed; the grouping is a bonus */ }
        }
    }

    static string RuntimeBase() { return Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? Path.GetTempPath(), "Vortex", "runtime"); }
    // Removes every unpacked copy (Repair unpacks a fresh one; Uninstall leaves none).
    internal static void DeleteRuntime() { if (Directory.Exists(RuntimeBase())) Directory.Delete(RuntimeBase(), true); }
    internal static void ResetRuntime() { DeleteRuntime(); Runtime(); }

    // Unpacks payload.zip (inside this exe) once per build, and returns the folder the files are in.
    static string Runtime()
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        string id;
        using (var s = asm.GetManifestResourceStream("buildid.txt")) using (var r = new StreamReader(s)) id = r.ReadToEnd().Trim();
        string baseDir = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? Path.GetTempPath(), "Vortex", "runtime");
        string dir = Path.Combine(baseDir, id), ready = Path.Combine(dir, ".ready");
        if (File.Exists(ready)) return dir;
        Directory.CreateDirectory(baseDir);
        string tmp = dir + ".tmp" + Process.GetCurrentProcess().Id;
        try
        {
            if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
            Directory.CreateDirectory(tmp);
            string root = Path.GetFullPath(tmp) + Path.DirectorySeparatorChar;
            using (var s = asm.GetManifestResourceStream("payload.zip")) using (var zip = new ZipArchive(s, ZipArchiveMode.Read))
                foreach (var e in zip.Entries)
                {
                    if (e.FullName.EndsWith("/") || e.Name.Length == 0) continue;
                    string target = Path.GetFullPath(Path.Combine(tmp, e.FullName.Replace('/', Path.DirectorySeparatorChar)));
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue; // never write outside the folder
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (var from = e.Open()) using (var to = File.Create(target)) from.CopyTo(to);
                }
            File.WriteAllText(Path.Combine(tmp, ".ready"), id);
            try { Directory.Move(tmp, dir); }
            catch { if (!File.Exists(ready)) throw; } // another copy of Vortex finished first: use its folder
        }
        finally { try { if (Directory.Exists(tmp)) Directory.Delete(tmp, true); } catch { } }
        // Older builds are not needed any more. A copy that is still in use (its node.exe is running, so it cannot be deleted) is left alone.
        try
        {
            foreach (var d in Directory.GetDirectories(baseDir))
            {
                if (string.Equals(Path.GetFileName(d), id, StringComparison.OrdinalIgnoreCase)) continue;
                try { string n = Path.Combine(d, "node.exe"); if (File.Exists(n)) File.Delete(n); Directory.Delete(d, true); } catch { }
            }
        }
        catch { }
        return dir;
    }

    [STAThread]
    static int Main(string[] args)
    {
        string here;
        try { here = Runtime(); }
        catch (Exception ex) { Fail("Vortex couldn't unpack its files.\n\n" + ex.Message); return 1; }
        // A normal start shows the launcher window. "--launch" (shortcuts, the taskbar pin) or the "start right away" setting skips it,
        // and holding Shift, or "--ui", always shows it.
        bool wantUi = Array.IndexOf(args, "--ui") >= 0 || (Array.IndexOf(args, "--launch") < 0 && !SkipUi()) || (Control.ModifierKeys & Keys.Shift) == Keys.Shift;
        bool fromMenu = false;
        if (wantUi) { if (!Tui.Run(here)) return 0; fromMenu = true; }
        return LaunchVortex(here, fromMenu);
    }

    static int LaunchVortex(string here, bool restart)
    {
        string exe = Environment.GetEnvironmentVariable("YAPPER_EXE");
        if (string.IsNullOrEmpty(exe)) exe = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? "", "Programs", "yapper-desktop", "Yapper.exe");

        // Already open? Yapin runs one copy and lives in the tray, so a second start just brings its window back.
        bool launcherUp = false, yapperUp = false;
        try
        {
            using (var q = new ManagementObjectSearcher("select Name, CommandLine from Win32_Process where Name='node.exe' or Name='Yapper.exe'"))
                foreach (ManagementObject p in q.Get())
                {
                    string name = ((p["Name"] as string) ?? "").ToLowerInvariant();
                    if (name == "yapper.exe") yapperUp = true;
                    else if (((p["CommandLine"] as string) ?? "").ToLowerInvariant().Contains("launcher.mjs")) launcherUp = true;
                }
        }
        catch { /* if the process list can't be read, just try to start */ }
        if (launcherUp && yapperUp && !restart) { try { Process.Start(exe); } catch { } return 0; } // the first Vortex.exe keeps the branding applied
        // Yapin (or an earlier Vortex) is still running: close it completely first, so nobody has to quit it by hand.
        if (yapperUp || launcherUp) CloseYapin();
        if (!File.Exists(Path.Combine(here, "launcher.mjs"))) { Fail("Vortex's files are incomplete (launcher.mjs is missing). Delete %LOCALAPPDATA%\\Vortex\\runtime and start Vortex again."); return 1; }

        string appData = Path.Combine(Environment.GetEnvironmentVariable("APPDATA") ?? here, "Vortex");
        Directory.CreateDirectory(appData);
        var log = new StringBuilder();
        var psi = new ProcessStartInfo(Path.Combine(here, "node.exe"), "\"" + Path.Combine(here, "launcher.mjs") + "\"")
        {
            WorkingDirectory = here, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        Process child;
        try { child = Process.Start(psi); }
        catch (Exception ex) { Fail("Vortex's built-in runtime couldn't start.\n\n" + ex.Message); return 1; }
        DataReceivedEventHandler add = (s, e) => { if (e.Data != null) lock (log) log.AppendLine(e.Data); };
        child.OutputDataReceived += add; child.ErrorDataReceived += add;
        child.BeginOutputReadLine(); child.BeginErrorReadLine();
        string self = Process.GetCurrentProcess().MainModule.FileName, ico = Path.Combine(here, "assets", "icon.ico");
        if (!File.Exists(ico)) ico = self;
        while (!child.WaitForExit(1000)) Brand(self, ico); // while the app runs, keep its window wearing the Vortex icon (it comes back from the tray as a new window)
        child.WaitForExit(); // lets the output readers finish
        string text; lock (log) text = log.ToString();
        try { File.WriteAllText(Path.Combine(appData, "launcher.log"), text); } catch { }
        // Only a start that never got going is a failure; a launcher that ran and then stopped is not.
        if (child.ExitCode != 0 && !text.Contains("Injected"))
        {
            if (string.IsNullOrWhiteSpace(text)) text = "It stopped before the app opened.";
            if (text.Length > 600) text = text.Substring(0, 600);
            Fail("Vortex couldn't start.\n\n" + text);
            return 1;
        }
        return 0;
    }
}
