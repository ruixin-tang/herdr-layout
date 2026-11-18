import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, run, spaces, checking } from "herdr";

// Support duty, in the right panel under My work: a header that folds, and
// under it what a duty day needs. The block sizes itself to fit (its id in the
// layout is BLOCK). "today" shows when my calendar has a support duty event
// (the Claude Code mod `my-tickets` writes that next to the meetings).
const BLOCK = "support-duty";
const HEAD = 36, ROW = 30;
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const REPO = "floryn";
const SENTRY = "https://floryn.sentry.io/issues/?query=is%3Aunresolved&project=133656&project=5217905&project=6547650";
const CHECKLIST = "https://app.notion.com/p/1758fda35abb80b3b6eec28a38c92444";
// How /release-testing was used on a real deploy duty (18 November 2026).
const RELEASE_EXAMPLE = "https://claude.ai/artifact/KcNKtGCBkwU8tG194shCXr?sk=ZwiU7Su56x8auzbW9A1-ig#24272";
// A Claude Code tab in the platform on one of the support-duty skills.
const start = (name, task) => {
  const space = spaces().find((s) => s.name === REPO) ?? spaces().find((s) => s.active);
  run("tab.new", { name, space: space?.id, folder: `${home()}/${REPO}`, argv: ["claude"], task });
};
const ITEMS = [
  ["Triage Sentry", "Starts an agent on the sweep", () => start("Sentry triage", "I am on support duty. Use the sentry-triaging skill to sweep the unresolved Sentry issues.")],
  ["Dev support request", "Starts an agent, then paste the request", () => start("Dev support", "I am on support duty. Use the dev-support-triaging skill. First ask me to paste the #dev-support request, then wait.")],
  ["Release testing", "Starts an agent on the deploy's test instructions", () => start("Release testing", "I am on deploy duty. Use the release-testing skill to take me through the deploy and its test instructions. If that skill is not installed here, say so and stop.")],
  ["Release testing example", "Opens the browser", () => { exec("open", [RELEASE_EXAMPLE]); }],
  ["Unresolved in Sentry", "Opens the browser", () => { exec("open", [SENTRY]); }],
  ["Checklist", "Opens Notion", () => { exec("open", [CHECKLIST]); }],
];

export default class SupportDuty extends View {
  init(_props, cx) {
    this.open = localStorage.getItem("open") === "true"; this.today = false;
    if (checking()) return;
    this.fit();
    this.load(cx);
    cx.timer.every(600000, (cx) => this.load(cx));
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try { this.today = Boolean(JSON.parse(await readTextFile(MEETINGS)).duty); } catch { /* no calendar yet */ }
      cx.notify();
    });
  }

  fit() { run("layout.resize", { id: BLOCK, px: HEAD + (this.open ? ITEMS.length * ROW + 8 : 0) }); }

  render() {
    const t = theme();
    return v_flex().id("support-duty").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().id("duty-head").h(HEAD - 2).flex_none().px(14).gap(8).items_center().cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.open = !this.open; localStorage.setItem("open", String(this.open)); this.fit(); cx.notify(); })
        .child(svg(`mods/workspace-chrome/chevron-${this.open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim))
        .child(div().font_semibold().child("Support duty"))
        .when(this.today, (el) => el.child(div().px(5).py(1).rounded(4).border_1().border_color(t.blocked).text_size(10).text_color(t.blocked).child("today"))))
      .when(this.open, (el) => el.child(v_flex().px(8).pb(8).border_t(1).border_color(t.border).children(ITEMS.map(([label, hint, go], i) =>
        h_flex().id(`duty-${i}`).h(ROW).flex_none().px(8).gap(8).items_center().rounded(8).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => { go(); })
          .child(div().flex_none().text_color(t.accent).child(label))
          .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(hint))))));
  }
}
