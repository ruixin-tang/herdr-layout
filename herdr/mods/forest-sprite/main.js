import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, theme, run, shared, setShared, layout, placement, readTextFile, exec, home, appHome, checking, nextCommand, openOverlay } from "herdr";
import { Trainer } from "./shortcuts.js";

// A small fox that floats over the window and follows the work (the mod keeps its first name,
// from when it was a forest sprite; tools/fox.py in ~/workspace-backup draws it):
//   I clicked what a key does -> shows that key for a few seconds (shortcuts.js); a short cheer when I used the key
//   an agent is blocked      -> startled, an orange "!"; a click goes to that agent
//   something wants me       -> the tag of the first notice; what it says is in the sidebar
//   an agent finished unseen -> happy; a click goes to it
// What wants me is a list in the sidebar (the `notices` mod draws it, this one makes it: notices()),
// each with its buttons, and each stays until I dealt with it:
//   my Dutch lesson is due   -> the `dutch` dialog also opens over the whole window when the
//                               calendar's "Dutch" event starts, and again 5 minutes after every Esc
//   a meeting starts soon    -> which and when; Join, or Quiet
//   sitting too long         -> get up for water; gone once I have been away
//   back from that break     -> "+1 glass" and "20 woorden" (Xitun), each its own button
//   Morning start ran        -> once a day; opens the brief
//   my train home is late    -> which; Quiet
//   time to go home          -> once a day: when to get up for which train, and the rain
//   new "Requires my action" -> the count; shows My work
//   agents are working       -> busy, bobbing
//   nothing going on         -> asleep
const ART = "mods/forest-sprite";
// Written by the Claude Code mod `my-tickets` from the calendar, every 10 minutes.
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const SOON = 10 * 60000, LATE = 5 * 60000;
// The window follows my working day, not the sun: [from "HH:MM", theme, top colour, bottom colour].
// Dawn while I start up, day through the middle, dusk in the afternoon, night
// as the sign to wrap up. The themes are the Sheikah one turned to that hour's hue.
const SKY = [["06:00", "sheikah-dawn", "#3b2c44", "#0a1118"], ["10:00", "sheikah", "#0e2e38", "#050d10"], ["14:30", "sheikah-dusk", "#304521", "#0a0c0a"], ["17:15", "sheikah-night", "#0b1636", "#02040a"]];
const LAYOUT = "over9k";
// The calendar event that is my Dutch lesson, and how long an Esc on its dialog buys.
const DUTCH = /dutch|nederlands/i, SNOOZE = 5 * 60000;
// The compact layout, for the laptop screen: a window narrower than LAPTOP gets a lower
// mountain strip and a narrower right panel, [block, full px, compact px]. The weather, trains
// and agenda blocks read the shared "compact" and make themselves one line each.
// "forest-sprite.compact" (a key) switches by hand; that choice holds until it is the
// window's own again.
// Water: after SIT at the Mac without a BREAK away from it, the sprite sends me for a glass.
// OFFER: how long the question whether I drank stays in the list.
const SIT = 50 * 60000, BREAK = 180000, OFFER = 30 * 60000;
// The notices block in the sidebar, and how many letters of a notice fit on one of its lines.
const BAR = "notices", LINE = 34;
// Back from a water break, the glass comes with 20 word cards on Xitun (my A1-A2 book).
const CARDS = "https://xitun.ltd/my/nl/contents?tab=vocabulary&book_id=de92d086-b370-4c9e-a7f3-a20337a79f4e&mode=study";
// The words of my last Dutch lesson: one of them shows for a minute every WORD_EVERY minutes
// when nothing else is up, and in the morning (before REFRESH_UNTIL o'clock) they come as a quiz.
const WORD_EVERY = 20, REFRESH_UNTIL = 12;
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
          // A button in the notices list was clicked: which one is in shared "notices.click".
          if (c === "notice") {
            const click = shared("notices.click") ?? {};
            this.notices().find((n) => n.id === click.id)?.acts.find((a) => a.key === click.key)?.go();
          }
          // `forest-sprite.notices`: a few made-up notices, to look at the list; again takes them away.
          if (c === "notices") this.sample = !this.sample;
          this.post();
          // Today's lesson once more, also when it is done already (to look at the dialog).
          if (c === "lesson") { setShared("dutch", { ...(shared("dutch") ?? {}), done: false, skipped: false, watchAt: null }); this.lesson(true); }
          // The whole lesson at home in two minutes, to show it: nothing of it counts.
          if (c === "demo") openOverlay({ mod: "dutch", kind: "dialog", width: (this.win?.[0] ?? 1100) - 60, height: (this.win?.[1] ?? 700) - 60, props: { demo: true, wide: this.win?.[0] ?? 1100 } });
          // The words of the last Journaal, without a lesson.
          if (c === "refresh") this.refresh(true);
          if (c === "words") openOverlay({ mod: "dutch", kind: "dialog", width: Math.min((this.win?.[0] ?? 1100) - 60, 1300), height: Math.min((this.win?.[1] ?? 700) - 60, 760), props: { look: true } });
          cx.notify();
        }
      });
    }
    this.trainer = new Trainer();
    if (!checking()) cx.timer.every(1000, (cx) => { if (this.trainer.over()) cx.notify(); });
    if (!checking()) cx.timer.every(2000, () => this.post());
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
    this.words();
    readTextFile(`${appHome()}/data/dutch/learned.json`).then((text) => { this.learned = JSON.parse(text).words ?? []; }).catch(() => { this.learned = []; }).then(() => this.refresh());
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
      // The trains block hides itself at home and outside its hours, and hidden it does not run,
      // so it cannot come back by itself either (it stayed away after "not at home" until a
      // restart). In its hours, away from home, show it: from there it looks after itself.
      const clock = new Date().toTimeString().slice(0, 5), seek = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => seek(c, id)).find(Boolean));
      if (shared("layout") === LAYOUT && clock >= "15:00" && clock < "18:30" && shared("my-work.place") !== "home" && seek(layout(), "trains")?.hidden) run("layout.show", { id: "trains" });
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

  // The word list for today's Dutch lesson (mods/dutch/words.sh), made once a day. A try that
  // fails comes back half an hour later, all day: three tries in the first minutes and no more
  // left a whole day without a list when Claude was logged out in the morning. The helper may
  // also refuse the text (Floryn's data rule, the news names people). data/dutch/words.log
  // says why a try failed.
  words() {
    const day = new Date().toDateString();
    if (this.wordsDay === day || this.wordsBusy || Date.now() - (this.wordsTried ?? 0) < 30 * 60000) return;
    this.wordsBusy = true; this.wordsTried = Date.now();
    exec("sh", [`${appHome()}/mods/dutch/words.sh`, appHome()], { timeout: 120000 })
      .then((r) => { if (r.code === 0) this.wordsDay = day; }).catch(() => null).finally(() => { this.wordsBusy = false; });
  }

  // Yesterday's words as a quiz, first thing: once by itself on a day after a lesson, in the
  // morning and not into a meeting. Esc is fine; `forest-sprite.refresh` asks again.
  refresh(asked = false) {
    const s = shared("dutch") ?? {}, now = new Date(), day = now.toDateString();
    if (!(this.learned ?? []).length || (!asked && shared("layout") !== LAYOUT)) return;
    const due = s.learned && s.learned !== day && s.refreshed !== day && s.refreshAsked !== day && now.getHours() < REFRESH_UNTIL;
    if (!asked && (!due || this.meetings.some((m) => m.start - SOON < now && now < m.end))) return;
    openOverlay({ mod: "dutch", kind: "dialog", width: 760, height: 620, props: { refresh: true } });
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
    // "Later" in the dialog (or in the notices list): not by itself before that time.
    if (!asked && now < (s.snoozeUntil ?? 0)) return;
    const open = today && s.openedAt > (s.closedAt ?? 0) && now - s.openedAt < 1800000;
    // (Closed before the lesson began is not a snooze.)
    if (open || (!asked && today && (s.closedAt ?? 0) >= m.start && now - s.closedAt < SNOOZE)) return;
    // By itself it also opens the Journaal in the browser, so there is nothing to click.
    openOverlay({ mod: "dutch", kind: "dialog", width: (this.win?.[0] ?? 1100) - 60, height: (this.win?.[1] ?? 700) - 60, props: { auto: !asked, wide: this.win?.[0] ?? 1100 } });
  }

  // The meeting about to start (10 minutes ahead) or just started (5 minutes in), unless quieted.
  meeting() {
    const now = Date.now();
    const m = this.meetings.find((x) => x.start - now < SOON && now - x.start < LATE && now < x.end);
    return m && `${m.title}@${m.start}` !== this.quiet ? m : null;
  }

  see(n) { this.seen = n; localStorage.setItem("seen", String(n)); }

  // Everything that wants me, most pressing first: { id, tag, color, text, acts: [{ key, label, go }] }.
  notices() {
    const sample = (id, tag, color, text, acts) => ({ id, tag, color, text, acts: acts.map((label, i) => ({ key: String(i), label, go: () => { this.sample = false; } })) });
    if (this.sample) return [sample("s1", "12m", "accent", "Diligence standup in 12 min", ["Join", "Quiet"]), sample("s2", "+1", "done", "Welcome back. Did you drink?", ["+1 glass", "20 woorden", "No"]),
      sample("s3", "NS", "blocked", "Your 17:22 to Eindhoven is 8 min late", ["Quiet"]), sample("s4", "NL", "accent", "Het Journaal in Makkelijke Taal wacht op je.", ["Start de les"])];
    const list = [], now = Date.now(), today = new Date().toDateString();
    const add = (id, tag, color, text, acts = []) => list.push({ id, tag, color, text, acts: acts.map(([key, label, go]) => ({ key, label, go })) });
    if (this.lessonDue()) {
      const until = shared("dutch")?.snoozeUntil ?? 0, later = (minutes) => () => setShared("dutch", { ...(shared("dutch") ?? {}), snoozeUntil: Date.now() + minutes * 60000, watchAt: null, stage: null, stageAt: 0 });
      const start = ["start", "Start de les", () => { setShared("dutch", { ...(shared("dutch") ?? {}), snoozeUntil: 0 }); this.lesson(true); }];
      // Snoozed: a quiet row that says until when; else it waits, and can be put off from here too.
      if (now < until) add("dutch", "NL", "dim", `De Nederlandse les komt om ${new Date(until).toTimeString().slice(0, 5)} terug.`, [start]);
      else add("dutch", "NL", "accent", "Het Journaal in Makkelijke Taal wacht op je.", [start, ["later", "30 min later", later(30)]]);
    }
    const meet = this.meeting();
    if (meet) {
      const mins = Math.round((meet.start - now) / 60000), quiet = () => { this.quiet = `${meet.title}@${meet.start}`; localStorage.setItem("quiet", this.quiet); };
      add("meeting", mins > 0 ? `${mins}m` : "now", "accent", `${meet.title} ${mins > 0 ? `in ${mins} min` : "is starting"}`,
        [...(meet.url ? [["join", "Join", () => { quiet(); exec("open", [meet.url]); }]] : []), ["quiet", "Quiet", quiet]]);
    }
    // Sitting too long: it only goes away when I have been away from the Mac for a few minutes.
    const water = shared("water") ?? {};
    if (water.due) add("water", "H2O", "accent", `You have been sitting for ${Math.round((now - water.since) / 60000)} minutes. Stand up and get some water.`);
    // Back from that break: the glass and the word cards are two buttons, in any order.
    else if (water.offer && now - water.offer < OFFER) {
      const over = () => { const w = shared("water") ?? {}; setShared("water", { ...w, offer: 0 }); };
      const drank = this.drank === water.offer;
      add("drank", "+1", "done", drank ? "One glass added. Now 20 woorden?" : "Welcome back. Did you drink? And do 20 woorden.", [
        ...(drank ? [] : [["glass", "+1 glass", () => { const w = shared("water") ?? {}; this.drank = w.offer; setShared("water", { ...w, glasses: (w.glasses ?? 0) + 1 }); }]]),
        ["cards", "20 woorden", () => { exec("open", [CARDS]); over(); }], ["no", drank ? "Not now" : "No", over]]);
    }
    // Morning start ran by itself (the dev-servers mod, at my first session).
    const morning = shared("morning");
    if (morning?.day === today && morning.auto && shared("morning.seen") !== today)
      add("morning", "AM", "accent", "Master is pulled and the stacks are starting. Your brief is ready.", [["open", "Open the brief", () => run("mod.open", { name: "morning" })]]);
    // My next train home is late or cancelled (the trains mod says so). Only while the trains
    // block shows: hidden (at home, outside its hours) it does not run, so what it last shared is old.
    const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
    const trains = find(layout(), "trains"), train = trains && !trains.hidden ? shared("train.alert") : null;
    if (train && train !== this.quietTrain) add("train", "NS", "blocked", train, [["quiet", "Quiet", () => { this.quietTrain = train; }]]);
    const nudge = shared("train.nudge");
    if (nudge?.day === today && localStorage.getItem("nudged") !== nudge.day) add("nudge", "go", "accent", nudge.text, [["ok", "OK", () => { localStorage.setItem("nudged", nudge.day); }]]);
    // Only a rise in "Requires my action" is news, not the standing pile.
    const todo = Number(shared("my-work.action") ?? 0);
    if (this.seen < 0 || todo < this.seen) this.see(todo);
    if (todo > this.seen) add("todo", `+${todo - this.seen}`, "blocked", `${todo - this.seen} new for you in My work`, [["show", "Show", () => {
      this.see(todo);
      run("layout.select", { stack: "panel-body", child: "my-work" }); run("layout.show", { id: "panel" });
    }]]);
    return list;
  }

  // The list goes to the notices block when it changed; the block is as tall as the list needs,
  // and away when there is nothing.
  post() {
    if (shared("layout") !== LAYOUT) return;
    const list = this.notices().map((n) => ({ ...n, acts: n.acts.map(({ key, label }) => ({ key, label })) })), text = JSON.stringify(list);
    if (text === this.posted) return;
    this.posted = text;
    setShared("notices", list);
    if (!list.length) return run("layout.hide", { id: BAR });
    run("layout.resize", { id: BAR, px: 10 + list.reduce((sum, n) => sum + Math.ceil(n.text.length / LINE) * 17 + (n.acts.length ? 26 : 0) + 8, 0) });
    run("layout.show", { id: BAR });
  }

  mood() {
    const list = agents();
    const blocked = list.find((a) => a.status === "blocked");
    // Shortcut training comes first: it is about what I did a second ago, and it is gone in a few.
    const note = this.trainer.current();
    if (note?.text) return { art: "happy", bubble: "✓", color: "done", say: note.text, tip: note.text, bob: 900, go: null };
    if (note) return note.clicked
      ? { art: "busy", bubble: note.key, color: "accent", say: `Next time: ${note.key} for ${note.label}.${note.clicks > 1 ? ` Clicked ${note.clicks} times today.` : ""}`, tip: "The key for what you just clicked", bob: 900, wide: true, go: null }
      : { art: "happy", bubble: note.key, color: "done", tip: "Done by key", bob: 600, go: null };
    if (blocked) return { art: "alert", bubble: "!", color: "blocked", tip: blocked.title, bob: 500, go: () => run("pane.focus", { pane: blocked.pane }) };
    // Something wants me: only its tag here, what it says and its buttons are in the sidebar's list.
    const first = this.notices()[0];
    if (first) return { art: first.color === "done" ? "happy" : first.color === "dim" ? "idle" : "alert", bubble: first.tag, color: first.color, tip: `In the list beside me: ${first.text}`, bob: 800, go: null };
    // A word from my last lesson: hover to see whether I still know it.
    const minute = Math.floor(Date.now() / 60000), word = (this.learned ?? [])[Math.floor(minute / WORD_EVERY) % Math.max(1, (this.learned ?? []).length)];
    if (word && minute % WORD_EVERY === 0) return { art: "idle", bubble: "NL", color: "accent", say: word.nl, tip: [word.zh, word.en].filter(Boolean).join(" · "), bob: 1200, go: null };
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
