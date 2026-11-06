// The screen Vortex.exe shows when you open it: a small terminal program with three choices (Install, Repair, Uninstall).
// (Compiled together with Vortex.cs by build-exe.ps1. Written for the C# 5 compiler that ships with Windows, so no newer syntax.)
// Why a terminal: it is quick to read, works the same on every Windows PC, and mirrors the Linux launcher (linux/vortex.sh).
// Vortex.exe is a Windows app with no console of its own, so a normal "Launch" shows nothing extra; this screen opens its own console window.
// Why only three choices and no status block: the screen should do one thing. Anything that needs Yapin closed (all three do) closes it
// for you, fully, so there is nothing to check first and nothing to quit by hand.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

static partial class Vortex
{
    // ---- Small settings file: %APPDATA%\Vortex\launcher.json ({"skip":true} starts Yapin straight away, without this screen) ----
    internal static string DataDir() { return Path.Combine(Environment.GetEnvironmentVariable("APPDATA") ?? Path.GetTempPath(), "Vortex"); }
    internal static string SettingsFile() { return Path.Combine(DataDir(), "launcher.json"); }
    internal static bool SkipUi()
    {
        try { return File.Exists(SettingsFile()) && Regex.IsMatch(File.ReadAllText(SettingsFile()), "\"skip\"\\s*:\\s*true"); } catch { return false; }
    }
    internal static void SetSkipUi(bool skip)
    {
        try { Directory.CreateDirectory(DataDir()); File.WriteAllText(SettingsFile(), skip ? "{\"skip\":true}" : "{\"skip\":false}"); } catch { }
    }
    internal static string YapperPath()
    {
        string exe = Environment.GetEnvironmentVariable("YAPPER_EXE");
        if (string.IsNullOrEmpty(exe)) exe = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? "", "Programs", "yapper-desktop", "Yapper.exe");
        return exe;
    }

    // Closes Yapin completely (every Yapper process, tray included) and any Vortex launcher that is still running, and waits until they are gone.
    internal static bool TestMode() { return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("VORTEX_TUI_OUT")); }
    internal static bool YapinOpen()
    {
        if (TestMode()) return false;
        try { if (Process.GetProcessesByName("Yapper").Length > 0) return true; } catch { }
        try
        {
            using (var q = new ManagementObjectSearcher("select CommandLine from Win32_Process where Name='node.exe'"))
                foreach (ManagementObject p in q.Get()) if (((p["CommandLine"] as string) ?? "").ToLowerInvariant().Contains("launcher.mjs")) return true;
        }
        catch { }
        return false;
    }
    internal static void CloseYapin()
    {
        if (TestMode()) return;
        try
        {
            using (var q = new ManagementObjectSearcher("select ProcessId, CommandLine from Win32_Process where Name='node.exe'"))
                foreach (ManagementObject p in q.Get())
                    if (((p["CommandLine"] as string) ?? "").ToLowerInvariant().Contains("launcher.mjs"))
                        try { Process.GetProcessById(Convert.ToInt32(p["ProcessId"])).Kill(); } catch { }
        }
        catch { }
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("taskkill", "/F /T /IM Yapper.exe"); psi.CreateNoWindow = true; psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true; psi.RedirectStandardError = true;
            using (Process k = Process.Start(psi)) { k.StandardOutput.ReadToEnd(); k.StandardError.ReadToEnd(); k.WaitForExit(10000); }
        }
        catch { }
        for (int i = 0; i < 40 && YapinOpen(); i++) Thread.Sleep(250);
    }
}

static class Tui
{
    [DllImport("kernel32.dll")] static extern bool AllocConsole();
    [DllImport("kernel32.dll")] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern bool SetConsoleOutputCP(uint cp);

    static string here, self, latestTag, latestUrl;
    static Queue<char> keys;
    static int sel = 0;
    static List<string> log = new List<string>();

    // "ANSI Shadow" style letters, drawn with block characters (the console is switched to UTF-8 for this)
    static readonly string[] Banner = new string[]
    {
        "██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗",
        "██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝",
        "██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ ",
        "╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ ",
        " ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗",
        "  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝",
    };
    static readonly ConsoleColor[] BannerColors = new ConsoleColor[] { ConsoleColor.Magenta, ConsoleColor.Magenta, ConsoleColor.DarkMagenta, ConsoleColor.DarkMagenta, ConsoleColor.Blue, ConsoleColor.DarkBlue };
    static readonly string[] Names = new string[] { "Install", "Repair", "Uninstall", "Uninstall and Delete All Data" };
    static readonly string[] Notes = new string[] { "Set up Vortex and start Yapin with it", "Put Vortex's files back as they should be", "Remove Vortex, keep your settings", "Remove Vortex and wipe every trace of it" };

    // Opens the console window, shows the menu, and returns true when Yapin should now be started with Vortex.
    public static bool Run(string runtimeDir)
    {
        here = runtimeDir;
        self = Process.GetCurrentProcess().MainModule.FileName;
        // Test hook: VORTEX_TUI_OUT=<file> writes the screen to a file and VORTEX_TUI_KEYS="3 y n" feeds the keys, so the menu can be checked without a window.
        string testOut = Environment.GetEnvironmentVariable("VORTEX_TUI_OUT"); string testKeys = Environment.GetEnvironmentVariable("VORTEX_TUI_KEYS");
        if (!string.IsNullOrEmpty(testOut)) { keys = new Queue<char>((testKeys ?? "0").Replace(" ", "").ToCharArray()); Console.SetOut(new StreamWriter(testOut, false, new UTF8Encoding(false)) { AutoFlush = true }); }
        else
        {
            if (!AllocConsole()) { /* already has a console (started from one): use it */ }
            try { SetConsoleOutputCP(65001); } catch { }
            try
            {
                Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
                Console.SetIn(new StreamReader(Console.OpenStandardInput()));
            }
            catch { }
        }
        try { Console.Title = "Vortex"; SizeWindow(100, 28); } catch { }
        ThreadPool.QueueUserWorkItem(delegate { CheckUpdate(); });
        bool launch = false;
        while (true)
        {
            Draw();
            ConsoleKeyInfo k = NextKey();
            char c = k.KeyChar;
            if (k.Key == ConsoleKey.Escape || c == '0' || c == 'q' || c == 'Q') break;
            if (k.Key == ConsoleKey.UpArrow) { sel = (sel + Names.Length - 1) % Names.Length; continue; }
            if (k.Key == ConsoleKey.DownArrow) { sel = (sel + 1) % Names.Length; continue; }
            if (c >= '1' && c <= '4') sel = c - '1';
            else if ((c == 'u' || c == 'U') && latestUrl != null) { DoUpdate(); Pause(); continue; }
            else if (k.Key != ConsoleKey.Enter && c != '\r' && c != '\n') continue;
            log.Clear();
            if (sel == 0) { if (DoInstall()) { launch = true; break; } }
            else if (sel == 1) DoRepair();
            else { if (DoUninstall(sel == 3)) break; }
            Pause();
        }
        try { FreeConsole(); } catch { }
        return launch;
    }

    // Window and buffer the same size, so there are no scrollbars. The buffer may not be smaller than the window, so shrink the window first.
    static void SizeWindow(int w, int h)
    {
        try { Console.SetWindowSize(Math.Min(Console.WindowWidth, w), Math.Min(Console.WindowHeight, h)); } catch { }
        try { Console.SetBufferSize(w, h); } catch { }
        try { Console.SetWindowSize(w, h); } catch { }
    }
    static ConsoleKeyInfo NextKey()
    {
        if (keys != null) { char ch = keys.Count > 0 ? keys.Dequeue() : '0'; return new ConsoleKeyInfo(ch, ConsoleKey.NoName, false, false, false); }
        return Console.ReadKey(true);
    }
    static void W(string text, ConsoleColor color) { try { Console.ForegroundColor = color; } catch { } Console.Write(text); try { Console.ResetColor(); } catch { } }
    static void WL(string text, ConsoleColor color) { W(text + "\n", color); }
    static void Pause() { Console.WriteLine(); W("   Press any key to go back", ConsoleColor.DarkGray); NextKey(); }
    static bool Ask(string question)
    {
        W("   " + question + " [y/N] ", ConsoleColor.Yellow);
        ConsoleKeyInfo k = NextKey(); Console.WriteLine(k.KeyChar);
        return k.KeyChar == 'y' || k.KeyChar == 'Y';
    }
    static void Step(string text) { W("   > ", ConsoleColor.Magenta); WL(text, ConsoleColor.Gray); }
    static void Ok(string text) { W("   + ", ConsoleColor.Green); WL(text, ConsoleColor.White); }
    static void Bad(string text) { W("   ! ", ConsoleColor.Red); WL(text, ConsoleColor.Red); }

    static void Draw()
    {
        try { Console.Clear(); } catch { }
        Console.WriteLine();
        for (int i = 0; i < Banner.Length; i++) WL("   " + Banner[i], BannerColors[i]);
        Console.WriteLine();
        W("   plugins and themes for Yapin", ConsoleColor.DarkGray); W("  ·  ", ConsoleColor.DarkMagenta); WL("v" + ReadVersion(), ConsoleColor.DarkGray);
        Console.WriteLine();
        int inner = 94;
        WL("   ╭" + new string('─', inner) + "╮", ConsoleColor.DarkMagenta);
        for (int i = 0; i < Names.Length; i++)
        {
            string left = "  " + (i == sel ? "▸" : " ") + " " + (i + 1) + "  " + Names[i].PadRight(30);
            string right = Notes[i];
            string line = (left + right).PadRight(inner - 1);
            W("   │", ConsoleColor.DarkMagenta);
            if (i == sel)
            {
                try { Console.BackgroundColor = ConsoleColor.DarkMagenta; Console.ForegroundColor = ConsoleColor.White; } catch { }
                Console.Write(line + " "); try { Console.ResetColor(); } catch { }
            }
            else { W(left, ConsoleColor.Magenta); W(line.Substring(left.Length) + " ", ConsoleColor.Gray); }
            WL("│", ConsoleColor.DarkMagenta);
        }
        WL("   ╰" + new string('─', inner) + "╯", ConsoleColor.DarkMagenta);
        Console.WriteLine();
        foreach (string l in log) WL("   " + l, ConsoleColor.Gray);
        if (latestUrl != null) { W("   Vortex " + latestTag.TrimStart('v') + " is available. Press ", ConsoleColor.Yellow); W("U", ConsoleColor.White); WL(" to update.", ConsoleColor.Yellow); }
        W("   ↑ ↓ to move  ·  Enter to choose  ·  Esc to leave", ConsoleColor.DarkGray);
    }

    static string ReadVersion()
    {
        try { Match m = Regex.Match(File.ReadAllText(Path.Combine(here, "version.json")), "\"version\"\\s*:\\s*\"([^\"]+)\""); return m.Success ? m.Groups[1].Value : "?"; } catch { return "?"; }
    }

    // ---- The three choices ----
    static void CloseIfOpen()
    {
        if (!Vortex.YapinOpen()) return;
        Step("Closing Yapin...");
        Vortex.CloseYapin();
        if (Vortex.YapinOpen()) Bad("Yapin did not close. Quit it from the tray icon and try again."); else Ok("Yapin is closed.");
    }

    static bool DoInstall()
    {
        Console.WriteLine();
        if (!File.Exists(Vortex.YapperPath())) { Bad("Yapin was not found. Install it from yapper.website first."); return false; }
        CloseIfOpen();
        if (Vortex.YapinOpen()) return false;
        Step("Setting up Vortex..."); Ok("Vortex " + ReadVersion() + " is ready.");
        Step("Adding a desktop shortcut..."); string err = MakeShortcut(); if (err == null) Ok("Shortcut added. It starts Yapin with Vortex right away."); else Bad("No shortcut: " + err);
        Step("Starting Yapin with Vortex...");
        return true;
    }

    static void DoRepair()
    {
        Console.WriteLine();
        CloseIfOpen();
        if (Vortex.YapinOpen()) return;
        Step("Putting Vortex's files back...");
        try { Vortex.ResetRuntime(); Ok("Done. Your settings, plugins and backups were not touched. Choose Install to start Yapin."); }
        catch (Exception ex) { Bad("Repair failed: " + ex.Message); }
    }

    static bool DoUninstall(bool everything)
    {
        Console.WriteLine();
        if (everything)
        {
            WL("   This deletes ALL of Vortex's data for this Windows user: settings, plugin data, your own plugins and themes,", ConsoleColor.Yellow);
            WL("   saved messages, the message backup and the logs, plus Vortex's own copy of its files, and then Vortex.exe itself.", ConsoleColor.Yellow);
            WL("   It cannot be undone. Yapin itself, your Yapin account and your servers are not touched.", ConsoleColor.Yellow);
            Console.WriteLine();
            if (!Ask("Delete everything and remove Vortex?")) return false;
        }
        else if (!Ask("Remove Vortex's files from this PC? Your settings and add-ons are kept. Yapin itself is not touched.")) return false;
        bool deleteExe = everything || Ask("Also delete Vortex.exe itself? (If you open it again it sets itself up again.)");
        CloseIfOpen();
        if (Vortex.YapinOpen()) return false;
        int problems = 0;
        try
        {
            if (everything)
            {
                // Vortex keeps a copy of its settings inside Yapin's own storage too; clear that first, with Vortex's own runtime, before it is deleted.
                Step("Clearing Vortex's settings from Yapin...");
                string wipe = Path.Combine(here, "src", "wipe.mjs"), node = Path.Combine(here, "node.exe");
                if (Vortex.TestMode()) Ok("(test mode: Yapin's storage step skipped)");
                else if (File.Exists(wipe) && File.Exists(node))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(node, "\"" + wipe + "\"");
                    psi.UseShellExecute = false; psi.CreateNoWindow = true; psi.RedirectStandardOutput = true; psi.RedirectStandardError = true;
                    psi.EnvironmentVariables["YAPPER_EXE"] = Vortex.YapperPath();
                    using (Process p = Process.Start(psi))
                    {
                        string o = p.StandardOutput.ReadToEnd(); string er = p.StandardError.ReadToEnd();
                        if (!p.WaitForExit(120000)) { try { p.Kill(); } catch { } }
                        Match m = Regex.Match(o, "wiped (\\d+)");
                        if (p.ExitCode == 0 && m.Success) Ok("Cleared " + m.Groups[1].Value + " item" + (m.Groups[1].Value == "1" ? "" : "s") + " from Yapin's storage.");
                        else { problems++; Bad("Could not clear Yapin's copy of the settings (" + (er.Trim().Length > 0 ? er.Trim().Split('\n')[0] : "no answer") + "). Open Yapin once, then try again."); }
                    }
                    Vortex.CloseYapin();
                }
                else { problems++; Bad("The cleaning tool was not found, so Yapin's copy of the settings was not cleared."); }
            }
            Step("Removing Vortex's files...");
            try { Vortex.DeleteRuntime(); Ok("Removed " + System.IO.Path.GetDirectoryName(Vortex.RuntimePath()) + "\\runtime"); } catch (Exception ex) { problems++; Bad(ex.Message); }
            if (everything)
            {
                Step("Deleting your Vortex data...");
                try { Vortex.ForceDelete(Vortex.DataDir()); Ok("Removed " + Vortex.DataDir()); } catch (Exception ex) { problems++; Bad(ex.Message); }
                try { string root = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? "", "Vortex"); Vortex.ForceDelete(root); } catch (Exception ex) { problems++; Bad(ex.Message); }
                try { string old = Path.Combine(Environment.GetEnvironmentVariable("APPDATA") ?? "", "YapinVixer"); Vortex.ForceDelete(old); } catch (Exception ex) { problems++; Bad(ex.Message); }
            }
            if (!Vortex.TestMode())
            {
                string lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Vortex.lnk");
                try { if (File.Exists(lnk)) { File.Delete(lnk); Ok("Removed the desktop shortcut."); } } catch (Exception ex) { problems++; Bad("Could not remove the desktop shortcut: " + ex.Message); }
            }
            if (!everything) Vortex.SetSkipUi(false);
            // check, then say what is true
            bool leftRuntime = Directory.Exists(Vortex.RuntimePath()), leftData = everything && Directory.Exists(Vortex.DataDir());
            if (leftRuntime || leftData) { problems++; Bad("Something is still there: " + (leftRuntime ? "the program files " : "") + (leftData ? "your data folder" : "") + ". Close anything that is using them and try again."); }
            if (problems == 0) Ok(everything ? "All of Vortex's data was deleted." : "Vortex was removed. Your settings were kept.");
            if (deleteExe && !Vortex.TestMode())
            {
                // a program cannot delete itself while it runs: a short hidden command waits for this window to close, then deletes the file
                try
                {
                    string exe = Process.GetCurrentProcess().MainModule.FileName;
                    ProcessStartInfo d = new ProcessStartInfo("cmd.exe", "/c ping -n 3 127.0.0.1 >nul & del /f /q \"" + exe + "\"");
                    d.CreateNoWindow = true; d.UseShellExecute = false; Process.Start(d);
                    Ok("Vortex.exe will delete itself as soon as you close this window.");
                }
                catch (Exception ex) { Bad("Could not schedule the deletion of Vortex.exe: " + ex.Message); }
            }
            else if (!deleteExe) WL("   Vortex.exe was kept. It sets itself up again if you open it.", ConsoleColor.DarkGray);
            Pause();
            return true;
        }
        catch (Exception ex) { Bad("Uninstall failed: " + ex.Message); return false; }
    }

    static string MakeShortcut()
    {
        try
        {
            string path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Vortex.lnk");
            Type t = Type.GetTypeFromProgID("WScript.Shell"); object sh = Activator.CreateInstance(t);
            object lnk = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { path });
            Type lt = lnk.GetType();
            lt.InvokeMember("TargetPath", BindingFlags.SetProperty, null, lnk, new object[] { self });
            lt.InvokeMember("Arguments", BindingFlags.SetProperty, null, lnk, new object[] { "--launch" });
            lt.InvokeMember("IconLocation", BindingFlags.SetProperty, null, lnk, new object[] { self + ",0" });
            lt.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { "Start Yapin with Vortex" });
            lt.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
            return null;
        }
        catch (Exception ex) { return ex.Message; }
    }

    // ---- Updates (quiet: a line shows up only when there is something newer) ----
    static int[] Parse(string v)
    {
        Match m = Regex.Match(v ?? "", "^v?(\\d{1,6})\\.(\\d{1,6})\\.(\\d{1,6})");
        return m.Success ? new int[] { int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[3].Value) } : null;
    }
    static bool Newer(string a, string b)
    {
        int[] x = Parse(a), y = Parse(b); if (x == null || y == null) return false;
        for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] > y[i];
        return false;
    }
    static string Repo()
    {
        try
        {
            Match m = Regex.Match(File.ReadAllText(Path.Combine(here, "version.json")), "\"repo\"\\s*:\\s*\"([^\"]*)\"");
            string r = m.Success ? m.Groups[1].Value : "";
            return Regex.IsMatch(r, "^[A-Za-z0-9_.-]{1,39}/[A-Za-z0-9_.-]{1,100}$") ? r : "";
        }
        catch { return ""; }
    }
    static void CheckUpdate()
    {
        string repo = Repo(); if (repo == "") return;
        try
        {
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("https://api.github.com/repos/" + repo + "/releases/latest");
            req.UserAgent = "Vortex-Launcher"; req.Timeout = 10000;
            string body;
            using (WebResponse res = req.GetResponse()) using (StreamReader r = new StreamReader(res.GetResponseStream())) body = r.ReadToEnd();
            Match m = Regex.Match(body, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
            string tag = m.Success ? m.Groups[1].Value : "";
            if (Newer(tag, ReadVersion())) { latestTag = tag; latestUrl = "https://github.com/" + repo + "/releases/latest/download/Vortex.exe"; }
        }
        catch { /* no connection, or nothing published yet: stay quiet */ }
    }
    static void DoUpdate()
    {
        Console.WriteLine();
        string tmp = Path.Combine(Path.GetTempPath(), "Vortex-update-" + Guid.NewGuid().ToString("N") + ".exe");
        try
        {
            Step("Downloading Vortex " + latestTag.TrimStart('v') + "...");
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
            using (WebClient wc = new WebClient()) { wc.Headers["User-Agent"] = "Vortex-Launcher"; wc.DownloadFile(latestUrl, tmp); }
            FileInfo fi = new FileInfo(tmp);
            byte[] head = new byte[2]; using (FileStream fs = File.OpenRead(tmp)) fs.Read(head, 0, 2);
            if (fi.Length < 5 * 1024 * 1024 || fi.Length > 300L * 1024 * 1024 || head[0] != (byte)'M' || head[1] != (byte)'Z') { File.Delete(tmp); Bad("The download was not a valid Vortex file, so it was not installed."); return; }
            // Once this program has closed, swap the new file in and start it.
            string ps = "param($pid_,$new,$old) try{Wait-Process -Id $pid_ -Timeout 60 -ErrorAction SilentlyContinue}catch{}; Start-Sleep -Milliseconds 400; Move-Item -LiteralPath $new -Destination $old -Force; Start-Process -FilePath $old";
            string script = Path.Combine(Path.GetTempPath(), "vortex-swap.ps1"); File.WriteAllText(script, ps);
            ProcessStartInfo psi = new ProcessStartInfo("powershell", "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\" " + Process.GetCurrentProcess().Id + " \"" + tmp + "\" \"" + self + "\"");
            psi.CreateNoWindow = true; psi.UseShellExecute = false;
            Process.Start(psi);
            try { FreeConsole(); } catch { }
            Environment.Exit(0);
        }
        catch (Exception ex) { try { File.Delete(tmp); } catch { } Bad("The update failed: " + ex.Message); }
    }
}
