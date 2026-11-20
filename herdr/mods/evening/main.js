import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, checking, shared, props, closeOverlay } from "herdr";

// "Conclude my day", as a dialog: what I did today. It only reads, nothing is stopped or saved.
//   my PRs merged today, my PRs opened today, the reviews I gave today (GitHub)
//   the tickets I finished today (the cache the Claude Code mod `my-tickets` writes)
//   the glasses of water counted today (the mountain's water bar), whether the Dutch lesson is done
// Opened by the "Conclude my day" button in the sidebar, beside "Morning start".
const TICKETS = `${home()}/.cache/my-work/tickets.json`;
const PR = "number title url repository{name}";
const GQL = `query($merged:String!,$opened:String!,$reviewed:String!){
  viewer{login}
  merged:search(query:$merged,type:ISSUE,first:30){nodes{... on PullRequest{${PR}}}}
  opened:search(query:$opened,type:ISSUE,first:30){nodes{... on PullRequest{${PR} isDraft state}}}
  reviewed:search(query:$reviewed,type:ISSUE,first:30){nodes{... on PullRequest{${PR} reviews(last:40){nodes{author{login} submittedAt state}}}}}}`;
const VERDICT = { APPROVED: "approved", CHANGES_REQUESTED: "changes asked", COMMENTED: "commented" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Today, from midnight here.
const midnight = () => new Date(new Date().toDateString()).getTime();

export default class Evening extends View {
  init(_props, cx) {
    this.github = null; this.githubError = null; this.tickets = null;
    if (checking()) return;
    this.loadGithub(cx);
    this.loadTickets(cx);
  }

  loadGithub(cx) {
    cx.spawn(async (cx) => {
      try {
        const from = midnight(), since = `${new Date(from).toISOString().slice(0, 19)}Z`;
        const g = await exec("gh", ["api", "graphql", "-f", `query=${GQL}`, "-f", `merged=is:pr is:merged author:@me merged:>=${since}`,
          "-f", `opened=is:pr author:@me created:>=${since}`, "-f", `reviewed=is:pr reviewed-by:@me -author:@me updated:>=${since}`]);
        if (g.code !== 0) throw new Error((g.stderr || g.stdout).trim().slice(0, 200));
        const data = JSON.parse(g.stdout).data, me = data.viewer.login;
        const row = (pr, tag, color) => ({ id: `${pr.repository.name}#${pr.number}`, title: pr.title, url: pr.url, tag, color });
        const merged = data.merged.nodes.map((pr) => row(pr, "merged", "ansi2")), done = new Set(merged.map((x) => x.id));
        this.github = {
          merged,
          // One that was opened and merged today counts as merged.
          opened: data.opened.nodes.map((pr) => row(pr, pr.state === "CLOSED" ? "closed" : pr.isDraft ? "draft" : "open", "accent")).filter((x) => !done.has(x.id)),
          // GitHub finds the PRs I ever reviewed that moved today; my own review has to be from today too.
          reviewed: data.reviewed.nodes.flatMap((pr) => {
            const mine = pr.reviews.nodes.filter((r) => r.author?.login === me && new Date(r.submittedAt).getTime() >= from);
            return mine.length ? [row(pr, VERDICT[mine.find((r) => r.state !== "COMMENTED")?.state ?? "COMMENTED"] ?? "reviewed", "ansi5")] : [];
          }),
        };
        this.githubError = null;
      } catch (e) { this.githubError = String(e); }
      cx.notify();
    });
  }

  loadTickets(cx) {
    cx.spawn(async (cx) => {
      try { this.tickets = (JSON.parse(await readTextFile(TICKETS)).done ?? []).filter((x) => x.at >= midnight()); } catch { this.tickets = []; }
      cx.notify();
    });
  }

  heading(label, t) { return div().flex_none().mt(10).px(8).h(22).text_size(11).text_color(t.dim).child(label); }
  note(text, t, color) { return div().px(8).py(4).text_size(11).text_color(color ?? t.dim).whitespace_normal().child(text); }

  row(id, color, label, text, t, url, tag) {
    return h_flex().id(id).flex_none().h(26).px(8).gap(8).items_center().rounded(6)
      .when(Boolean(url), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => { exec("open", [url]); }))
      .child(div().size(8).flex_none().rounded(4).bg(t[color]))
      .child(div().w(96).flex_none().truncate().text_size(11).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).truncate().child(text))
      .when(Boolean(tag), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(tag)));
  }

  section(key, label, empty, t) {
    if (this.githubError) return [];
    const list = this.github?.[key];
    return [this.heading(label, t), ...(!list ? [this.note("Asking GitHub…", t)] : !list.length ? [this.note(empty, t)]
      : list.map((x, i) => this.row(`${key}-${i}`, x.color, x.id, x.title, t, x.url, x.tag)))];
  }

  render() {
    const t = theme(), now = new Date(), g = this.github, dutch = shared("dutch") ?? {}, lesson = dutch.day === now.toDateString();
    const water = shared("water")?.day === now.toDateString() ? shared("water") : {};
    const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const sum = g && this.tickets ? [count(g.merged.length, "PR merged", "PRs merged"), count(g.opened.length, "opened", "opened"),
      count(g.reviewed.length, "review", "reviews"), count(this.tickets.length, "ticket done", "tickets done")].join(" · ") : "";
    return v_flex().id("evening").size_full().min_h(0).bg(t.popover).text_color(t.foreground).text_size(13)
      .child(h_flex().h(46).flex_none().px(16).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(15).font_semibold().child("That was today"))
        .child(div().flex_1().text_size(11).text_color(t.dim).child(`${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`))
        .child(div().id("evening-close").px(6).rounded(4).cursor_pointer().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { closeOverlay(props().overlay); }).child("Esc")))
      .child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("evening-list").absolute().inset_0().overflow_y_scroll().px(8).pb(10)
          .when(Boolean(sum), (el) => el.child(div().px(8).pt(12).text_color(t.muted).child(sum)))
          .when(Boolean(this.githubError), (el) => el.child(this.heading("GitHub", t)).child(this.note(this.githubError, t, t.ansi1)))
          .children(this.section("merged", "Merged today", "No PR of mine merged today.", t))
          .children(this.section("opened", "Opened today", "No new PR today.", t))
          .children(this.section("reviewed", "Reviews I gave", "No review today.", t))
          .child(this.heading("Tickets done", t))
          .children(!this.tickets ? [this.note("Reading…", t)] : !this.tickets.length ? [this.note("No ticket finished today.", t)]
            : this.tickets.map((x, i) => this.row(`ticket-${i}`, "ansi2", `#${x.id}`, x.title, t)))
          .child(this.heading("Water", t))
          .child(water.glasses ? this.row("water", "accent", "Glasses", `${water.glasses} of 8 today`, t) : this.note("No glass counted today.", t))
          .child(this.heading("Dutch", t))
          .child(lesson && dutch.done ? this.row("dutch", "ansi2", "Journaal", `Watched. Streak: ${count(dutch.streak ?? 1, "day", "days")}`, t)
            : this.note(lesson && dutch.skipped ? "Skipped today." : "Not watched today.", t))));
  }
}
