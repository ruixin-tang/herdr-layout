import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, theme, run, shared, setShared, layout, placement, readTextFile, exec, home, appHome, checking, nextCommand, openOverlay } from "herdr";
import { Trainer } from "./shortcuts.js";

// A small fox that floats over the window and follows the work (the mod keeps its first name,
// from when it was a forest sprite; tools/fox.py in ~/workspace-backup draws it):
//   I clicked what a key does -> shows that key for a few seconds (shortcuts.js); a short cheer when I used the key
//   an agent is blocked      -> startled, an orange "!"; a click goes to that agent
//   my Dutch lesson is due   -> opens the `dutch` dialog over the whole window when the calendar's
//                               "Dutch" event starts, again 5 minutes after every Esc, and says so
//                               in between, until I watched the Journaal or said "not today"
//   a meeting starts soon    -> says which and when; a click joins it (or just quiets it)
//   Morning start ran        -> once a day: says so; a click opens the brief
//   my train home is late    -> says which; a click quiets it
//   time to go home          -> once a day: when to get up for which train, and the rain; a click quiets it
//   new "Requires my action" -> holds up the count; a click opens My work
//   an agent finished unseen -> happy; a click goes to it
//   agents are working       -> busy, bobbing
//   nothing going on         -> asleep
const ART = "mods/forest-sprite";
// Written by the Claude Code mod `my-tickets` from the calendar, every 10 minutes.
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const SOON = 10 * 60000, LATE = 5 * 60000;
// The window follows my working day, not the sun: [from "HH:MM", theme, top colour, bottom colour].
// Dawn while I start up, day through the middle, dusk in the afternoon, night
// as the sign to wrap up. The themes are the Sheikah one turned to that hour's hue.
const SKY = [["06:00", "sheikah-dawn", "#3b2c44", "#0a1118"], ["10:00", "sheikah", "#0e2e38", "#050d10"], ["14:30", "sheikah-dusk", "#4a2a1c", "#0c0a12"], ["17:15", "sheikah-night", "#0b1636", "#02040a"]];
const LAYOUT = "over9k";
// The calendar event that is my Dutch lesson, and how long an Esc on its dialog buys.
const DUTCH = /dutch|nederlands/i, SNOOZE = 5 * 60000;
// The compact layout, for the laptop screen: a window narrower than LAPTOP gets a lower
// mountain strip and a narrower right panel, [block, full px, compact px]. The weather, trains
// and agenda blocks read the shared "compact" and make themselves one line each.
// "forest-sprite.compact" (a key) switches by hand; that choice holds until it is the
// window's own again.
// Water: after SIT at the Mac without a BREAK away from it, the sprite sends me for a glass.
const SIT = 50 * 60000, BREAK = 180000, OFFER = 300000;
// The fox is drawn on 64 and shown at 56: one unit of the drawing, and where its eyes begin.
const U = 56 / 64, EYES = [20, 36];
const LAPTOP = 1800, COMPACT = [["crew", 260, 160], ["panel", 368, 312]];

export default class ForestSprite extends View {
  init(_props, cx) {
    this.meetings = []; this.quiet = localStorage.getItem("quiet") ?? "";
    if (!checking()) { this.loadMeetings(cx); cx.timer.every(60000, (cx) => this.loadMeetings(cx)); }
    if (!checking()) { this.sky(); cx.timer.every(300000, () => this.sky()); }
    if (!checking()) { this.sat(cx); cx.timer.every(20000, (cx) => this.sat(cx)); }
    // Once a day, the first time Herdr is open: copy my workspace into ~/workspace-backup and commit it there.
    if (!checking()) { this.backup(); cx.timer.every(3600000, () => this.backup()); }
    if (!checking()) {
      this.fit(cx); cx.timer.every(5000, (cx) => this.fit(cx));
      cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          if (c === "compact") { localStorage.setItem("compact", shared("compact") ? "off" : "on"); this.fit(cx); }
          if (c === "needs-me") this.needsMe();
          if (c === "my-work") this.myWork();
          // The "did you drink?" question once more (to look at it).
          if (c === "water") setShared("water", { ...(shared("water") ?? {}), offer: Date.now() });
          // Today's lesson once more, also when it is done already (to look at the dialog).
          if (c === "lesson") { setShared("dutch", { ...(shared("dutch") ?? {}), done: false, skipped: false, watchAt: null }); this.lesson(true); }
          cx.notify();
        }
      });
    }
    this.trainer = new Trainer();
    if (!checking()) cx.timer.every(1000, (cx) => { if (this.trainer.over()) cx.notify(); });
    // The count already seen: only a rise wakes the sprite, not the standing pile.
    this.seen = Number(localStorage.getItem("seen") ?? -1);
  }

  backup() {
    const day = new Date().toDateString();
    if (localStorage.getItem("backup") === day) return;
    localStorage.setItem("backup", day);
    exec("sh", [`${home()}/workspace-backup/backup.sh`]).catch(() => null);
  }

  // "forest-sprite.needs-me" (a key): to the agent that waits for my answer, else to one that finished.
  needsMe() {
    const list = agents(), a = list.find((x) => x.status === "blocked") ?? list.find((x) => x.status === "done");
    if (a) run("pane.focus", { pane: a.pane }); else this.trainer.tell("Nobody needs you right now.");
  }

  // "forest-sprite.my-work" (a key): My work in the right panel; again puts the panel away.
  myWork() {
    const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
    const panel = find(layout(), "panel");
    if (panel && !panel.hidden && find(panel, "panel-body")?.active === "my-work") return run("layout.hide", { id: "panel" });
    run("layout.select", { stack: "panel-body", child: "my-work" }); run("layout.show", { id: "panel" });
  }

  // Compact or full, by the window's width (or my own choice): the blocks are sized when that
  // changes, and it is shared as "compact" for the mountain, which draws itself smaller.
  fit(cx) {
    cx.spawn(async (cx) => {
      try {
        if (shared("layout") !== LAYOUT) return;
        const bounds = JSON.parse(await readTextFile(`${appHome()}/window.json`)).bounds, narrow = bounds[2] < LAPTOP;
        this.win = [bounds[2], bounds[3]];
        const own = localStorage.getItem("compact");
        if (own === (narrow ? "on" : "off")) localStorage.removeItem("compact");
        const compact = own ? own === "on" : narrow;
        if (compact === shared("compact")) return;
        setShared("compact", compact);
        for (const [id, full, small] of COMPACT) run("layout.resize", { id, px: compact ? small : full });
        cx.notify();
      } catch { /* next time */ }
    });
  }

  // Dawn, day, dusk, night: writes the theme and the gradient into the layout file when the phase
  // changes (Herdr reloads it live), and only into the layout this sprite belongs to.
  sky() {
    const now = new Date().toTimeString().slice(0, 5);
    const [, name, top, bottom] = [...SKY].reverse().find(([from]) => now >= from) ?? SKY[SKY.length - 1];
    if (this.skyNow === name || shared("layout") !== LAYOUT) return;
    this.skyNow = name;
    exec("sh", ["-c", 'f="$1"; t=$(mktemp) && jq --arg n "$2" --arg a "$3" --arg b "$4" \'if .theme == $n then empty else .theme = $n | .background.gradient = [$a, $b] end\' "$f" > "$t" && [ -s "$t" ] && cat "$t" > "$f"; rm -f "$t"',
      "sh", `${appHome()}/layouts/${LAYOUT}.json`, name, top, bottom]).catch(() => null);
  }

  // Re-read each minute; the redraw also moves the countdown on.
  loadMeetings(cx) {
    cx.spawn(async (cx) => {
      try {
        const cache = JSON.parse((await readTextFile(MEETINGS)) ?? "{}");
        this.meetings = cache.meetings ?? [];
        // The Support duty block only shows on a duty day. From here, because a hidden block does
        // not run and could not bring itself back. Only when today's agenda says so, and only when
        // that changes: shown by hand (layout.show) it stays until the next duty day ends.
        const duty = Boolean(cache.duty);
        if (shared("layout") === LAYOUT && new Date(cache.loadedAt ?? 0).toDateString() === new Date().toDateString() && duty !== this.duty) {
          this.duty = duty;
          run(duty ? "layout.show" : "layout.hide", { id: "support-duty" });
        }
      } catch { /* next minute */ }
      this.lesson();
      cx.notify();
    });
  }

  // How long I have been sitting: the Mac says how long ago I last touched it. Away for BREAK
  // (or the Mac asleep that long) is a break and starts the count again; SIT without one makes
  // water due, but never during a meeting. Shared as "water": { day, glasses, since, due, offer }
  // for the mountain's water bar; after a break that was due, `offer` asks whether I drank.
  sat(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("sh", ["-c", "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000; exit}'"]);
        const now = Date.now(), day = new Date().toDateString(), idle = Number(r.stdout) || 0, was = shared("water") ?? {};
        const w = was.day === day ? { ...was } : { day, glasses: 0, since: now, due: false, offer: 0 };
        const away = idle >= BREAK || (this.satAt && now - this.satAt > BREAK);
        this.satAt = now;
        if (away) { if (w.due) w.offer = now; w.since = now; w.due = false; }
        else w.due = now - w.since >= SIT && !this.meetings.some((m) => m.start <= now && now < m.end);
        if (JSON.stringify(w) !== JSON.stringify(was)) setShared("water", w);
        cx.notify();
      } catch { /* next time */ }
    });
  }

  // Today's Dutch lesson from the calendar, once it has started and while it is neither done nor skipped.
  lessonDue() {
    const now = Date.now(), day = new Date().toDateString(), s = shared("dutch") ?? {};
    const m = this.meetings.find((x) => DUTCH.test(x.title) && new Date(x.start).toDateString() === day && x.start <= now);
    return m && !(s.day === day && (s.done || s.skipped)) ? m : null;
  }

  // The dialog, nearly as large as the window. By itself only when it is not open already
  // (opened after it was last closed, and not longer than half an hour ago) and the snooze is over.
  lesson(asked = false) {
    const m = this.lessonDue();
    if (!m || shared("layout") !== LAYOUT) return;
    const s = shared("dutch") ?? {}, now = Date.now(), today = s.day === new Date().toDateString();
    const open = today && s.openedAt > (s.closedAt ?? 0) && now - s.openedAt < 1800000;
    // (Closed before the lesson began is not a snooze.)
    if (open || (!asked && today && (s.closedAt ?? 0) >= m.start && now - s.closedAt < SNOOZE)) return;
    // By itself it also opens the Journaal in the browser, so there is nothing to click.
    openOverlay({ mod: "dutch", kind: "dialog", width: (this.win?.[0] ?? 1100) - 60, height: (this.win?.[1] ?? 700) - 60, props: { auto: !asked } });
  }

  // The meeting about to start (10 minutes ahead) or just started (5 minutes in), unless quieted.
  meeting() {
    const now = Date.now();
    const m = this.meetings.find((x) => x.start - now < SOON && now - x.start < LATE && now < x.end);
    return m && `${m.title}@${m.start}` !== this.quiet ? m : null;
  }

  see(n) { this.seen = n; localStorage.setItem("seen", String(n)); }

  mood() {
    const list = agents(), todo = Number(shared("my-work.action") ?? 0);
    if (this.seen < 0 || todo < this.seen) this.see(todo);
    const blocked = list.find((a) => a.status === "blocked");
    // Shortcut training comes first: it is about what I did a second ago, and it is gone in a few.
    const note = this.trainer.current();
    if (note?.text) return { art: "happy", bubble: "✓", color: "done", say: note.text, tip: note.text, bob: 900, go: null };
    if (note) return note.clicked
      ? { art: "busy", bubble: note.key, color: "accent", say: `Next time: ${note.key} for ${note.label}.${note.clicks > 1 ? ` Clicked ${note.clicks} times today.` : ""}`, tip: "The key for what you just clicked", bob: 900, wide: true, go: null }
      : { art: "happy", bubble: note.key, color: "done", tip: "Done by key", bob: 600, go: null };
    if (this.lessonDue()) return { art: "alert", bubble: "NL", color: "accent", say: "Het Journaal in Makkelijke Taal wacht op je.", tip: "Click for the Dutch lesson", bob: 700, wide: true, go: () => this.lesson(true) };
    const meet = this.meeting();
    if (meet && !blocked) {
      const mins = Math.round((meet.start - Date.now()) / 60000);
      return { art: "alert", bubble: mins > 0 ? `${mins}m` : "now", color: "accent", bob: 600,
        say: `${meet.title} ${mins > 0 ? `in ${mins} min` : "is starting"}`, tip: meet.url ? "Click to join" : "Click to quiet",
        go: () => { this.quiet = `${meet.title}@${meet.start}`; localStorage.setItem("quiet", this.quiet); if (meet.url) exec("open", [meet.url]); } };
    }
    if (blocked) return { art: "alert", bubble: "!", color: "blocked", tip: blocked.title, bob: 500, go: () => run("pane.focus", { pane: blocked.pane }) };
    // Sitting too long: it only goes away when I have been away from the Mac for a few minutes.
    const water = shared("water") ?? {};
    if (water.due) return { art: "alert", bubble: "H2O", color: "accent", say: `You have been sitting for ${Math.round((Date.now() - water.since) / 60000)} minutes. Go get some water.`, tip: "Goes away once you have been away for 3 minutes", bob: 800, wide: true, go: null };
    if (water.offer && Date.now() - water.offer < OFFER) return { art: "happy", bubble: "+1", color: "done", say: "Welcome back. Did you drink? Click to add a glass.", tip: "Click: one more glass", bob: 900, wide: true,
      go: () => { const w = shared("water") ?? {}; setShared("water", { ...w, glasses: (w.glasses ?? 0) + 1, offer: 0 }); } };
    // Morning start ran by itself (the dev-servers mod, at my first session): a click opens its brief.
    const today = new Date().toDateString(), morning = shared("morning");
    if (morning?.day === today && morning.auto && shared("morning.seen") !== today)
      return { art: "happy", bubble: "AM", color: "accent", say: "Master is pulled and the stacks are starting. Your brief is ready.", tip: "Click for the brief", bob: 900, wide: true, go: () => run("mod.open", { name: "morning" }) };
    // My next train home is late or cancelled (the trains mod says so); a click quiets that one.
    // Only while the trains block shows: hidden (at home, outside its hours) it does not run,
    // so what it last shared is old.
    const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
    const trains = find(layout(), "trains"), train = trains && !trains.hidden ? shared("train.alert") : null;
    const nudge = shared("train.nudge");
    if (!(train && train !== this.quietTrain) && nudge?.day === new Date().toDateString() && localStorage.getItem("nudged") !== nudge.day)
      return { art: "happy", bubble: "go", color: "accent", say: nudge.text, tip: "Click to quiet", bob: 900, wide: true, go: () => { localStorage.setItem("nudged", nudge.day); } };
    if (train && train !== this.quietTrain) return { art: "alert", bubble: "NS", color: "blocked", say: train, tip: "Click to quiet", bob: 700, go: () => { this.quietTrain = train; } };
    if (todo > this.seen) return { art: "alert", bubble: `+${todo - this.seen}`, color: "blocked", tip: "New for you in My work", bob: 700, go: () => {
      this.see(todo);
      run("layout.select", { stack: "panel-body", child: "my-work" }); run("layout.show", { id: "panel" });
    } };
    const done = list.find((a) => a.status === "done");
    if (done) return { art: "happy", bubble: "✓", color: "done", tip: done.title, bob: 900, go: () => run("pane.focus", { pane: done.pane }) };
    const working = list.filter((a) => a.status === "working").length;
    if (working) return { art: "busy", bubble: String(working), color: "working", tip: `${working} working`, bob: 1200, go: null };
    return { art: "sleep", bubble: null, color: "dim", tip: "All quiet", bob: 0, go: null };
  }

  render() {
    this.trainer.watch();
    const t = theme(), m = this.mood(), right = placement()?.edge === "right";
    // What it says has to fit in the sidebar it floats over, whatever width that has now.
    const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
    const room = Math.max(120, (find(layout(), "sidebar")?.size?.px ?? 268) - 36);
    const bubble = m.art === "sleep"
      ? div().h(16).text_size(11).text_color(t.dim).frames(["z", "zZ", "zZz", ""], 700)
      : div().h(16).min_w(16).px(4).flex().items_center().justify_center().rounded(8).text_size(10).font_semibold()
        .bg(t[m.color]).text_color(t.accent_foreground).child(m.bubble)
        .when(m.art === "alert", (el) => el.loop("opacity", { from: 0.45, to: 1, period: 900 }));
    return v_flex().id("forest-sprite").p(4).gap(1).items_center().tooltip(m.tip)
      .when(Boolean(m.go), (el) => el.cursor_pointer())
      .on_mouse_down_out(() => { this.trainer.press(); })
      .on_click((_e, cx) => { this.trainer.press(); if (m.go) { m.go(); cx.notify(); } })
      .when(Boolean(m.say), (el) => el.child(div().max_w(Math.min(m.wide ? 236 : 180, room)).px(6).py(2).rounded(6).bg(t.raised).text_size(11).text_color(t.foreground).map((el) => (m.wide ? el.whitespace_normal() : el.truncate())).child(m.say)))
      .child(h_flex().min_w(56).map((el) => (right ? el.justify_start() : el.justify_end())).child(bubble))
      // The fox: its tail wags under the body (faster when happy or startled, not asleep), and
      // with its eyes open it blinks. A lid in the fur's colour comes down over each eye from far
      // above, inside a small window on the forehead, so it only shows in the last moment.
      .child(div().relative().flex_none().w(56).h(56).when(m.bob > 0, (el) => el.loop("top", { from: 0, to: -4, period: m.bob }))
        .when(m.art !== "sleep", (el) => el.child(image(`${ART}/fox-tail.svg`).absolute().top(0).w(56).h(56).loop("left", { from: -1.5, to: 2, period: m.art === "idle" ? 1300 : m.art === "busy" ? 900 : 450 })))
        .child(image(`${ART}/fox-${m.art}.svg`).absolute().left(0).top(0).w(56).h(56))
        .when(m.art === "idle" || m.art === "busy", (el) => el.children(EYES.map((x, i) => div().id(`fox-lid-${i}`).absolute().left(x * U).top(19 * U).w(8 * U).h(14 * U).overflow_hidden()
          .child(div().absolute().left(0).w(8 * U).h(8 * U).rounded(2).bg("#f08a3c").loop("top", { from: -130 * U, to: 6 * U, period: 2600 }))))));
  }
}
