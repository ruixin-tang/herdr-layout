import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, home, checking, agents, run, shared, setShared, spaces } from "herdr";

// Tickets come from a cache the Claude Code mod `my-tickets` keeps fresh
// (it can reach Notion; this panel can't). PRs come straight from gh.
// A ticket's title is not a link: agents read the ticket from the cached url.
const CACHE = `${home()}/.cache/my-work/tickets.json`;
// A click on Refresh writes its time here; a Claude Code session that sees it (my-tickets looks
// every 15 seconds) fetches the tickets from Notion at once. ASK_MS: how long I wait for that.
const REQUEST = `${home()}/.cache/my-work/refresh.json`, ASK_MS = 60000;
const ROLE = { owner: "Owner", reviewer: "Reviewer", pairbuddy: "Pairbuddy" };
const SECTIONS = [["action", "Requires my action"], ["waiting", "Waiting for others"], ["team", "Asked of the whole team"], ["shipped", "Shipped"]];
const PR_FIELDS = "--json=number,title,url,isDraft,state,repository";
// Where a picked-up ticket starts: the repo of its PR, else the platform.
const REPOS = ["floryn", "ais"];
// A ticket without a PR starts in the platform; a PR in a repo I have no checkout of starts nowhere.
// My open PRs with their CI state, and my PRs merged in the last days, in one call.
// For the open ones also the branch, and each review thread's state and last comment (whose turn it is).
const GQL = `query($open:String!,$merged:String!){
  viewer{login}
  open:search(query:$open,type:ISSUE,first:50){nodes{... on PullRequest{url headRefName commits(last:1){nodes{commit{statusCheckRollup{state}}}}
    reviewThreads(first:60){nodes{isResolved comments(last:1){nodes{url author{login}}}}}}}}
  merged:search(query:$merged,type:ISSUE,first:20){nodes{... on PullRequest{url number title headRefName bodyText repository{name owner{login}} mergeCommit{oid} labels(first:10){nodes{name}}}}}}`;
// Every worktree of both repos, as "path<tab>branch" lines.
const TREES = REPOS.map((r) => `git -C "$HOME/${r}" worktree list --porcelain 2>/dev/null | awk '/^worktree /{p=$2} /^branch /{sub("refs/heads/","",$2); print p "\t" $2}'`).join("; ");
const SHIPPED_DAYS = 3;
const CI = { SUCCESS: ["ansi2", "CI passed"], FAILURE: ["ansi1", "CI failed"], ERROR: ["ansi1", "CI failed"], PENDING: ["ansi3", "CI running"], EXPECTED: ["ansi3", "CI running"] };
// The last recap Claude Code printed in a terminal ("※ recap: ..." up to the next blank line).
function recapIn(text) {
  const lines = text.split("\n");
  const at = lines.findLastIndex((l) => /^\s*\S? ?recap: /.test(l));
  if (at < 0) return null;
  // It ends at its own "(disable recaps in /config)", else at a blank line, a rule or the prompt.
  const end = lines.findIndex((l, i) => i > at && (!l.trim() || /^\s*[─❯]/.test(l)));
  return lines.slice(at, end < 0 ? at + 6 : end).map((l) => l.trim()).join(" ")
    .replace(/^\S? ?recap: /, "").replace(/\s*\(disable recaps in \/config\)[\s\S]*$/, "").slice(0, 600);
}
const stored = (key) => { try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; } };
const repoOf = (item) => REPOS.find((r) => (item.pr?.id ?? item.id).startsWith(`${r}#`)) ?? (item.ticket ? REPOS[0] : null);
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
const prId = (pr) => `${pr.repository.name}#${pr.number}`;

// Whose move it is. The owner works until Review, the reviewer works in Review,
// a pairbuddy follows the owner.
const ticketSide = (x) => (x.role === "owner" ? x.status !== "Review" : x.role === "reviewer" && x.status === "Review") ? "action" : "waiting";

// The agent working on a row: its title names the ticket or the PR number, or
// shares two real words with the row's title.
const WORDS = (text) => new Set((text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) ?? []).filter((w) => !["with", "from", "when", "into", "that", "this", "floryn"].includes(w)));
function agentFor(item, list) {
  let best = null, score = 1;
  for (const a of list) {
    const title = `${a.title} ${a.tab_name}`.toLowerCase();
    if (item.keys.some((k) => new RegExp(`(^|[^a-z0-9])${k}([^0-9]|$)`).test(title))) return a;
    const words = WORDS(title);
    const n = [...WORDS(item.title)].filter((w) => words.has(w)).length;
    if (n > score) { best = a; score = n; }
  }
  return best;
}

export default class MyWork extends View {
  init(_props, cx) {
    this.tab = "tickets"; this.tickets = []; this.ticketsAt = null; this.prs = []; this.prsAt = null; this.prsError = null;
    this.folded = {}; this.ticketPrs = {}; this.ci = {};
    // Per PR url: its branch and the review threads waiting for my answer; per branch: its worktree; per merged PR url: where it is.
    this.pull = {}; this.trees = {}; this.shipped = {}; this.recaps = []; this.recapAt = null;
    // Merged PRs known to be on production, and the ones whose deploy instructions I ticked off.
    this.live = stored("live") ?? {}; this.deployDone = stored("deployDone") ?? [];
    if (checking()) return;
    this.loadTickets(cx); this.loadPrs(cx);
    cx.timer.every(60000, (cx) => this.loadTickets(cx));
    cx.timer.every(300000, (cx) => this.loadPrs(cx));
  }

  // The Refresh button: the PRs again from gh, and the tickets asked for from Notion. Until the
  // cache is newer than the click the header says so; with no session listening it says that.
  refresh(cx) {
    this.loadPrs(cx);
    if (this.asking) return;
    const at = Date.now();
    this.asking = at; this.unanswered = false;
    cx.spawn(async (cx) => {
      await exec("sh", ["-c", 'printf \'{"at":%s}\' "$2" > "$1"', "sh", REQUEST, String(at)]).catch(() => null);
      while (Date.now() - at < ASK_MS) {
        await cx.sleep(2000);
        try { if (JSON.parse(await readTextFile(CACHE)).loadedAt >= at) break; } catch { /* half-written: the next look */ }
      }
      this.asking = null; this.loadTickets(cx);
      try { this.unanswered = !(JSON.parse(await readTextFile(CACHE)).loadedAt >= at); } catch { this.unanswered = true; }
      cx.notify();
    });
    cx.notify();
  }

  // How much is waiting on me, for other mods (the forest sprite); set only when it changes.
  publish() {
    const n = this.tickets.filter((x) => ticketSide(x) === "action").length + this.prs.filter((x) => x.side === "action").length;
    if (shared("my-work.action") !== n) setShared("my-work.action", n);
  }

  loadTickets(cx) {
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(CACHE);
        if (!text) return;
        const cache = JSON.parse(text);
        const fresh = cache.tickets.some((x) => !(x.id in this.ticketPrs));
        this.tickets = cache.tickets; this.ticketsAt = cache.loadedAt; this.publish();
        // A ticket that moved to Done since the last look: the Korok cheers.
        const seen = Number(localStorage.getItem("doneSeen") ?? 0);
        const done = (cache.done ?? []).filter((d) => d.at > seen);
        if (done.length) {
          localStorage.setItem("doneSeen", String(Math.max(...done.map((d) => d.at))));
          this.cheer(done.length > 1 ? `${done.length} tickets done` : `DIL-${done[0].id} done`);
        }
        cx.notify();
        if (fresh) this.loadTicketPrs(cx);
      } catch { /* a half-written cache: the next read gets it */ }
    });
  }

  cheer(text) { setShared("korok.cheer", { text, at: Date.now() }); }

  // Is a merged PR on production: its merge commit is in the production branch
  // and that branch's last deploy went through. Remembered once true.
  async isLive(pr) {
    if (this.live[pr.url]) return true;
    const repo = `repos/${pr.repository.owner.login}/${pr.repository.name}`;
    const has = await exec("gh", ["api", `${repo}/compare/${pr.mergeCommit.oid}...production`, "--jq", ".status"]);
    if (has.code !== 0 || !["ahead", "identical"].includes(has.stdout.trim())) return false;
    const deploy = await exec("gh", ["api", `${repo}/commits/production/status`, "--jq", '[.statuses[] | select(.context | test("build-and-deploy")) | .state] | first // "none"']);
    if (deploy.code !== 0 || !["success", "none"].includes(deploy.stdout.trim())) return false;
    this.live[pr.url] = true; localStorage.setItem("live", JSON.stringify(this.live));
    return true;
  }

  async gh(args) {
    const r = await exec("gh", ["search", "prs", ...args, PR_FIELDS]);
    if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().slice(0, 200));
    return JSON.parse(r.stdout);
  }

  // A ticket's PR is the one whose title names it ("[DIL-1307] ..."): the open one, else the newest.
  loadTicketPrs(cx) {
    if (this.loadingTicketPrs) return;
    this.loadingTicketPrs = true;
    cx.spawn(async (cx) => {
      try {
        for (const x of this.tickets) {
          const found = (await this.gh([`DIL-${x.id}`, "--match=title", "--owner=floryndev", "--limit=5"]))
            .filter((pr) => new RegExp(`DIL-${x.id}(\\D|$)`, "i").test(pr.title));
          const pr = found.find((p) => p.state === "open") ?? found[0];
          this.ticketPrs[x.id] = pr ? { id: prId(pr), number: pr.number, url: pr.url, note: pr.isDraft ? "draft" : pr.state === "open" ? "" : pr.state } : null;
        }
      } catch { /* shown without PR links until the next round */ }
      finally { this.loadingTicketPrs = false; cx.notify(); }
    });
  }

  loadPrs(cx) {
    this.loadTicketPrs(cx);
    if (this.loadingPrs) return;
    this.loadingPrs = true;
    cx.spawn(async (cx) => {
      try {
        const mine = ["--author=@me", "--state=open", "--limit=50"];
        const [authored, approved, changes, review] = [await this.gh(mine), await this.gh([...mine, "--review=approved"]),
          await this.gh([...mine, "--review=changes_requested"]), await this.gh(["--review-requested=@me", "--state=open", "--limit=50"])];
        // Asked of me by name; the rest of the review requests go to a team I am in.
        const direct = await this.gh(["user-review-requested:@me", "--state=open", "--limit=50"]);
        const has = (list, pr) => list.some((p) => p.url === pr.url);
        const since = new Date(Date.now() - SHIPPED_DAYS * 86400000).toISOString().slice(0, 10);
        const g = await exec("gh", ["api", "graphql", "-f", `query=${GQL}`, "-f", "open=is:pr is:open author:@me", "-f", `merged=is:pr is:merged author:@me merged:>=${since}`]);
        const data = g.code === 0 ? JSON.parse(g.stdout).data : { open: { nodes: [] }, merged: { nodes: [] } };
        this.ci = Object.fromEntries(data.open.nodes.map((n) => [n.url, n.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null]));
        // A thread waits for me when it is open and someone else spoke last.
        const me = data.viewer?.login;
        this.pull = Object.fromEntries([...data.open.nodes, ...data.merged.nodes].map((n) => {
          const waiting = (n.reviewThreads?.nodes ?? []).filter((th) => !th.isResolved && th.comments.nodes[0] && th.comments.nodes[0].author?.login !== me);
          return [n.url, { branch: n.headRefName, waiting: waiting.length, first: waiting[0]?.comments.nodes[0].url ?? null }];
        }));
        const trees = await exec("sh", ["-c", TREES]).catch(() => null);
        this.trees = Object.fromEntries((trees?.stdout ?? "").trim().split("\n").filter(Boolean).map((line) => line.split("\t").reverse()));
        const failed = (pr) => ["FAILURE", "ERROR"].includes(this.ci[pr.url]);
        const asked = (pr) => this.pull[pr.url]?.waiting ?? 0;
        const merged = [];
        for (const pr of data.merged.nodes) {
          const live = await this.isLive(pr);
          const steps = /Deployment Instructions/i.test(pr.bodyText) || pr.labels.nodes.some((l) => l.name === "deploy instructions");
          const todo = live && steps && !this.deployDone.includes(pr.url);
          this.shipped[pr.url] = live ? "on production" : "merged, not live yet";
          merged.push({ id: `${pr.repository.name}#${pr.number}`, keys: [String(pr.number)], url: pr.url, title: pr.title, merged: true, steps: todo,
            side: todo ? "action" : live ? "shipped" : "waiting",
            meta: todo ? "On production · do the deploy instructions" : live ? "On production" : steps ? "Merged · not on production yet · has deploy instructions" : "Merged · not on production yet" });
        }
        // A PR merged since the last look: the Korok cheers (not for the ones found on the first run).
        const known = stored("mergedSeen");
        const fresh = merged.filter((m) => known && !known.includes(m.url));
        localStorage.setItem("mergedSeen", JSON.stringify([...new Set([...(known ?? []), ...merged.map((m) => m.url)])].slice(-50)));
        if (fresh.length) this.cheer(fresh.length > 1 ? `${fresh.length} PRs merged` : `${fresh[0].id} merged`);
        const row = (pr, side, note) => ({ id: prId(pr), keys: [String(pr.number)], url: pr.url, title: pr.title, side, meta: note, role: note.endsWith("eview requested") ? "reviewer" : null });
        this.prs = [
          ...review.map((pr) => has(direct, pr) ? row(pr, "action", "Review requested") : row(pr, "team", "Team review requested")),
          ...authored.map((pr) => failed(pr) ? row(pr, "action", pr.isDraft ? "Draft · CI failed" : "CI failed")
            : asked(pr) ? row(pr, "action", `${asked(pr)} comment${asked(pr) > 1 ? "s" : ""} to answer`)
            : pr.isDraft ? row(pr, "action", "Draft") : has(changes, pr) ? row(pr, "action", "Changes requested")
            : has(approved, pr) ? row(pr, "action", "Approved") : row(pr, "waiting", "Awaiting review")),
          ...merged,
        ];
        this.prsAt = Date.now(); this.prsError = null; this.publish();
      } catch (e) { this.prsError = String(e); }
      finally { this.loadingPrs = false; cx.notify(); }
    });
    cx.notify();
  }

  // Each agent's last recap, read from its terminal: nothing is sent to the agents.
  loadRecaps(cx) {
    if (this.loadingRecaps) return;
    this.loadingRecaps = true;
    cx.spawn(async (cx) => {
      const out = [];
      for (const a of agents()) {
        const r = await exec("hc", ["read", a.address, "--lines", "2000"]).catch(() => null);
        out.push({ address: a.address, pane: a.pane, status: a.status, name: a.title.replace(/^[^A-Za-z0-9]+/, "") || a.tab_name, space: a.space_name, text: r?.code === 0 ? recapIn(r.stdout) : null });
      }
      this.recaps = out; this.recapAt = Date.now(); this.loadingRecaps = false;
      cx.notify();
    });
    cx.notify();
  }

  recapRows(t) {
    const all = this.recaps.map((r) => `${r.space} / ${r.name}: ${r.text ?? "(no recap yet)"}`).join("\n\n");
    return [
      h_flex().flex_none().px(8).h(26).gap(4).items_center().text_size(11).text_color(t.dim)
        .child(div().flex_1().child(this.loadingRecaps ? "Reading the agents…" : `${this.recaps.length} agents`))
        .child(this.link("recap-copy", this.copied ? "Copied" : "Copy all", t.muted, t, (_e, cx) => {
          exec("sh", ["-c", 'printf %s "$1" | pbcopy', "sh", all]);
          this.copied = true; cx.timer.after(2000, (cx) => { this.copied = false; cx.notify(); }); cx.notify();
        })),
      ...this.recaps.map((r) => v_flex().flex_none().px(8).py(5).gap(2).rounded(8).hover((s) => s.bg(t.hover))
        .child(h_flex().gap(6).items_center()
          .child(div().size(8).flex_none().rounded(4).bg(t[r.status] ?? t.dim))
          .child(div().id(`recap-${r.address}`).flex_1().min_w(0).truncate().cursor_pointer().child(r.name).on_click(() => { run("pane.focus", { pane: r.pane }); }))
          .child(div().flex_none().text_size(10.5).text_color(t.dim).child(r.space))
          // The one thing here that does talk to the agent, and only this one.
          .when(!r.text, (el) => el.child(this.link(`ask-${r.address}`, r.asked ? "Asked" : "Ask", t.accent, t, (_e, cx) => {
            exec("hc", ["send", r.address, "Give me a two-line status: what is done, and what is still open."]); r.asked = true; cx.notify();
          }))))
        .child(div().pl(14).text_size(11.5).text_color(r.text ? t.muted : t.dim).whitespace_normal().child(r.text ?? "No recap yet in this session."))),
    ];
  }

  // Looks like Over9k's To-do panel: its header, chips, sections and rows.
  chip(name, label, count, t) {
    const on = this.tab === name;
    return h_flex().id(`chip-${name}`).h(20).px(7).gap(4).flex_none().items_center().rounded(5).cursor_pointer()
      .text_color(on ? t.foreground : t.muted).when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { this.tab = name; if (name === "recap") this.loadRecaps(cx); cx.notify(); })
      .child(div().child(label)).child(div().text_color(t.dim).child(String(count)));
  }

  // A ticket nobody works on: the first click arms, the second starts a Claude Code tab on it.
  // The tab is named after the ticket, so the row finds its agent again.
  pickUp(item, cx) {
    if (this.armed !== item.id) {
      this.armed = item.id;
      cx.timer.after(4000, (cx) => { if (this.armed === item.id) { this.armed = null; cx.notify(); } });
      cx.notify();
      return;
    }
    this.armed = null;
    const repo = repoOf(item);
    const space = spaces().find((s) => s.name === repo) ?? spaces().find((s) => s.name === REPOS[0]) ?? spaces().find((s) => s.active);
    const ticket = `Notion ticket ${item.id}: "${item.title}" (${item.url})`;
    const task = !item.ticket ? `Review PR ${item.url} ("${item.title}"), where my review is requested. Read the diff with gh. Do not switch branches or change code; give me your findings.`
      : item.role !== "reviewer" ? `Pick up ${ticket}. Read the ticket first, then tell me your plan before changing any code.`
      : item.pr ? `I am the reviewer of ${ticket}. Review its PR ${item.pr.url}: read the ticket first, then the diff with gh. Do not switch branches or change code; give me your findings.`
      : `I am the reviewer of ${ticket}. Read the ticket, find its PR and review it. Do not switch branches or change code; give me your findings.`;
    run("tab.new", { name: `${item.id} ${item.title}`.slice(0, 60), space: space?.id, folder: `${home()}/${repo}`, argv: ["claude"], task });
    cx.notify();
  }

  link(id, label, color, t, fn) {
    return div().id(id).px(4).rounded(4).flex_none().max_w(170).truncate().cursor_pointer().text_color(color)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(fn).child(label);
  }

  row(item, list, t) {
    const agent = item.merged ? null : agentFor(item, list);
    // Only a ticket or a PR to review is picked up; my own PRs are not.
    const pickable = (item.ticket || item.role === "reviewer") && repoOf(item) && !agent;
    const prUrl = item.pr?.url ?? (item.ticket ? null : item.url);
    const ci = CI[this.ci[prUrl]], pull = this.pull[prUrl], tree = pull?.branch ? this.trees[pull.branch] : null, live = this.shipped[prUrl];
    const trail = Boolean(item.pr || ci || pull?.branch);
    // Its agent, or the way to start one.
    const hand = agent
      ? this.link(`agent-${item.url}`, `→ ${agent.title.replace(/^[^A-Za-z0-9]+/, "")}`, t[agent.status] ?? t.muted, t, () => { run("pane.focus", { pane: agent.pane }); })
      : pickable ? this.link(`pick-${item.url}`, this.armed === item.id ? `Click again: ${item.role === "reviewer" ? "review" : "pick up"} in ${repoOf(item)}` : item.role === "reviewer" ? "Review" : "Pick up", this.armed === item.id ? t.blocked : t.muted, t, (_e, cx) => this.pickUp(item, cx))
      : div();
    return v_flex().flex_none().px(8).py(5).gap(2).rounded(8).hover((s) => s.bg(t.hover))
      .child(h_flex().gap(8).items_center()
        // Whose turn, as a fox's head (tools/fox.py): awake with a "!" (mine), asleep (someone else's), three of them (the team), a star (shipped).
        .child(image(`mods/my-work/fox-${item.side}.svg`).size(26).flex_none())
        .child(div().id(`open-${item.url}`).flex_1().min_w(0).truncate().cursor_pointer().child(item.title)
          // A PR: open it. A ticket: to its agent, or pick it up.
          .on_click((_e, cx) => { if (!item.ticket) exec("open", [item.url]); else if (agent) run("pane.focus", { pane: agent.pane }); else this.pickUp(item, cx); })))
      .child(h_flex().pl(30).gap(2).items_center().text_size(11).text_color(t.dim)
        .child(this.link(`id-${item.url}`, item.id, t.dim, t, () => { exec("open", [item.url]); }))
        .child(div().flex_1().min_w(0).truncate().child(`· ${item.meta}`))
        .when(Boolean(item.steps), (el) => el.child(this.link(`steps-${item.url}`, "Done", t.muted, t, (_e, cx) => {
          this.deployDone = [...this.deployDone, item.url].slice(-50); localStorage.setItem("deployDone", JSON.stringify(this.deployDone));
          item.steps = false; item.side = "shipped"; item.meta = "On production"; this.publish(); cx.notify();
        })))
        .when(!trail, (el) => el.child(hand)))
      // The trail: its PR with CI, the comments waiting for me, its branch (a click opens a tab in its worktree), whether it is live, its agent.
      .when(trail, (el) => el.child(h_flex().pl(30).gap(2).items_center().text_size(11).text_color(t.dim)
        .when(Boolean(item.pr), (row) => row.child(this.link(`pr-${item.url}`, item.pr.note ? `${item.pr.id} ${item.pr.note}` : item.pr.id, t.accent, t, () => { exec("open", [item.pr.url]); })))
        .when(Boolean(ci), (row) => row.child(div().id(`ci-${item.url}`).mx(3).size(7).flex_none().rounded(4).bg(t[ci[0]]).tooltip(ci[1])))
        .when(Boolean(pull?.waiting), (row) => row.child(this.link(`asked-${item.url}`, `${pull.waiting} to answer`, t.blocked, t, () => { exec("open", [pull.first]); })))
        .when(Boolean(pull?.branch), (row) => row.child(div().id(`branch-${item.url}`).px(4).rounded(4).min_w(0).max_w(120).truncate().text_color(tree ? t.muted : t.dim)
          .tooltip(tree ? `${pull.branch}: click for a tab in ${tree}` : `${pull.branch}: no worktree on this Mac`)
          .when(Boolean(tree), (b) => b.cursor_pointer().hover((h) => h.bg(t.hover).text_color(t.foreground)).on_click(() => { run("tab.new", { name: pull.branch.slice(0, 40), folder: tree }); }))
          .child(pull.branch)))
        .when(Boolean(live) && Boolean(item.ticket), (row) => row.child(div().flex_none().px(4).text_color(live === "on production" ? t.ansi2 : t.dim).child(live)))
        .child(div().flex_1())
        .child(hand)));
  }

  sections(items, t) {
    const list = agents();
    return SECTIONS.flatMap(([side, heading], n) => {
      const mine = items.filter((x) => x.side === side), open = !this.folded[side];
      if (side === "shipped" && !mine.length) return [];
      return [
        h_flex().id(`sec-${side}`).h(26).flex_none().mt(6).px(8).gap(7).items_center().text_size(11).text_color(t.dim).rounded(7).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.folded[side] = open; cx.notify(); })
          .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
          .child(div().text_color(side === "action" ? t.foreground : t.dim).child(`${n + 1}. ${heading}`)).child(div().text_color(t.muted).child(String(mine.length))),
        ...(open ? mine.map((item) => this.row(item, list, t)) : []),
      ];
    });
  }

  render() {
    const t = theme(), tickets = this.tab === "tickets", recap = this.tab === "recap";
    // PRs that ask for my review show with the tickets: on their ticket's row, else as a row of their own.
    const reviews = this.prs.filter((p) => p.role === "reviewer");
    const ticketRows = this.tickets.map((x) => {
      const pr = this.ticketPrs[x.id] ?? null;
      if (pr && reviews.some((p) => p.url === pr.url && p.side === "action")) return { id: `DIL-${x.id}`, keys: [`dil[- ]?${x.id}`, String(pr.number)], url: x.url, title: x.title, side: "action", meta: `${ROLE[x.role]} · review requested`, pr, ticket: true, role: "reviewer" };
      return { id: `DIL-${x.id}`, keys: [`dil[- ]?${x.id}`, ...(pr ? [String(pr.number)] : [])], url: x.url, title: x.title, side: ticketSide(x), meta: `${ROLE[x.role]} · ${x.status}`, pr, ticket: true, role: x.role };
    });
    // Deploy instructions waiting for me show with the tickets too.
    const withReviews = [...ticketRows, ...reviews.filter((p) => !ticketRows.some((x) => x.pr?.url === p.url)), ...this.prs.filter((p) => p.steps)];
    const items = tickets ? withReviews : this.prs;
    const at = recap ? this.recapAt : tickets ? this.ticketsAt : this.prsAt;
    const note = recap ? "" : tickets
      ? (at ? "" : "No tickets yet: they arrive once a Claude Code session has synced them.")
      : (this.prsError || "");
    const todo = [...withReviews, ...this.prs.filter((p) => p.role !== "reviewer" && !p.steps)].filter((x) => x.side === "action").length;
    return v_flex().id("my-work").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("My work"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${todo} for me`))
        .child(div().flex_1())
        .child(div().text_size(10.5).text_color(t.dim).child(!tickets && this.loadingPrs ? "loading…" : tickets && this.asking ? "asking Notion…" : tickets && this.unanswered ? `no Claude session answered · ${at ? clock(at) : ""}` : at ? clock(at) : ""))
        .child(h_flex().id("refresh").px(5).py(1).flex_none().items_center().rounded(4).cursor_pointer().text_size(10.5).text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { if (recap) this.loadRecaps(cx); else this.refresh(cx); }).child("Refresh")))
      .child(h_flex().flex_none().min_h(30).gap(2).px(8).pt(5).items_center().text_size(11.5)
        .child(this.chip("tickets", "Tickets", withReviews.length, t))
        .child(this.chip("prs", "PRs", this.prs.length, t))
        .child(this.chip("recap", "Recap", agents().length, t))
)
      .child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("my-work-list").absolute().inset_0().overflow_y_scroll().px(8).pb(8).children(recap ? this.recapRows(t) : this.sections(items, t))
          .when(Boolean(note), (e) => e.child(div().p(8).text_size(11).text_color(tickets ? t.dim : t.ansi1).child(note)))));
  }
}
