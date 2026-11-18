import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, checking, run, shared, setShared, props, closeOverlay } from "herdr";

// The Morning start brief, as a dialog. The work itself (fast-forward master, start the
// dev stacks) is done by the dev-servers mod, which shares each step as "morning"; this
// dialog shows those steps and adds:
//   what changed since I stopped (my PRs merged, reviews asked of me by name, CI that is red)
//   today's meetings and duty
// Opened by the "Morning start" row in the sidebar, or by the forest sprite after the
// start ran by itself. "Run again" repeats the pull and the stacks; nothing is done twice.
const REPOS = [["floryn", "Platform"], ["ais", "AIS"]];
const OWNER = "floryndev";
// Written by the Claude Code mod `my-tickets` from the calendar, every 10 minutes.
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const GQL = `query($merged:String!,$review:String!,$open:String!){
  merged:search(query:$merged,type:ISSUE,first:20){nodes{... on PullRequest{number title url repository{name}}}}
  review:search(query:$review,type:ISSUE,first:20){nodes{... on PullRequest{number title url updatedAt repository{name}}}}
  open:search(query:$open,type:ISSUE,first:50){nodes{... on PullRequest{number title url repository{name} commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}}
  ${REPOS.map(([r]) => `${r}:repository(owner:"${OWNER}",name:"${r}"){object(expression:"master"){... on Commit{statusCheckRollup{state}}}}`).join("\n  ")}}`;
const RED = ["FAILURE", "ERROR"];
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export default class Morning extends View {
  init(_props, cx) {
    this.brief = null; this.briefError = null; this.meetings = []; this.duty = false; this.meetingsAt = null;
    if (checking()) return;
    const day = new Date().toDateString();
    // Seen: the sprite stops offering the brief.
    setShared("morning.seen", day);
    // Opened before today's start (from the palette): start now.
    if (shared("morning")?.day !== day) run("dev-servers.morning");
    this.loadBrief(cx);
    this.loadMeetings(cx);
  }

  loadBrief(cx) {
    cx.spawn(async (cx) => {
      try {
        // "since" comes with today's start.
        const day = new Date().toDateString();
        for (let i = 0; i < 20 && shared("morning")?.day !== day; i++) await cx.sleep(250);
        this.since = shared("morning")?.since ?? Date.now() - 86400000;
        const since = `${new Date(this.since).toISOString().slice(0, 19)}Z`;
        const g = await exec("gh", ["api", "graphql", "-f", `query=${GQL}`, "-f", `merged=is:pr is:merged author:@me merged:>=${since}`,
          "-f", "review=is:pr is:open user-review-requested:@me", "-f", "open=is:pr is:open author:@me"]);
        if (g.code !== 0) throw new Error((g.stderr || g.stdout).trim().slice(0, 200));
        const data = JSON.parse(g.stdout).data;
        const row = (pr, tag, color) => ({ id: `${pr.repository.name}#${pr.number}`, title: pr.title, url: pr.url, tag, color });
        this.brief = [
          ...data.merged.nodes.map((pr) => row(pr, "merged", "ansi2")),
          // The ones that moved since I stopped come first.
          ...[...data.review.nodes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((pr) => row(pr, new Date(pr.updatedAt).getTime() >= this.since ? "review asked · new activity" : "review asked", "blocked")),
          ...REPOS.filter(([r]) => RED.includes(data[r]?.object?.statusCheckRollup?.state))
            .map(([r, label]) => ({ id: `${r} master`, title: `CI is red on ${label} master`, url: `https://github.com/${OWNER}/${r}/commits/master`, tag: "CI failed", color: "ansi1" })),
          ...data.open.nodes.filter((pr) => RED.includes(pr.commits.nodes[0]?.commit.statusCheckRollup?.state)).map((pr) => row(pr, "CI failed", "ansi1")),
        ];
        this.briefError = null;
      } catch (e) { this.briefError = String(e); }
      cx.notify();
    });
  }

  loadMeetings(cx) {
    cx.spawn(async (cx) => {
      try {
        const cache = JSON.parse(await readTextFile(MEETINGS));
        this.meetings = cache.meetings ?? []; this.duty = Boolean(cache.duty); this.meetingsAt = cache.loadedAt;
      } catch { /* no calendar yet */ }
      cx.notify();
    });
  }

  heading(label, t) { return div().flex_none().mt(10).px(8).h(22).text_size(11).text_color(t.dim).child(label); }

  // A filled dot: done or true. Blinking: under way. Hollow: left alone.
  row(id, dot, label, text, t, url, tag) {
    return h_flex().id(id).flex_none().h(26).px(8).gap(8).items_center().rounded(6)
      .when(Boolean(url), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => { exec("open", [url]); }))
      .child(div().size(8).flex_none().rounded(4)
        .map((el) => (dot.hollow ? el.border(1.5).border_color(t.dim) : el.bg(t[dot.color])))
        .when(Boolean(dot.busy), (el) => el.loop("opacity", { from: 0.35, to: 1, period: 900 })))
      .child(div().w(96).flex_none().truncate().text_size(11).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).truncate().child(text))
      .when(Boolean(tag), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(tag)));
  }

  ready(t) {
    const stacks = shared("dev-servers.state") ?? {}, m = shared("morning") ?? {};
    const asked = Boolean(m.started);
    return [
      ...REPOS.map(([repo, label]) => {
        const p = m.pulled?.[repo];
        return this.row(`pull-${repo}`, !p ? { color: "ansi3", busy: true } : p.ok ? { color: "ansi2" } : p.failed ? { color: "ansi1" } : { hollow: true }, `${label} master`, p ? p.text : "pulling…", t);
      }),
      ...REPOS.map(([repo, label]) => {
        const s = stacks[repo] ?? { terminal: null, up: [] }, up = s.up.some(Boolean);
        return this.row(`stack-${repo}`, up ? { color: "ansi2" } : s.terminal || !asked ? { color: "ansi3", busy: true } : { hollow: true }, `${label} stack`,
          up ? (s.terminal ? "running" : "running, started outside Herdr") : s.terminal ? "starting… (its log: click the name in the sidebar)" : asked ? "not started" : "waits for master", t);
      }),
    ];
  }

  overnight(t) {
    if (this.briefError) return [div().px(8).py(4).text_size(11).text_color(t.ansi1).whitespace_normal().child(this.briefError)];
    if (!this.brief) return [div().px(8).py(4).text_size(11).text_color(t.dim).child("Asking GitHub…")];
    if (!this.brief.length) return [div().px(8).py(4).text_size(11).text_color(t.dim).child("Nothing: no PR of mine merged, no review asked of me, CI is green.")];
    return this.brief.map((x, i) => this.row(`brief-${i}`, { color: x.color }, x.id, x.title, t, x.url, x.tag));
  }

  today(t) {
    const now = Date.now(), list = this.meetings.filter((m) => sameDay(m.start, now));
    const note = !this.meetingsAt ? "No agenda yet: it arrives once a Claude Code session has synced it."
      : !sameDay(this.meetingsAt, now) ? "The agenda is from an earlier day: it refreshes once a Claude Code session has synced it."
      : list.length ? "" : "No meetings today.";
    return [
      ...(this.duty && !note.startsWith("The agenda is") ? [this.row("duty", { color: "blocked" }, "Support duty", "You are on support duty today", t)] : []),
      ...(note ? [div().px(8).py(4).text_size(11).text_color(t.dim).whitespace_normal().child(note)]
        : list.map((m, i) => this.row(`meet-${i}`, m.end <= now ? { hollow: true } : { color: m.start <= now ? "blocked" : "accent" }, `${clock(m.start)}–${clock(m.end)}`, m.title, t, m.end > now ? m.url : null, m.location || null))),
    ];
  }

  render() {
    const t = theme(), d = new Date(this.since ?? shared("morning")?.since ?? Date.now());
    const since = `Since ${DAYS[d.getDay()]} ${clock(d)}`, now = new Date(), busy = shared("morning")?.started === false;
    return v_flex().id("morning").size_full().min_h(0).bg(t.popover).text_color(t.foreground).text_size(13)
      .child(h_flex().h(46).flex_none().px(16).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(15).font_semibold().child("Good morning"))
        .child(div().flex_1().text_size(11).text_color(t.dim).child(`${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`))
        .when(!busy, (el) => el.child(div().id("morning-again").px(6).rounded(4).cursor_pointer().text_size(11).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { run("dev-servers.morning"); }).child("Run again")))
        .child(div().id("morning-close").px(6).rounded(4).cursor_pointer().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { closeOverlay(props().overlay); }).child("Esc")))
      .child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("morning-list").absolute().inset_0().overflow_y_scroll().px(8).pb(10)
          .child(this.heading("Getting ready", t)).children(this.ready(t))
          .child(this.heading(since, t)).children(this.overnight(t))
          .child(this.heading("Today", t)).children(this.today(t))));
  }
}
