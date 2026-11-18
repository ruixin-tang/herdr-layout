#!/bin/sh
# Copies my Herdr workspace into this folder and commits what changed.
#   sh backup.sh           copy and commit
#   sh backup.sh restore   copy everything back (after a broken edit, or on a new Mac)
# What is mine: my own Herdr mods, the edited over9k mods, the layout, the themes,
# and the Claude Code mod that syncs tickets and calendar. Keys never come along
# (the NS key lives in ~/.config/my-work and is not copied).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
herdr="$HOME/.config/herdr-app"
mods="my-work agenda forest-sprite korok dev-servers morning support-duty weather trains crew"

if [ "${1:-}" = restore ]; then
  for m in $mods; do mkdir -p "$herdr/mods/$m" && rsync -a --delete "$here/herdr/mods/$m/" "$herdr/mods/$m/"; done
  for d in "$here"/herdr/mods/over9k*; do rsync -a "$d/" "$herdr/mods/$(basename "$d")/"; done
  rsync -a "$here/herdr/layouts/" "$herdr/layouts/"
  rsync -a "$here/herdr/themes/" "$herdr/themes/"
  mkdir -p "$HOME/.claude/mods" && rsync -a --delete "$here/claude/my-tickets/" "$HOME/.claude/mods/my-tickets/"
  echo "restored into $herdr and ~/.claude/mods/my-tickets"
  exit 0
fi

mkdir -p "$here/herdr/mods" "$here/herdr/layouts" "$here/herdr/themes" "$here/claude"
for m in $mods; do
  [ -d "$herdr/mods/$m" ] && rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'jsconfig.json' "$herdr/mods/$m/" "$here/herdr/mods/$m/"
done
for d in "$herdr"/mods/over9k*; do
  rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'jsconfig.json' "$d/" "$here/herdr/mods/$(basename "$d")/"
done
cp "$herdr/layouts/over9k.json" "$herdr/layouts/over9k.svg" "$here/herdr/layouts/" 2>/dev/null || true
cp "$herdr"/themes/sheikah*.json "$here/herdr/themes/"
rsync -a --delete --exclude '.claude-plugin/types' "$HOME/.claude/mods/my-tickets/" "$here/claude/my-tickets/"

cd "$here"
git add -A
if git diff --cached --quiet; then echo "nothing changed"; else git commit -q -m "Backup $(date '+%Y-%m-%d %H:%M')" && echo "saved: $(git log -1 --format=%s)"; fi
