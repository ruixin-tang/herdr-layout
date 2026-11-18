import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, checking, shared, setShared, props, closeOverlay, notify } from "herdr";

// The Dutch lesson, as a dialog over the whole window: every day my calendar has a
// "Dutch" event, the forest sprite opens this when it starts, and it stays in the way
// until I have watched the NOS Journaal in Makkelijke Taal.
//   by itself       when the sprite opens it (props.auto) the Journaal opens in the browser
//                   at once: nothing to click. WATCH minutes later the day counts as done,
//                   the streak grows and the workspace comes back
//   "Kijk nu"       the same by hand, when I opened the dialog myself
//   Esc             only snoozes: the sprite opens it again a few minutes later
//   "Niet vandaag"  asks twice, then lets me go and ends the streak
// The state is shared as "dutch": { day, openedAt, closedAt, watchAt, done, skipped, streak, last }.
const URL = "https://npo.nl/start/serie/nos-journaal-in-makkelijke-taal/afleveringen";
const WATCH = 8 * 60000;
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
// The working day before a day, as a date string: a streak runs over the weekend.
const before = (day) => { const d = new Date(day); do d.setDate(d.getDate() - 1); while (d.getDay() % 6 === 0); return d.toDateString(); };

export default class Dutch extends View {
  init(given, cx) {
    this.armed = false;
    if (checking()) return;
    const day = new Date().toDateString(), was = shared("dutch") ?? {};
    // A new day starts clean; the streak and its last day come along.
    this.set(was.day === day ? { openedAt: Date.now() } : { day, openedAt: Date.now(), closedAt: 0, watchAt: null, done: false, skipped: false });
    if (given?.auto && !shared("dutch")?.watchAt) { exec("open", [URL]); this.set({ watchAt: Date.now() }); }
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
    notify({ title: "Goed gedaan!", body: `Journaal gekeken. Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}.`, level: "success", timeout: 8000 });
    closeOverlay(props().overlay);
  }

  // Esc, or anything else that closes it: the sprite reads this as a snooze.
  async close() { this.set({ closedAt: Date.now() }); }

  button(id, label, t, fn, strong) {
    return div().id(id).px(strong ? 28 : 10).py(strong ? 12 : 4).rounded(8).cursor_pointer().flex_none()
      .map((el) => (strong ? el.bg(t.solid).text_color(t.solid_foreground).text_size(18).font_semibold().hover((s) => s.opacity(0.85)) : el.text_size(11).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))))
      .on_click(fn).child(label);
  }

  render() {
    const t = theme(), s = shared("dutch") ?? {}, streak = s.streak ?? 0, now = Date.now();
    const kept = streak > 0 && (s.last === new Date().toDateString() || s.last === before(new Date().toDateString()));
    const left = s.watchAt ? Math.max(0, WATCH - (now - s.watchAt)) : 0;
    return v_flex().id("dutch").size_full().items_center().justify_center().gap(14).bg(t.popover).text_color(t.foreground)
      .child(div().text_size(13).text_color(t.muted).child("NOS Journaal in Makkelijke Taal"))
      .child(div().text_size(40).font_semibold().child(s.watchAt ? "Veel kijkplezier!" : "Tijd voor Nederlands"))
      .child(div().text_size(14).text_color(t.muted).child(s.watchAt
        ? `Je werk komt terug om ${clock(s.watchAt + WATCH)} (nog ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}).`
        : "Eerst het nieuws van vandaag, ongeveer 8 minuten. Daarna mag je verder werken."))
      .child(div().h(8))
      .when(!s.watchAt, (el) => el.child(this.button("dutch-watch", "Kijk nu", t, () => { exec("open", [URL]); this.set({ watchAt: Date.now() }); }, true)))
      .when(Boolean(s.watchAt), (el) => el.child(this.button("dutch-again", "Open het Journaal opnieuw", t, () => { exec("open", [URL]); })))
      .child(div().h(8))
      .child(div().text_size(13).text_color(kept ? t.accent : t.dim).child(kept ? `Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"} achter elkaar` : "Vandaag begint een nieuwe reeks."))
      .child(h_flex().gap(16).items_center().mt(18)
        .child(div().text_size(11).text_color(t.dim).child("Esc: over 5 minuten opnieuw (snooze)"))
        .child(this.button("dutch-skip", this.armed ? (kept ? `Zeker? Je reeks van ${streak} stopt. Klik nog een keer.` : "Zeker? Klik nog een keer.") : "Niet vandaag (skip)", t, (_e, cx) => {
          if (!this.armed) { this.armed = true; cx.notify(); return; }
          this.set({ skipped: true, streak: 0 });
          closeOverlay(props().overlay);
        })));
  }
}
