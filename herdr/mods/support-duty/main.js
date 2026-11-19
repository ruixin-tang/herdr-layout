import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, run, spaces, checking } from "herdr";
import { ENVS, read, tell } from "./deploys.js";

// Support duty, in the right panel under My work: a header that folds, and
// under it what a duty day needs. The block sizes itself to fit (its id in the
// layout is BLOCK). "today" shows when my calendar has a support duty event
// (the Claude Code mod `my-tickets` writes that next to the meetings).
// Under the links, a row per environment: what is deployed, what waits, and a Deploy button
// that opens `bin/deploy` in a tab (it shows the commits and asks before it pushes). On a
// duty day, or while the block is open, it watches the deploys and says when one ends
// (deploys.js); a running one also shows in the header, so the block can stay folded.
const BLOCK = "support-duty";
const HEAD = 36, ROW = 30, DEPLOY = 44;
// How often GitHub is asked: QUIET normally, every TICK while a deploy runs or was just started here.
const TICK = 20000, QUIET = 120000, HOT = 1200000;
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const REPO = "floryn";
const SENTRY = "https://floryn.sentry.io/issues/?query=is%3Aunresolved&project=133656&project=5217905&project=6547650";
const CHECKLIST = "https://app.notion.com/p/1758fda35abb80b3b6eec28a38c92444";
// The release-testing skill's run sheet, at its list of all releases: a release an agent
// starts on shows up there.
const RELEASES = "https://claude.ai/artifact/KcNKtGCBkwU8tG194shCXr?sk=ZwiU7Su56x8auzbW9A1-ig#releases";
// A Claude Code tab in the platform on one of the support-duty skills.
const start = (name, task) => {
  const space = spaces().find((s) => s.name === REPO) ?? spaces().find((s) => s.active);
  run("tab.new", { name, space: space?.id, folder: `${home()}/${REPO}`, argv: ["claude"], task });
};
const ITEMS = [
  ["Triage Sentry", "Starts an agent on the sweep", () => start("Sentry triage", "I am on support duty. Use the sentry-triaging skill to sweep the unresolved Sentry issues.")],
  ["Dev support request", "Starts an agent, then paste the request", () => start("Dev support", "I am on support duty. Use the dev-support-triaging skill. First ask me to paste the #dev-support request, then wait.")],
  ["Release testing", "Starts an agent, then give it the release issue", () => start("Release testing", "I am on support duty. Use the release-testing skill. First ask me for the release issue, then wait.")],
  ["Release run sheet", "Opens the list of all releases", () => { exec("open", [RELEASES]); }],
  ["Unresolved in Sentry", "Opens the browser", () => { exec("open", [SENTRY]); }],
  ["Checklist", "Opens Notion", () => { exec("open", [CHECKLIST]); }],
];

const two = (n) => String(n).padStart(2, "0");
const clock = (ms) => { const d = new Date(ms), day = d.toDateString() === new Date().toDateString(); return `${day ? "" : `${d.getDate()}/${d.getMonth() + 1} `}${two(d.getHours())}:${two(d.getMinutes())}`; };
const running = (d) => d.state === "deploying" || (d.state === "waiting" && Date.now() - d.pushed < HOT);
const says = (d) => d.state === "deploying" ? `deploying, ${Math.max(0, Math.round((Date.now() - d.pushed) / 60000))} min`
  : d.state === "waiting" ? (running(d) ? "waiting for CircleCI" : `pushed ${clock(d.pushed)}, no deploy seen`)
  : `${d.state} ${clock(d.at)}`;

export default class SupportDuty extends View {
  init(_props, cx) {
    this.open = localStorage.getItem("open") === "true"; this.today = false;
    this.deploys = {}; this.asked = 0; this.hot = 0;
    if (checking()) return;
    this.fit();
    this.load(cx);
    cx.timer.every(600000, (cx) => this.load(cx));
    cx.timer.every(TICK, (cx) => this.watch(cx));
  }

  watch(cx) {
    if (!this.today && !this.open) return;
    const now = Date.now(), busy = now < this.hot || Object.values(this.deploys).some(running);
    if (now - this.asked < (busy ? TICK : QUIET) - 1000) return;
    this.asked = now;
    cx.spawn(async (cx) => {
      for (const env of ENVS) {
        try { const d = await read(env); this.deploys[env.id] = d; tell(env, d); } catch { /* GitHub did not answer: keep what was there */ }
      }
      cx.notify();
    });
  }

  deploy(env) {
    const space = spaces().find((s) => s.name === REPO) ?? spaces().find((s) => s.active);
    run("tab.new", { name: `Deploy ${env.id}`, space: space?.id, folder: `${home()}/${REPO}`, argv: ["bin/deploy", env.id] });
    this.hot = Date.now() + HOT;
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try { this.today = Boolean(JSON.parse(await readTextFile(MEETINGS)).duty); } catch { /* no calendar yet */ }
      this.watch(cx);
      cx.notify();
    });
  }

  fit() { run("layout.resize", { id: BLOCK, px: HEAD + (this.open ? ITEMS.length * ROW + 8 + ENVS.length * DEPLOY + 9 : 0) }); }

  deployRow(env, t) {
    const d = this.deploys[env.id], busy = d && running(d);
    const dot = !d ? t.dim : d.state === "deployed" ? t.done : d.state === "failed" ? t.blocked : busy ? t.working : t.dim;
    return h_flex().h(DEPLOY).flex_none().px(8).gap(8).items_center()
      .child(div().size(8).rounded(4).flex_none().bg(dot).when(busy, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1200 })))
      .child(v_flex().id(`deploy-ci-${env.id}`).flex_1().min_w(0).cursor_pointer().on_click(() => { if (d) exec("open", [d.url]); })
        .child(h_flex().gap(6).child(div().child(env.name)).child(div().text_size(11).text_color(t.dim).child(d?.sha ?? "")))
        .child(div().truncate().text_size(11).text_color(d?.state === "failed" ? t.blocked : t.dim)
          .child(!d ? "checking..." : `${says(d)}${d.ahead && !busy ? `, ${d.ahead} on ${env.from} to go` : ""}`)))
      .when(d && d.ahead > 0 && !busy, (el) => el.child(div().id(`deploy-${env.id}`).flex_none().px(8).py(3).rounded(6).border_1().border_color(t.accent).text_size(11).text_color(t.accent).cursor_pointer()
        .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.deploy(env); cx.notify(); }).child(`Deploy ${d.ahead}`)));
  }

  render() {
    const t = theme(), live = ENVS.find((e) => this.deploys[e.id] && running(this.deploys[e.id]));
    return v_flex().id("support-duty").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().id("duty-head").h(HEAD - 2).flex_none().px(14).gap(8).items_center().cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.open = !this.open; localStorage.setItem("open", String(this.open)); this.fit(); this.watch(cx); cx.notify(); })
        .child(svg(`mods/workspace-chrome/chevron-${this.open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim))
        .child(div().font_semibold().child("Support duty"))
        .when(this.today, (el) => el.child(div().px(5).py(1).rounded(4).border_1().border_color(t.blocked).text_size(10).text_color(t.blocked).child("today")))
        .child(div().flex_1())
        .when(!this.open && live, (el) => el.child(div().flex_none().text_size(11).text_color(t.working).child(`${live.name} ${says(this.deploys[live.id])}`))))
      .when(this.open, (el) => el.child(v_flex().px(8).pb(8).border_t(1).border_color(t.border).children(ITEMS.map(([label, hint, go], i) =>
        h_flex().id(`duty-${i}`).h(ROW).flex_none().px(8).gap(8).items_center().rounded(8).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => { go(); })
          .child(div().flex_none().text_color(t.accent).child(label))
          .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(hint))))
        .child(div().h(1).flex_none().my(4).bg(t.border))
        .children(ENVS.map((env) => this.deployRow(env, t)))));
  }
}
