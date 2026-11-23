# Workspace notes

What Ruixin's Herdr workspace is, where each piece lives, and what is still open.
Written on 2026-11-18 as the hand-off from the session that built it.

## Read first

- `~/.config/herdr-app/AGENTS.md` is Herdr's own guide for agents: layouts, mods, commands.
- All of Ruixin's Claude Code sessions run inside the Herdr desktop app. "The panel",
  "the sidebar", "the sprite", "the mountain" always mean Herdr, never the Claude Code terminal.
- This folder (`~/workspace-backup`) is a local git repository. `sh backup.sh` copies the
  live files here, commits and pushes to the private GitHub repo `ruixin-tang/herdr-layout`
  (since 20 November 2026; pushing here never needs asking). A Stop hook in
  `.claude/settings.json` runs it after every turn of a Claude Code session started in this folder; `sh backup.sh restore` copies them back. Herdr runs the
  backup once a day (from the forest sprite). Commits here are automatic and unsigned by
  design; there is no remote. Edit the live files, then run `sh backup.sh`.

## Where things live

Live Herdr files are under `~/.config/herdr-app/`:

| Piece | Live path | What it does |
|---|---|---|
| Layout | `layouts/over9k.json` | Third-party over9k layout, edited. Left sidebar, terminal column with the mountain on top, right panel. |
| Themes | `themes/sheikah*.json` | Zelda look in four variants; the forest sprite switches them by the hour (06:00 dawn, 10:00 day, 14:30 dusk, 17:15 night). |
| `mods/my-work` | right panel, top | Tickets, PRs and Recap tabs. Sections by whose move it is. Trail line per row (PR, CI, comments to answer, branch, live state, agent). Pick-up starts an agent. |
| `mods/support-duty` | right panel | Only shown on a support duty day (since 23 November 2026): the forest sprite hides and shows the block from the calendar's duty flag, because a hidden block does not run; `herdr-app do layout.show '{"id":"support-duty"}'` brings it back by hand. Foldable; links for Sentry triage, dev support, release testing (starts an agent on the `release-testing` skill of the floryn-support-duties plugin, 0.9.0 since 18 November 2026) and its run sheet (the list of all releases), Sentry, checklist. "today" badge from the Dev-support calendar. Under the links the Platform and AIS apart, each with a row for staging and one for production (`deploys.js`, since 19 November 2026): the deployed sha, the state of CircleCI's `build-and-deploy` since the branch's last push, how many commits wait, on staging the newest release issue (the one labelled `staging`) with its ticked boxes, e.g. "#24533 5/15" (a click opens it), and a Deploy button that opens `bin/deploy <env>` in a tab of that repo's space (`~/floryn` or `~/ais`) (the script shows the commits and asks before pushing; the mod itself only reads GitHub through `gh`). On a duty day, or while the block is open, it asks GitHub every 2 minutes (every 20 seconds while a deploy runs) and posts a toast with a sound when a deploy ends: "time to test" for staging, "time to post the deploy messages" for production. A running deploy shows in the folded header. A click on a row opens the job on CircleCI. |
| `mods/weather` | right panel | Den Bosch and Eindhoven. Rain from Buienradar's radar (2 hours, 5-minute bars), temperature from Open-Meteo. Marks the current network as home; shares `my-work.place` and `weather.sky`. |
| `mods/trains` | right panel | NS trains home from Den Bosch, disruptions on the route, one-day other destination, journeys for calendar appointments. Shows 15:00 to 18:30, not at home. Key in `~/.config/my-work/ns-key` (never print it, never copy it into this folder). |
| `mods/agenda` | right panel, bottom | Today's meetings with room and Join link. |
| `mods/crew` | above the terminals | The crew strip, a scene per time of year (since 19 November 2026): December to March the ski resort (`main.js`), April to June the valley, July and August the beach and harbour, September to November the orchard (`scenes.js`; the sky they share is `sky.js`). `herdr-app do crew.season` shows the next scene for a look ahead, round to the calendar's own (not kept over a reload). In the three new scenes: idle on the benches by the house with a drink, done and blocked waiting at the shipping bin / on the pier / at the market stall, working on a lap out and back (field and mine, then back with a sack; sailing to the buoy and back; picking up ladders, then back with a crate), sub-agents as chickens / seagulls / geese behind it. What follows describes the ski resort: every agent is a skier. Real sky, sun, clouds and rain; a clock top left. An agent's running sub-agents are small figures in its colour right behind it (up to 4, then "+n"): Claude Code's from shared `over9k.subs`, Herdr's own from `terminals()` with a `parent`. In the ski season (since 19 November 2026) there are no small figures: an agent with sub-agents running has a folded wing on its back in the chair (`ski-<colour>-pack.svg`) and flies down under a paraglider (`-fly.svg` with `-wing.svg` over it); a hover says how many. Half of the agents snowboard instead of ski (`-<pose>-board.svg`, by their terminal), never under the wing. Idle agents sit on the benches by the hut without names (a hover says who), each with a mug of hot chocolate, tea or coffee and a puff of steam (`ski-<colour>-rest-<drink>.svg`, since 19 November 2026; in summer the glass as before); more than four sit in two rows (since 19 November 2026, every scene): the front row one fewer, lower, and in the gaps of the back row (on the beach without parasols); many sit closer and get smaller (down to 30 px). |
| `mods/forest-sprite` | floating in the sidebar | Pet that reacts to blocked agents, meetings, late trains, the go-home nudge; offers the brief after Morning start ran by itself; also runs the theme switch, the daily backup and the compact layout: a window narrower than 1800 px (the laptop screen) gets the strip at 160 px instead of 260, and the right panel at 312 instead of 368, shared as `compact`: the mountain draws itself smaller, and the weather (a line per place, no bars), trains (the next train I can catch) and agenda (what is on now or next) blocks make themselves one line each; a click on the line shows the whole block, its "less" link folds it again (not kept over a restart). `forest-sprite.compact` switches by hand. Shortcut training (`shortcuts.js`): when I change space or tab, open a tab, split or zoom by clicking, it shows the key for it for 8 seconds and how often I clicked today; done by key, a short cheer with the key. It tells the two apart by a mouse press in the 1.5 seconds before; keys are read from `keys.json`; counts in shared `shortcuts.today`. Going to an agent that needs me, opening My work and starting a stack by clicking are answered with my own keys. |
| `mods/dutch` | dialog | The Dutch lesson. When the calendar's "Dutch" event starts, the sprite opens it nearly as large as the window. **At the office** (weather mod's `my-work.place`): the NOS Journaal in Makkelijke Taal for 8 minutes, then done (train). **At home**: the whole episode, then a quiz of 5 of its words (a wrong one comes back), then 6 minutes of Dutch Today on Xitun. The video opens by itself in a new Chrome window over the dialog; `cover.swift` (built into `data/dutch/cover`) covers every other screen and shows the word list there, large (`cover shot <words.json> <png>` draws that cover into a picture). Word list: `words.sh` (run by the sprite once a day) finds the last episode from before today on npo.nl, reads its public subtitles and asks `claude -p --model haiku` for 16 hard words (minute, English, Chinese) into `data/dutch/words.json`; it tries three times because the helper now and then refuses a text with names in it. After a lesson the list is copied to `learned.json`: the next morning before 12 the sprite opens a quiz of 8 of them once (`forest-sprite.refresh` again), missed ones first, and every 20 minutes the sprite shows one for a minute (hover: meaning). `forest-sprite.words` shows the list with sentences. Back from a water break, the "+1" click also opens the Xitun word cards. Esc snoozes 5 minutes, "Niet vandaag" asks twice and ends the streak. State in shared `dutch`. Ruixin asked for this to be harsh: "I tend to just SKIP it". |
| `mods/korok` | floating in the sidebar | Cheers when a ticket is done or a PR is merged. |
| `mods/dev-servers` | sidebar | One light per dev stack (Platform :3000, AIS :4000), start/stop, links to the staging and production remote shells. Also does Morning start: fast-forwards master in `~/floryn` and `~/ais` (only a checkout on master without changes to tracked files), then starts the stacks that are not running. Runs from the "Morning start" row, from `dev-servers.morning`, and by itself on a working day from 06:00 the first time an agent is working. Shares its steps as `morning`. |
| `mods/morning` | dialog | The Morning start brief: the steps above, what changed since 17:00 on the last working day (my PRs merged, reviews asked of me by name, red CI on master or my open PRs), today's meetings and duty. Does no work itself. Sets `morning.seen`. |
| `mods/evening` | dialog | "Conclude my day": today's recap. My PRs merged and opened today, the reviews I gave today, tickets done today (from the ticket cache), the Dutch lesson. Only reads. Opened by the "Conclude my day" button beside "Morning start" in the sidebar, or `herdr-app do mod.open '{"name":"evening"}'`. |
| `mods/over9k*` | sidebar, tabs, usage | Third-party, with small edits (My work button, display-only push/pull, `ALWAYS_LISTED` keeps ais listed, `over9k.subs` shares each agent's running subagents for the mountain, the footer row reads "Workspace help & options", and `over9k/claude-statusline.sh` no longer marks Claude as billed by use while plan limits were seen in the last 8 days: a resumed session made the usage block flip to dollars). |

Outside Herdr:

- `~/.claude/mods/my-tickets` is a Claude Code mod, loaded through `CLAUDE_CODE_PLUGIN_DIRS`
  in `~/.claude/settings.json`. Herdr cannot reach Notion or the calendar, so this mod
  fetches tickets and today's meetings every 10 minutes while a session runs and writes
  `~/.cache/my-work/tickets.json` and `meetings.json`. Changes to it only apply in
  sessions started afterwards.
- `~/.claude/settings.json` also has over9k's status line (silenced with `>/dev/null`);
  it feeds the Claude usage rows in the sidebar.
- `tools/crew-seasons.py <folder>` draws the figures of the valley, the beach and the orchard.
- `tools/crew-gen.py` and `tools/crew-resort.py` draw the figures (`crew-gen.py <folder>` draws the
  idle skiers with their mugs). Usage:
  `python3 tools/crew-resort.py ~/.config/herdr-app/mods/crew`. The mountain itself is
  drawn in `mods/crew/main.js` at the strip's width.

## How to work on it

- After every edit: `herdr-app check <mod folder>` and `herdr-app status` (its `errors`).
- `herdr-app shot <file.png>` saves the window. It catches animation frames, so a quick
  series of shots shows whether something moves.
- A block that is hidden since Herdr started has never run: what it last put in shared state is old.
  The sprite therefore ignores `train.alert` while the trains block is hidden (19 November 2026).
- A picture swapped for another leaves its place empty for a frame: keep the old one underneath
  (the mountain does, `scene.before`).
- A new mod folder gets docked into the layout by Herdr unless `mod.json` with
  `{ "place": "none" }` exists before `main.js` is written.
- Animate natively (`.loop`, `.transition`, `.frames`). An element outside the visible
  area is not animated: start it inside, nearly transparent.
- A picture written under a name Herdr has already shown is not re-read: use a new name.
- Mods cannot read a Wi-Fi name (macOS hides it); the weather mod recognises a network
  by its router address.
- `keys.json` is edited since 18 November 2026 (Ruixin agreed), so Herdr no longer adds its
  own new default shortcuts on upgrades: add those by hand. My keys: `cmd-j` the agent that
  needs me (`forest-sprite.needs-me`), `cmd-shift-m` My work (`forest-sprite.my-work`),
  `cmd-shift-s` start the stacks (`dev-servers.start-all`), `cmd-shift-b` Morning start and
  its brief (`dev-servers.brief`), `cmd-shift-k` compact layout (`forest-sprite.compact`).
  They reach their mod only while the sidebar is shown.
- over9k's "keep up to date" is on and may overwrite edits inside `mods/over9k*`;
  `sh backup.sh restore` brings them back.

## What Ruixin asked for and is not built yet

- A Stardew Valley look (asked 19 November 2026; Ruixin is a fan). Original pixel art only, never the
  game's own sprites or font. A mockup with two directions was shown (A: the ski resort as pixel art,
  B: a valley with café, shipping bin, field, mine, chickens as sub-agents); Ruixin chose on 19 November 2026: winter is A (the ski resort as pixel art), spring is B (the valley); the calendar Ruixin set: December to March the ski resort (sub-agents there: no small figures; an agent that has any running comes down under a paraglider and carries the folded wing as a small backpack in its colour on the lift; how many does not matter to Ruixin), April to June the valley, July and August the beach and harbour, September to November the orchard harvest (working: picking apples up a ladder and carrying crates to the cart; idle: by a fire with a mug; done: at the market stall with a star; blocked: in the pumpkin patch with a "!"; sub-agents: geese or squirrels following). All built on 19 November 2026: winter's wing, backpack and snowboarders, the valley, the beach, the orchard and the calendar. The summer mountain with hikers ("alp") is still in `main.js` and its drawings are still there, but no month shows it. Mockups were shown in the mountain's own style, with the summer hikers standing in for the new poses.
  Ruixin then asked to skip pixel art (19 November 2026): the scenes are drawn in the style the mountain has now.
  The mockup's script is not kept.

## Built but never seen working

- The mascot is a fox since 23 November 2026 (Ruixin found the forest sprite "a bit dumb");
  the mod is still called `forest-sprite`. `tools/fox.py` draws it: five moods in
  `mods/forest-sprite/fox-<mood>.svg` and the heads in front of the My work rows,
  `mods/my-work/fox-<side>.svg`: awake with a "!" (mine), asleep (someone else's), three of
  them (the team), with a star (shipped). Seen in Herdr: busy, mine and asleep.
  The mascot moves (since 23 November 2026, native loops only): its tail is a drawing of its own
  that sways under the body, and with open eyes it blinks (a lid in the fur's colour slides
  down over each eye inside a small window). Seen in a burst of screenshots, busy mood.

- Water (20 November 2026): the forest sprite reads the Mac's idle time every 20 seconds;
  50 minutes at the Mac without 3 minutes away makes water due (never during a meeting):
  the sprite says so and the crew clock's sign turns into a drop, until I have been away for
  3 minutes. Back from such a break the sprite offers "+1 glass" for 5 minutes. The water bar
  beside the clock shows today's glasses of 8; a click on a drop sets the count. State in
  shared `water`; the evening recap shows the count. Seen: the bar, and the due state with the
  time shortened. Not seen: a real 50 minutes, the break clearing it, the "+1" offer, a click
  on a drop, the pause during a meeting.

- The walk between the benches and the rest of the crew strip (20 November 2026): an agent that
  starts working stands up at its seat and walks to the station; one that comes back walks to
  its seat and only then sits down (`this.out`, `this.back`, `this.seat` in main.js). Seen in
  the orchard with one agent switched by a test; not in the other scenes, nor from the queue
  after a click on a finished agent.

- Rain or snow in the crew strip: one big striped umbrella over the idle benches
  (`mods/crew/umbrella-big.svg`) and a yellow rain hat and coat on everybody else
  (`raincoat.svg`, placed by the `BODY` table in main.js: where the body sits in each pose).
  Seen in all four scenes on 20 November 2026 with the rain forced on and one working agent;
  not yet in real rain or snow, nor on a blocked, done, flying or snowboarding figure.

- The dark cover on the laptop screen during the Dutch lesson: the helper ran and stopped on
  time and Chrome reported the right window spot (19 November 2026), but a screenshot of the
  other screen is not possible from here, so nobody but Ruixin has seen the cover itself.
- `herdr-app do forest-sprite.lesson` replays today's lesson, also when it is done.
- The crew strip's clock is a wooden Stardew-style box (day, 24-hour time with seconds, season sign
  `mods/crew/clock-<scene>.svg`); only the orchard sign was seen.

- The trains block could not come back after it hid itself (a hidden block does not run): the sprite now shows it again between 15:00 and 18:30 when away from home (23 November, seen). Still open: an appointment trip outside those hours cannot bring a hidden block back.
- Dutch, 23 November: seen are the words-only view, the morning quiz's first question, and the word cover as a picture. Not seen: a whole lesson in either form (office, home with quiz and Xitun), a click on a quiz answer, closing the Chrome window before the quiz, the cover on the real second screen, the morning quiz opening by itself, the sprite's word bubble, the "+1" click opening Xitun.
- Lamps and light strings in the strip (sky.js `lamp`, `string`; on when the sun is down by the weather mod's sunset): seen in the orchard at night only. Valley, beach (with the lighthouse beam) and ski ran without errors but were not looked at; unlit lamp posts by day not seen.
- The Dutch lesson dialog: the snooze and "Niet vandaag". The 8 minutes and the streak
  (1 to 2) were seen on 19 November 2026. Also seen on
  19 November 2026: it opened by itself at 17:00:45 (the sprite looks once a minute, so up to
  a minute late). The Journaal did not open with it: a dialog's `init` does not get the
  overlay's props, `props()` does. Fixed that day; the fix was seen once, on the reload. Whether NPO Start plays without an account, and how long an episode really is.
- Music: asked for on 18 November, not built. Ruixin listens on YouTube in Chrome. A mod can
  read the playing tab's title through AppleScript, but play/pause needs Chrome's "Allow
  JavaScript from Apple Events" (off); the other way is mpv with yt-dlp (not installed).
- Morning start running by itself at the first session of a day, and the sprite's offer of
  the brief afterwards (first chance: 19 November 2026). The brief with real rows (a merged
  PR, a review request, red CI): on 18 November GitHub had none, checked by hand.
- Followers on the mountain behind a blocked, done or idle parent, more than four of them,
  and Herdr's own sub-agents (`hc run`); seen on 18 November: two Claude Code subagents
  behind a working parent, on the lift and on the way down.
- Opening a one-line block with a click in the compact layout, and "less".
- The compact layout switching back by itself on the large screen (going compact on the
  laptop was seen on 18 November). The two release-testing rows in the support-duty block (it was folded).
- The five keys of my own pressed on the keyboard (their commands were run from a shell:
  only My work was seen working; `needs-me`, `brief`, `compact` by key and
  `start-all` with a stack to start were not).
- Shortcut training after a real click (the "Next time: ..." bubble): on 18 November only
  the cheer was seen, set off by a tab opened from a script, which it cannot tell from a key.
- `dev-servers.morning` only reaches the sidebar block while the sidebar is shown.
- The rain was reworked several times; Ruixin has not yet confirmed it looks right. Snow
  has never run.
- The wing and the backpack from real sub-agents: on 19 November 2026 they were seen with sub-agents faked in the code, and the snowboard with everybody forced onto one. Six idle agents on the benches were seen.
- The valley, the beach and the orchard: seen on 19 November 2026 with one working agent, two done ones and five idle ones, and with sub-agents faked. Not seen: a blocked agent on its lap (sitting in the grass, adrift in its boat, on a pumpkin), rain, night, the compact layout, and the calendar changing scene by itself (first on 1 December 2026).
- Small figures behind an agent had been broken since the compact layout came (a name clash in `figure()`); fixed 19 November 2026.
- A figure sitting down on its bench in one go when it turns idle (its bench used to slide over with it; changed 19 November 2026, not seen since).
- A finished agent heading straight down, a blocked one stopping in place, boarding on foot.
- The go-home nudge (17:15), the sprite's train alerts, the trains block hiding at 18:30.
- The home view (click "not at home" on the weather block once at home).
- Appointment journeys from a real calendar event; the 6 September 2027
  "travel to Amsterdam" block is the first known one.
- The Korok on a real ticket or merge; the deploy-instructions row.
- The deploy rows of the support-duty block during a real deploy: the Deploy button's tab, "waiting for CircleCI", "deploying", the toast and sound at the end, a failed deploy, the folded header. Seen on 19 November 2026: the rows at rest (deployed, commits waiting for production) and AIS staging as "deploying, 10 min" from someone else's push.
- The pick-up that once opened a plain shell instead of Claude Code is unexplained.

## How Ruixin likes to work

- Explanations with concrete examples; plain words; say what was and was not verified.
- Small steps, shown in a screenshot or mockup before a big decision.
- Never run anything against production. Keys stay in files, never in the chat.
