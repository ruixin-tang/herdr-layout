import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, checking, shared, setShared, props, closeOverlay, notify, appHome, readTextFile } from "herdr";

// The Dutch lesson, as a dialog over the whole window: every day my calendar has a
// "Dutch" event, the forest sprite opens this when it starts, and it stays in the way
// until I have watched the NOS Journaal in Makkelijke Taal.
//   by itself       however it is opened, the Journaal opens at once in a new Chrome window
//                   over the middle of this dialog: nothing to click. It is the last episode
//                   from before today, and its hard words stand left and right of the video in
//                   the order they are said (words.sh, run by the sprite). Every other screen goes
//                   dark (cover.swift). WATCH minutes later the day counts as done, the streak
//                   grows and the workspace and the screens come back
//   Esc             only snoozes: the sprite opens it again a few minutes later
//   "Niet vandaag"  asks twice, then lets me go and ends the streak
// The state is shared as "dutch": { day, openedAt, closedAt, watchAt, done, skipped, streak, last }.
// The list of episodes, for when there is no word list (which knows the episode itself).
const URL = "https://npo.nl/start/serie/nos-journaal-in-makkelijke-taal/afleveringen";
const WATCH = 8 * 60000;
// cover.swift, built into data/dutch/cover when the source is newer. "news" lays the Journaal
// over the dialog (plain `open` if that fails), "dark" covers the other screens, "stop" ends that.
const cover = (...args) => exec("sh", ["-c", `src="$1/mods/dutch/cover.swift"; bin="$1/data/dutch/cover"; shift
  [ "$1" = news ] || pkill -f "[d]ata/dutch/cover dark"; [ "$1" = stop ] && exit 0
  [ "$bin" -nt "$src" ] || { mkdir -p "$(dirname "$bin")" && swiftc -O "$src" -o "$bin"; } || { [ "$1" = news ] && open "$2"; exit 1; }
  "$bin" "$@" || { [ "$1" = news ] && open "$2"; }`, "sh", appHome(), ...args.map(String)], { timeout: 600000 }).catch(() => null);
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
// The working day before a day, as a date string: a streak runs over the weekend.
const before = (day) => { const d = new Date(day); do d.setDate(d.getDate() - 1); while (d.getDay() % 6 === 0); return d.toDateString(); };

export default class Dutch extends View {
  init(_props, cx) {
    this.armed = false;
    if (checking()) return;
    // Only the words (the sprite's "words" command): no lesson, no video, no dark screens.
    if (props()?.look) {
      cx.spawn(async (cx) => { try { this.words = JSON.parse(await readTextFile(`${appHome()}/data/dutch/words.json`)); } catch { this.words = null; } cx.notify(); });
      return;
    }
    const day = new Date().toDateString(), was = shared("dutch") ?? {};
    // A new day starts clean; the streak and its last day come along.
    this.set(was.day === day ? { openedAt: Date.now() } : { day, openedAt: Date.now(), closedAt: 0, watchAt: null, done: false, skipped: false });
    const fresh = !shared("dutch")?.watchAt;
    if (fresh) this.set({ watchAt: Date.now() });
    const left = WATCH - (Date.now() - shared("dutch").watchAt);
    if (!shared("dutch").done && left > 0) cover("dark", Math.ceil(left / 1000) + 2);
    cx.spawn(async (cx) => {
      try { this.words = JSON.parse(await readTextFile(`${appHome()}/data/dutch/words.json`)); } catch { this.words = null; }
      if (fresh) cover("news", this.words?.url ?? URL);
      cx.notify();
    });
    // The countdown, and the end of the lesson.
    cx.timer.every(1000, (cx) => {
      const s = shared("dutch") ?? {};
      if (s.watchAt && !s.done && Date.now() - s.watchAt >= WATCH) this.finish();
      cx.notify();
    });
  }

  set(change) { setShared("dutch", { ...(shared("dutch") ?? {}), ...change }); }

  finish() {
    const s = shared("dutch") ?? {}, day = new Date().toDateString();
    const streak = s.last === before(day) ? (s.streak ?? 0) + 1 : s.last === day ? s.streak ?? 1 : 1;
    this.set({ done: true, streak, last: day });
    cover("stop");
    notify({ title: "Goed gedaan!", body: `Journaal gekeken. Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}.`, level: "success", timeout: 8000 });
    closeOverlay(props().overlay);
  }

  // Esc, or anything else that closes it: the sprite reads this as a snooze. The other screens come back.
  async close() { if (props()?.look) return; this.set({ closedAt: Date.now() }); cover("stop"); }

  button(id, label, t, fn) {
    return div().id(id).px(10).py(4).rounded(8).cursor_pointer().flex_none().text_size(11).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(fn).child(label);
  }

  // Half of the word list, in the strip beside the video: the minute, the word, what it means.
  column(list, w, t) {
    return v_flex().w(w).h_full().flex_none().px(14).pt(44).pb(8).gap(10).overflow_hidden().children(list.map((x) => v_flex().gap(1)
      .child(h_flex().gap(6).items_baseline()
        .child(div().flex_none().text_size(10).text_color(t.dim).child(x.at))
        .child(div().text_size(15).font_semibold().text_color(t.accent).child(x.nl)))
      .child(div().text_size(12).text_color(t.foreground).child(x.zh ?? ""))
      .child(div().text_size(11).text_color(t.muted).child(x.en ?? ""))));
  }

  render() {
    const t = theme(), s = shared("dutch") ?? {}, streak = s.streak ?? 0, now = Date.now();
    // Looking only: the whole list, each word with the sentence it was said in.
    if (props()?.look) return v_flex().id("dutch").size_full().px(40).py(28).gap(9).overflow_hidden().bg(t.popover).text_color(t.foreground)
      .child(div().text_size(18).font_semibold().pb(6).child(this.words ? `De woorden van het Journaal van ${this.words.date}` : "Nog geen woordenlijst."))
      .children((this.words?.words ?? []).map((x) => h_flex().gap(14).items_baseline()
        .child(div().w(34).flex_none().text_size(11).text_color(t.dim).child(x.at))
        .child(div().w(210).flex_none().text_size(15).font_semibold().text_color(t.accent).child(x.nl))
        .child(div().w(250).flex_none().text_size(12).child(`${x.zh ?? ""}  ${x.en ?? ""}`))
        .child(div().flex_1().min_w_0().truncate().text_size(12).text_color(t.muted).child(x.zin ?? ""))));
    const kept = streak > 0 && (s.last === new Date().toDateString() || s.last === before(new Date().toDateString()));
    const left = s.watchAt ? Math.max(0, WATCH - (now - s.watchAt)) : 0;
    // The Journaal lies over the middle (cover.swift decides how wide), so the words get what is
    // left beside it and everything else sits in a strip at the bottom.
    const wide = props()?.wide ?? 1100, side = Math.floor((wide - Math.min(wide - 80, Math.max(900, wide * 0.7))) / 2) - 30;
    const words = side >= 150 ? this.words?.words ?? [] : [], half = Math.ceil(words.length / 2);
    return v_flex().id("dutch").size_full().bg(t.popover).text_color(t.foreground)
      .child(h_flex().flex_1().min_h_0().w_full().justify_between()
        .child(this.column(words.slice(0, half), Math.max(side, 0), t))
        .child(this.column(words.slice(half), Math.max(side, 0), t)))
      .child(v_flex().flex_none().items_center().pb(22).gap(6)
      .child(h_flex().gap(12).items_baseline()
        .child(div().text_size(20).font_semibold().child(s.watchAt ? "Veel kijkplezier!" : "Tijd voor Nederlands"))
        .child(div().text_size(14).text_color(t.muted).child(`Je werk komt terug om ${clock((s.watchAt ?? now) + WATCH)} (nog ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}).`))
        .child(div().text_size(13).text_color(kept ? t.accent : t.dim).child(kept ? `Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"} achter elkaar` : "Vandaag begint een nieuwe reeks.")))
      .child(h_flex().gap(16).items_center()
        .child(this.button("dutch-again", "Open het Journaal opnieuw", t, () => { cover("news", this.words?.url ?? URL); }))
        .child(div().text_size(11).text_color(t.dim).child("Esc: over 5 minuten opnieuw (snooze)"))
        .child(this.button("dutch-skip", this.armed ? (kept ? `Zeker? Je reeks van ${streak} stopt. Klik nog een keer.` : "Zeker? Klik nog een keer.") : "Niet vandaag (skip)", t, (_e, cx) => {
          if (!this.armed) { this.armed = true; cx.notify(); return; }
          this.set({ skipped: true, streak: 0 });
          cover("stop");
          closeOverlay(props().overlay);
        }))));
  }
}
