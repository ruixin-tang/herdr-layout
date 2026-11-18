import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, checking, run, shared } from "herdr";

// Today's meetings, under the right panel. They come from a cache the Claude
// Code mod `my-tickets` keeps fresh (it can reach the calendar; this can't).
// In the compact layout (shared "compact", on the laptop screen) it is one line: what is
// on now or comes next. The block sizes itself (its id in the layout is BLOCK).
const BLOCK = "agenda", FULL = 230, LINE = 36;
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
// Why the last calendar sync failed, when it did (written by the same mod).
const FAILED = `${home()}/.cache/my-work/meetings.error.json`;
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export default class Agenda extends View {
  init(_props, cx) {
    this.meetings = []; this.at = null;
    if (checking()) return;
    this.load(cx);
    cx.timer.every(60000, (cx) => this.load(cx));
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try {
        const cache = JSON.parse(await readTextFile(MEETINGS));
        this.meetings = cache.meetings ?? []; this.at = cache.loadedAt;
      } catch { /* a half-written cache: the next read gets it */ }
      try { this.failed = JSON.parse(await readTextFile(FAILED)); } catch { this.failed = null; }
      cx.notify();
    });
  }

  row(m, now, t) {
    const over = m.end <= now, on = m.start <= now && now < m.end;
    const c = over ? t.dim : on ? t.blocked : t.muted;
    return h_flex().flex_none().px(8).py(4).gap(8).items_center().rounded(8).hover((s) => s.bg(t.hover))
      .child(div().size(8).flex_none().rounded(4).when(on, (el) => el.bg(c)).when(!on, (el) => el.border(1.5).border_color(c)))
      .child(div().w(78).flex_none().text_size(11).text_color(c).child(`${clock(m.start)}–${clock(m.end)}`))
      .child(div().flex_1().min_w(0).truncate().text_color(over ? t.dim : t.foreground).child(m.title))
      // Where it is: the booked room, or the location typed into the event.
      .when(Boolean(m.location), (el) => el.child(div().flex_none().max_w(110).truncate().text_size(11).text_color(t.dim).child(m.location)))
      .when(Boolean(m.url) && !over, (el) => el.child(div().id(`join-${m.start}-${m.title}`).px(4).rounded(4).flex_none().cursor_pointer().text_size(11).text_color(t.accent)
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => { exec("open", [m.url]); }).child("Join")));
  }

  render() {
    const t = theme(), now = Date.now(), compact = Boolean(shared("compact"));
    if (compact !== this.compact) { this.compact = compact; if (!checking()) run("layout.resize", { id: BLOCK, px: compact ? LINE : FULL }); }
    const today = this.meetings.filter((m) => sameDay(m.start, now));
    const left = today.filter((m) => m.end > now).length;
    const note = !this.at ? "No agenda yet: it arrives once a Claude Code session has synced it."
      : !sameDay(this.at, now) ? "The agenda is from an earlier day: it refreshes once a Claude Code session has synced it."
      : today.length ? "" : "Nothing on the calendar today.";
    return v_flex().id("agenda").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(compact ? LINE - 2 : 36).flex_none().px(14).gap(8).items_center().when(!compact, (el) => el.border_b(1).border_color(t.border))
        .child(div().font_semibold().child("Today"))
        .when(!compact, (el) => el.child(div().flex_none().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${left} to go`)))
        .when(compact, (el) => { const m = today.find((x) => x.end > now); return m ? el.child(this.row(m, now, t).flex_1().min_w(0)) : el; })
        .when(!compact, (el) => el.child(div().flex_1()))
        .when(Boolean(this.failed?.error) && this.failed.at > (this.at ?? 0), (el) => el.child(div().id("agenda-failed").text_size(10.5).text_color(t.ansi1).tooltip(this.failed.error).child("sync failed")))
        .when(!compact, (el) => el.child(div().text_size(10.5).text_color(t.dim).child(this.at ? clock(this.at) : ""))))
      .when(!compact, (el) => el.child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("agenda-list").absolute().inset_0().overflow_y_scroll().px(8).py(6)
          .children(note ? [] : today.map((m) => this.row(m, now, t)))
          .when(Boolean(note), (e) => e.child(div().p(8).text_size(11).text_color(t.dim).child(note))))));
  }
}
