# Workspace notes

What Ruixin's Herdr workspace is, where each piece lives, and what is still open.
Written on 2026-11-18 as the hand-off from the session that built it.

## Read first

- `~/.config/herdr-app/AGENTS.md` is Herdr's own guide for agents: layouts, mods, commands.
- All of Ruixin's Claude Code sessions run inside the Herdr desktop app. "The panel",
  "the sidebar", "the sprite", "the mountain" always mean Herdr, never the Claude Code terminal.
- This folder (`~/workspace-backup`) is a local git repository. `sh backup.sh` copies the
  live files here and commits; `sh backup.sh restore` copies them back. Herdr runs the
  backup once a day (from the forest sprite). Commits here are automatic and unsigned by
  design; there is no remote. Edit the live files, then run `sh backup.sh`.

## Where things live

Live Herdr files are under `~/.config/herdr-app/`:

| Piece | Live path | What it does |
|---|---|---|
| Layout | `layouts/over9k.json` | Third-party over9k layout, edited. Left sidebar, terminal column with the mountain on top, right panel. |
| Themes | `themes/sheikah*.json` | Zelda look in four variants; the forest sprite switches them by the hour (06:00 dawn, 10:00 day, 14:30 dusk, 17:15 night). |
| `mods/my-work` | right panel, top | Tickets, PRs and Recap tabs. Sections by whose move it is. Trail line per row (PR, CI, comments to answer, branch, live state, agent). Pick-up starts an agent. |
| `mods/support-duty` | right panel | Foldable; links for Sentry triage, dev support, Sentry, checklist. "today" badge from the Dev-support calendar. |
| `mods/weather` | right panel | Den Bosch and Eindhoven. Rain from Buienradar's radar (2 hours, 5-minute bars), temperature from Open-Meteo. Marks the current network as home; shares `my-work.place` and `weather.sky`. |
| `mods/trains` | right panel | NS trains home from Den Bosch, disruptions on the route, one-day other destination, journeys for calendar appointments. Shows 15:00 to 18:30, not at home. Key in `~/.config/my-work/ns-key` (never print it, never copy it into this folder). |
| `mods/agenda` | right panel, bottom | Today's meetings with room and Join link. |
| `mods/crew` | above the terminals | The mountain: every agent is a skier (hiker from April to October). Real sky, sun, clouds and rain; a clock top left. An agent's running sub-agents are small figures in its colour right behind it (up to 4, then "+n"): Claude Code's from shared `over9k.subs`, Herdr's own from `terminals()` with a `parent`. |
| `mods/forest-sprite` | floating in the sidebar | Pet that reacts to blocked agents, meetings, late trains, the go-home nudge; offers the brief after Morning start ran by itself; also runs the theme switch and the daily backup. |
| `mods/korok` | floating in the sidebar | Cheers when a ticket is done or a PR is merged. |
| `mods/dev-servers` | sidebar | One light per dev stack (Platform :3000, AIS :4000), start/stop, links to the staging and production remote shells. Also does Morning start: fast-forwards master in `~/floryn` and `~/ais` (only a checkout on master without changes to tracked files), then starts the stacks that are not running. Runs from the "Morning start" row, from `dev-servers.morning`, and by itself on a working day from 06:00 the first time an agent is working. Shares its steps as `morning`. |
| `mods/morning` | dialog | The Morning start brief: the steps above, what changed since 17:00 on the last working day (my PRs merged, reviews asked of me by name, red CI on master or my open PRs), today's meetings and duty. Does no work itself. Sets `morning.seen`. |
| `mods/over9k*` | sidebar, tabs, usage | Third-party, with small edits (My work button, display-only push/pull, `ALWAYS_LISTED` keeps ais listed, `over9k.subs` shares each agent's running subagents for the mountain). |

Outside Herdr:

- `~/.claude/mods/my-tickets` is a Claude Code mod, loaded through `CLAUDE_CODE_PLUGIN_DIRS`
  in `~/.claude/settings.json`. Herdr cannot reach Notion or the calendar, so this mod
  fetches tickets and today's meetings every 10 minutes while a session runs and writes
  `~/.cache/my-work/tickets.json` and `meetings.json`. Changes to it only apply in
  sessions started afterwards.
- `~/.claude/settings.json` also has over9k's status line (silenced with `>/dev/null`);
  it feeds the Claude usage rows in the sidebar.
- `tools/crew-gen.py` and `tools/crew-resort.py` draw the figures. Usage:
  `python3 tools/crew-resort.py ~/.config/herdr-app/mods/crew`. The mountain itself is
  drawn in `mods/crew/main.js` at the strip's width.

## How to work on it

- After every edit: `herdr-app check <mod folder>` and `herdr-app status` (its `errors`).
- `herdr-app shot <file.png>` saves the window. It catches animation frames, so a quick
  series of shots shows whether something moves.
- A new mod folder gets docked into the layout by Herdr unless `mod.json` with
  `{ "place": "none" }` exists before `main.js` is written.
- Animate natively (`.loop`, `.transition`, `.frames`). An element outside the visible
  area is not animated: start it inside, nearly transparent.
- A picture written under a name Herdr has already shown is not re-read: use a new name.
- Mods cannot read a Wi-Fi name (macOS hides it); the weather mod recognises a network
  by its router address.
- Don't edit `keys.json` without saying what it costs: Herdr then stops delivering its
  own new default shortcuts.
- over9k's "keep up to date" is on and may overwrite edits inside `mods/over9k*`;
  `sh backup.sh restore` brings them back.

## What Ruixin asked for and is not built yet

3. **A compact layout for the laptop screen**, where the strip and right panel take
   proportionally more room.
4. **Shortcut training.** Ruixin: "keyboard shortcuts is a good idea but it is something
   that I never get used to, can you train me to do that?" Idea so far: define a few
   shortcuts (next agent that needs me, open My work, start a stack) and have the sprite
   show the shortcut whenever the same thing is done by clicking.

## Built but never seen working

- Morning start running by itself at the first session of a day, and the sprite's offer of
  the brief afterwards (first chance: 19 November 2026). The brief with real rows (a merged
  PR, a review request, red CI): on 18 November GitHub had none, checked by hand.
- Followers on the mountain behind a blocked, done or idle parent, more than four of them,
  and Herdr's own sub-agents (`hc run`); seen on 18 November: two Claude Code subagents
  behind a working parent, on the lift and on the way down.
- `dev-servers.morning` only reaches the sidebar block while the sidebar is shown.
- The rain was reworked several times; Ruixin has not yet confirmed it looks right. Snow
  has never run.
- A finished agent heading straight down, a blocked one stopping in place, boarding on foot.
- The go-home nudge (17:15), the sprite's train alerts, the trains block hiding at 18:30.
- The home view (click "not at home" on the weather block once at home).
- Appointment journeys from a real calendar event; the 6 September 2027
  "travel to Amsterdam" block is the first known one.
- The Korok on a real ticket or merge; the deploy-instructions row.
- The pick-up that once opened a plain shell instead of Claude Code is unexplained.

## How Ruixin likes to work

- Explanations with concrete examples; plain words; say what was and was not verified.
- Small steps, shown in a screenshot or mockup before a big decision.
- Never run anything against production. Keys stay in files, never in the chat.
