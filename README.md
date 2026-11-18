# My Herdr workspace

A backup of everything built on top of Herdr: my own mods, the edited over9k
mods, the layout and themes, and the Claude Code mod that syncs tickets and the
calendar. `backup.sh` copies the live files here and commits; `backup.sh restore`
copies them back.

- `herdr/` goes to `~/.config/herdr-app/`
- `claude/my-tickets/` goes to `~/.claude/mods/my-tickets/` (loaded through
  `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`)
- `tools/` holds the scripts that draw the mountain's figures

Not in here: keys. The NS key is in `~/.config/my-work/ns-key`.
