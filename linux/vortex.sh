#!/usr/bin/env bash
# Vortex for Linux: one script that installs, updates, repairs, launches and removes Vortex for the Yapin AppImage.
#
#   ./vortex.sh            open the launcher window (needs zenity; without it you get the same menu in the terminal)
#   ./vortex.sh launch     start Yapin with Vortex right away (closes it first if it is already open)
#   ./vortex.sh install    set Vortex up and start Yapin with it
#   ./vortex.sh update     get the newest Vortex
#   ./vortex.sh repair     put Vortex's files back as they should be
#   ./vortex.sh uninstall  remove Vortex (asks about your settings)
#   ./vortex.sh uninstall-all  remove Vortex and delete ALL of its data for your user
#   ./vortex.sh addons     open the folder for your own plugins and themes
#
# Why it is a script and not a binary: Vortex is plain JavaScript that runs on Node.js. The script uses the Node.js you have if it is
# new enough and otherwise downloads the official build and checks it against Node's published checksums, so nothing has to be
# installed system-wide and no root access is needed. Everything lives in your home folder.
#
# Updates are on by default: every start checks the Vortex GitHub page for a newer version and installs it before launching
# (set VORTEX_NO_AUTOUPDATE=1 to turn that off). Inside the app, the Auto Update plugin keeps plugins and themes current as well.
set -euo pipefail

REPO="${VORTEX_REPO:-proimpacts/Vortex}"
NODE_VERSION="24.18.0"            # the same Node that the Windows app is built with
NODE_MIN_MAJOR=22
HOME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/Vortex"
APP_DIR="$HOME_DIR/app"
NODE_DIR="$HOME_DIR/node"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Vortex"
DESKTOP_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/applications/vortex.desktop"
SELF="$HOME_DIR/vortex.sh"
OFFICIAL_NOTE="The Vortex GitHub page and its official website are the only official places to get Vortex. Anything else claiming to be Vortex is not. If you got it from somewhere else, delete it and get it from the official page."

say() { printf '%s\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }
gui() { have zenity && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; }
tell() { if gui; then zenity --info --no-wrap --title="Vortex" --text="$1" 2>/dev/null || true; else say "$1"; fi; }
fail() { if gui; then zenity --error --no-wrap --title="Vortex" --text="$1" 2>/dev/null || true; fi; say "Vortex: $1"; exit 1; }
ask() { if gui; then zenity --question --no-wrap --title="Vortex" --text="$1" 2>/dev/null; else printf '%s [y/N] ' "$1" >&2; read -r a; [ "$a" = y ] || [ "$a" = Y ]; fi; }

# Only GitHub and nodejs.org over HTTPS, and only the exact URLs built in this file.
fetch() { # fetch URL DEST
  if have curl; then curl -fsSL --proto '=https' --tlsv1.2 --max-time 300 -o "$2" "$1"
  elif have wget; then wget -q --https-only --timeout=300 -O "$2" "$1"
  else fail "Vortex needs curl or wget to download files."; fi
}

version_gt() { # version_gt A B  -> true when A is newer than B (x.y.z)
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}
local_version() { sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$APP_DIR/version.json" 2>/dev/null | head -n1; }
remote_version() {
  local t; t="$(mktemp)"
  if fetch "https://raw.githubusercontent.com/$REPO/main/version.json" "$t" 2>/dev/null; then sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$t" | head -n1; fi
  rm -f "$t"
}

node_bin() { # the Node to use: ours, or the system one if it is new enough
  if [ -x "$NODE_DIR/bin/node" ]; then echo "$NODE_DIR/bin/node"; return; fi
  if have node; then
    local major; major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$major" -ge "$NODE_MIN_MAJOR" ]; then command -v node; return; fi
  fi
  return 1
}

install_node() {
  node_bin >/dev/null 2>&1 && return 0
  local arch; case "$(uname -m)" in x86_64|amd64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) fail "This kind of computer ($(uname -m)) is not supported." ;; esac
  local name="node-v$NODE_VERSION-linux-$arch" base="https://nodejs.org/dist/v$NODE_VERSION" tmp; tmp="$(mktemp -d)"
  say "Downloading Node.js $NODE_VERSION…"
  fetch "$base/$name.tar.xz" "$tmp/$name.tar.xz" || fail "Could not download Node.js."
  fetch "$base/SHASUMS256.txt" "$tmp/SHASUMS256.txt" || fail "Could not download Node.js's checksums."
  local want got; want="$(grep " $name.tar.xz\$" "$tmp/SHASUMS256.txt" | cut -d' ' -f1)"; got="$(sha256sum "$tmp/$name.tar.xz" | cut -d' ' -f1)"
  [ -n "$want" ] && [ "$want" = "$got" ] || { rm -rf "$tmp"; fail "The Node.js download did not match its checksum, so it was not installed."; }
  mkdir -p "$NODE_DIR"; tar -xJf "$tmp/$name.tar.xz" -C "$NODE_DIR" --strip-components=1; rm -rf "$tmp"
}

install_app() { # download the project and replace $APP_DIR with it
  local tmp; tmp="$(mktemp -d)"
  say "Downloading Vortex…"
  fetch "https://github.com/$REPO/archive/refs/heads/main.tar.gz" "$tmp/vortex.tar.gz" || { rm -rf "$tmp"; fail "Could not download Vortex from github.com/$REPO. (If the project page is not public yet, there is nothing to download.)"; }
  mkdir -p "$tmp/out"; tar -xzf "$tmp/vortex.tar.gz" -C "$tmp/out" --strip-components=1
  [ -f "$tmp/out/launcher.mjs" ] && [ -f "$tmp/out/src/bootstrap.js" ] || { rm -rf "$tmp"; fail "The download is not a Vortex project, so it was not installed."; }
  # keep plugins you added by hand inside the app folder, replace the rest
  mkdir -p "$HOME_DIR"
  if [ -d "$APP_DIR" ]; then rm -rf "$HOME_DIR/app.old"; mv "$APP_DIR" "$HOME_DIR/app.old"; fi
  mv "$tmp/out" "$APP_DIR"; rm -rf "$tmp" "$HOME_DIR/app.old"
}

write_desktop_entry() {
  mkdir -p "$(dirname "$DESKTOP_FILE")"
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Vortex
Comment=Start Yapin with Vortex
Exec="$SELF" launch
Icon=$APP_DIR/assets/icon.png
Terminal=false
Categories=Network;Chat;
EOF
}

install_all() {
  mkdir -p "$HOME_DIR" "$CONFIG_DIR/plugins" "$CONFIG_DIR/themes"
  install_node
  install_app
  # keep a copy of this script next to the app, so the desktop entry and later runs find it
  if [ "$(readlink -f "$0")" != "$(readlink -f "$SELF" 2>/dev/null || echo)" ]; then cp "$0" "$SELF"; fi
  chmod +x "$SELF"
  write_desktop_entry
}

maybe_update() {
  [ "${VORTEX_NO_AUTOUPDATE:-0}" = 1 ] && return 0
  local cur new; cur="$(local_version)"; new="$(remote_version || true)"
  if [ -n "$cur" ] && [ -n "$new" ] && version_gt "$new" "$cur"; then say "Updating Vortex $cur -> $new…"; install_app; fi
}

pick_yapin() { # remember where the AppImage is, if it is not in one of the usual places
  [ -f "$CONFIG_DIR/yapper-path" ] && return 0
  if gui; then
    local f; f="$(zenity --file-selection --title="Where is the Yapin AppImage? (Yapper-Setup.AppImage)" 2>/dev/null || true)"
    [ -n "$f" ] && { mkdir -p "$CONFIG_DIR"; printf '%s\n' "$f" > "$CONFIG_DIR/yapper-path"; }
  fi
}

launch() {
  [ -f "$APP_DIR/launcher.mjs" ] || install_all
  close_yapin
  maybe_update
  local node; node="$(node_bin)" || { install_node; node="$(node_bin)"; }
  # Yapin is an AppImage and can sit anywhere. The launcher looks in the usual places; if it finds nothing, ask once.
  if [ -z "${YAPPER_EXE:-}" ] && [ ! -f "$CONFIG_DIR/yapper-path" ]; then
    if ! ls "$HOME"/Applications/Yapper*.AppImage "$HOME"/Downloads/Yapper*.AppImage "$HOME"/Desktop/Yapper*.AppImage "$HOME"/.local/bin/Yapper*.AppImage "$HOME"/bin/Yapper*.AppImage "$HOME"/Yapper*.AppImage /opt/Yapper*.AppImage >/dev/null 2>&1; then pick_yapin; fi
  fi
  cd "$APP_DIR"
  exec "$node" launcher.mjs
}

open_addons() { mkdir -p "$CONFIG_DIR/plugins" "$CONFIG_DIR/themes"; if have xdg-open; then xdg-open "$CONFIG_DIR" >/dev/null 2>&1 & else say "Your plugins and themes go in $CONFIG_DIR"; fi; }

uninstall() {
  ask "Remove Vortex from this computer? Yapin itself is not touched." || return 0
  rm -f "$DESKTOP_FILE"
  local keep=1; ask "Also delete your Vortex settings, your own plugins and themes, and the message backup?

Choose No to keep them in case you come back." && keep=0
  rm -rf "$APP_DIR" "$NODE_DIR"
  [ "$keep" = 0 ] && rm -rf "$CONFIG_DIR"
  tell "Vortex was removed. You can delete $SELF too."
  rm -f "$SELF" 2>/dev/null || true
}

close_yapin() { # quit Yapin completely (and any Vortex launcher still running), so nobody has to do it by hand
  pkill -f "$APP_DIR/launcher.mjs" >/dev/null 2>&1 || true
  pkill -x -i 'yapper|yapper-desktop' >/dev/null 2>&1 || true
  local i; for i in $(seq 1 32); do pgrep -x -i 'yapper|yapper-desktop' >/dev/null 2>&1 || return 0; sleep 0.25; done
  pkill -9 -x -i 'yapper|yapper-desktop' >/dev/null 2>&1 || true
}

do_install() { # set up Vortex, then start Yapin with it
  install_all
  say "Closing Yapin if it is open..."; close_yapin
  launch
}
do_repair() { say "Closing Yapin if it is open..."; close_yapin; install_all; say "Vortex's files were put back. Your settings, plugins and backups were not touched."; }

tui() { # the terminal screen: a banner and three choices
  local m=$'\e[95m' d=$'\e[35m' b=$'\e[94m' db=$'\e[34m' g=$'\e[90m' w=$'\e[97m' x=$'\e[0m' rev=$'\e[45;97m'
  local sel=0 names=("Install" "Repair" "Uninstall" "Uninstall and Delete All Data") notes=("Set up Vortex and start Yapin with it" "Put Vortex's files back as they should be" "Remove Vortex, keep your settings" "Remove Vortex and wipe every trace of it") k rest
  while true; do
    clear 2>/dev/null || printf '\033c'
    printf '\n%s   ██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗%s\n%s   ██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝%s\n%s   ██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ %s\n%s   ╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ %s\n%s    ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗%s\n%s     ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝%s\n\n' "$m" "$x" "$m" "$x" "$d" "$x" "$d" "$x" "$b" "$x" "$db" "$x"
    printf '   %splugins and themes for Yapin  ·  v%s%s\n\n' "$g" "$(local_version || echo '?')" "$x"
    printf '   %s╭──────────────────────────────────────────────────────────────────────────────────────────────╮%s\n' "$d" "$x"
    local i; for i in 0 1 2 3; do
      local mark=" "; [ "$i" = "$sel" ] && mark="▸"
      local body line; body="$(printf '%-89s' "$(printf '%d  %-30s %s' "$((i+1))" "${names[$i]}" "${notes[$i]}")")"; line="  ${mark} ${body}"
      if [ "$i" = "$sel" ]; then printf '   %s│%s%s %s│%s\n' "$d" "$rev" "$line" "$x$d" "$x"; else printf '   %s│%s%s %s│%s\n' "$d" "$x" "$line" "$d" "$x"; fi
    done
    printf '   %s╰──────────────────────────────────────────────────────────────────────────────────────────────╯%s\n\n   %s↑ ↓ to move  ·  Enter to choose  ·  q to leave%s\n' "$d" "$x" "$g" "$x"
    IFS= read -rsn1 k || exit 0
    if [ "$k" = $'\e' ]; then read -rsn2 -t 0.05 rest || true; case "$rest" in '[A') sel=$(( (sel+3) % 4 )); continue ;; '[B') sel=$(( (sel+1) % 4 )); continue ;; *) exit 0 ;; esac; fi
    case "$k" in
      1|2|3|4) sel=$((k-1)) ;;
      q|Q) exit 0 ;;
      '') ;;
      *) continue ;;
    esac
    printf '\n'
    case "$sel" in
      0) do_install ;;
      1) do_repair; read -rsn1 -p "   Press any key to go back" _ ;;
      2) uninstall; [ -f "$APP_DIR/launcher.mjs" ] || exit 0 ;;
      3) uninstall_all; [ -d "$HOME_DIR" ] || exit 0 ;;
    esac
  done
}

uninstall_all() { # remove Vortex and every trace of its data for this user
  say "This deletes ALL of Vortex's data for your user: settings, plugin data, your own plugins and themes, saved messages and the backup, plus Vortex itself. It cannot be undone. Yapin and your Yapin account are not touched."
  ask "Delete everything and remove Vortex?" || return 0
  close_yapin
  # Vortex also keeps a copy of its settings inside Yapin's own storage: clear it first, using Vortex's own Node.
  local node; node="$(node_bin 2>/dev/null || true)"
  if [ -n "$node" ] && [ -f "$APP_DIR/src/wipe.mjs" ]; then "$node" "$APP_DIR/src/wipe.mjs" >/dev/null 2>&1 || say "Could not clear Yapin's copy; the rest will still be deleted."; else say "The cleaning tool was not found; the rest will still be deleted."; fi
  close_yapin
  rm -f "$DESKTOP_FILE"
  rm -rf "$CONFIG_DIR" "$HOME_DIR"
  tell "All of Vortex's data was deleted. Nothing of it is left on this computer."
}

menu() {
  if [ -t 0 ] && [ -t 1 ]; then tui; return; fi
  local choice
  if gui; then
    choice="$(zenity --list --title="Vortex" --width=560 --height=300 --text="$OFFICIAL_NOTE" --column="What do you want to do?" "Install" "Repair" "Uninstall" "Uninstall and Delete All Data" 2>/dev/null || true)"
  else
    PS3="Choose: "; select choice in "Install" "Repair" "Uninstall" "Uninstall and Delete All Data" "Quit"; do break; done
  fi
  case "${choice:-}" in
    "Install") do_install ;;
    "Repair") do_repair; tell "Vortex's files were put back." ;;
    "Uninstall") uninstall ;;
    "Uninstall and Delete All Data") uninstall_all ;;
    *) exit 0 ;;
  esac
}

cmd="${1:-menu}"
case "$cmd" in
  menu) if [ ! -f "$APP_DIR/launcher.mjs" ]; then ask "Install Vortex now? It goes in $HOME_DIR and needs no root access." && install_all || exit 0; fi; menu ;;
  launch) launch ;;
  install) do_install ;;
  update) install_node; maybe_update; install_app; say "Vortex is up to date." ;;
  repair) do_repair ;;
  uninstall) uninstall ;;
  uninstall-all) uninstall_all ;;
  addons) open_addons ;;
  -h|--help|help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) fail "Unknown command: $cmd (try: launch, update, repair, uninstall, addons)" ;;
esac
