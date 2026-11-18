import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, home, run, spaces, checking, shared, setShared, nextCommand, openOverlay } from "herdr";

// The local dev stacks, in the sidebar: one row per repo with one light (its
// Rails port answers; `mise start` brings the rest), and its `mise start` kept in a Herdr terminal without a tab (named, so it is
// found again). The name opens that terminal's log; Start and Stop run it.
// A stack started outside Herdr still lights up, it just has no log here.
// "stg" and "prod" open that repo's remote shell (my `rs` and `rp`) in a new tab;
// prod asks for a second click.
// On top, "Morning start" opens the `morning` dialog, which pulls master, has this
// mod start both stacks ("dev-servers.start-all") and shows what changed overnight.
const STACKS = [
  { key: "floryn", label: "Platform", folder: "floryn", ports: [["Rails", 3000]] },
  { key: "ais", label: "AIS", folder: "ais", ports: [["Rails", 4000]] },
];
const name = (s) => `dev-${s.key}`;
const REMOTES = [["stg", "staging"], ["prod", "production"]];
const MORNING = { mod: "morning", kind: "dialog", width: 560, height: 600 };
// One line per stack: its terminal's address when live ("-" if none), then 1/0 per port.
const PROBE = STACKS.map((s) => `printf '%s' "$(hc get ${name(s)} 2>/dev/null | jq -r 'select(.state == "live") | .address' 2>/dev/null | grep . || echo -)"; ${s.ports.map(([, p]) => `nc -z -G 1 127.0.0.1 ${p} >/dev/null 2>&1 && printf ' 1' || printf ' 0'`).join("; ")}; echo`).join("; ");

export default class DevServers extends View {
  init(_props, cx) {
    this.state = {};
    if (checking()) return;
    this.probe(cx);
    cx.timer.every(10000, (cx) => this.probe(cx));
    // "dev-servers.start-all" (Morning start, or a key): starts every stack that is not running.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "start-all") this.startAll(cx);
        cx.notify();
      }
    });
  }

  // Also shared as "dev-servers.state" for the morning dialog, set only when it changes.
  async look() {
    const r = await exec("sh", ["-c", PROBE]).catch(() => null);
    (r?.stdout ?? "").trim().split("\n").forEach((line, i) => {
      const [address, ...up] = line.split(" ");
      if (STACKS[i]) this.state[STACKS[i].key] = { terminal: address === "-" ? null : address, up: up.map((x) => x === "1") };
    });
    const now = JSON.stringify(this.state);
    if (now !== this.published) { this.published = now; setShared("dev-servers.state", JSON.parse(now)); }
  }

  probe(cx) {
    cx.spawn(async (cx) => { await this.look(); cx.notify(); });
  }

  startAll(cx) {
    cx.spawn(async (cx) => {
      await this.look();
      for (const s of STACKS) {
        const st = this.state[s.key];
        if (!st?.terminal && !st?.up.some(Boolean)) await exec("hc", this.argv(s)).catch(() => null);
      }
      await this.look();
      cx.notify();
    });
  }

  argv(s) { return ["run", "--bg", "--no-parent", "--name", name(s), "--cwd", `${home()}/${s.folder}`, "--", "zsh", "-lic", "mise start"]; }

  start(s, cx) {
    exec("hc", this.argv(s))
      .catch(() => null).then(() => this.probe(cx));
  }

  // Ctrl+C first, so mise stops its tasks itself; the terminal ends with it.
  stop(s, cx) {
    exec("hc", ["keys", name(s), "ctrl+c"]).catch(() => null).then(() => cx.timer.after(3000, (cx) => this.probe(cx)));
  }

  remote(s, env, cx) {
    const id = `${s.key}-${env}`;
    if (env === "production" && this.armed !== id) {
      this.armed = id;
      cx.timer.after(4000, (cx) => { if (this.armed === id) { this.armed = null; cx.notify(); } });
      cx.notify();
      return;
    }
    this.armed = null;
    // In the repo's own space, opened again when it has none.
    const folder = `${home()}/${s.folder}`, tab = `${env} ${s.label}`, argv = ["bin/aws/remote-shell", env];
    const space = spaces().find((x) => x.name === s.folder || (x.folder ?? "").replace(/\/+$/, "") === folder);
    if (space) run("tab.new", { name: tab, space: space.id, folder, argv });
    else run("space.new", { name: s.folder, folder, tab, argv });
    cx.notify();
  }

  link(id, label, color, t, fn) {
    return div().id(id).px(4).rounded(4).flex_none().cursor_pointer().text_size(11).text_color(color)
      .hover((el) => el.bg(t.hover).text_color(t.foreground)).on_click(fn).child(label);
  }

  row(s, t) {
    const st = this.state[s.key] ?? { terminal: null, up: [] }, any = st.up.some(Boolean);
    return h_flex().h(24).flex_none().px(10).gap(6).items_center()
      .child(div().id(`log-${s.key}`).w(58).flex_none().truncate().text_color(st.terminal ? t.foreground : t.muted)
        .when(Boolean(st.terminal), (el) => el.cursor_pointer().tooltip("Show its log").on_click(() => { run("terminal.peek", { terminal: st.terminal }); }))
        .child(s.label))
      .children(s.ports.map(([label, port], i) => div().id(`port-${s.key}-${port}`).size(8).flex_none().rounded(4)
        .tooltip(`${label} :${port} ${st.up[i] ? "is up" : st.terminal ? "is starting, or failed: click the name for its log" : "is down"}`)
        // Green: up. Yellow: started here, not answering yet. Hollow: off.
        .map((el) => (st.up[i] ? el.bg(t.ansi2) : st.terminal ? el.bg(t.ansi3) : el.border(1.5).border_color(t.dim)))))
      .child(div().flex_1())
      .children(REMOTES.map(([label, env]) => {
        const armed = this.armed === `${s.key}-${env}`;
        return this.link(`remote-${s.key}-${env}`, armed ? "sure?" : label, armed ? t.ansi1 : t.dim, t, (_e, cx) => this.remote(s, env, cx));
      }))
      .when(Boolean(st.terminal), (el) => el.child(this.link(`stop-${s.key}`, "Stop", t.muted, t, (_e, cx) => this.stop(s, cx))))
      .when(!st.terminal && !any, (el) => el.child(this.link(`start-${s.key}`, "Start", t.accent, t, (_e, cx) => this.start(s, cx))))
      .when(!st.terminal && any, (el) => el.child(div().text_size(10.5).text_color(t.dim).child("outside Herdr")));
  }

  render() {
    const t = theme(), morning = shared("morning"), done = morning?.day === new Date().toDateString();
    return v_flex().id("dev-servers").size_full().pt(4).border_t(1).border_color(t.border).bg(t.chrome).text_size(12.5)
      .child(h_flex().h(24).flex_none().px(6).gap(6).items_center()
        .child(this.link("morning", "Morning start", done ? t.muted : t.accent, t, () => { openOverlay(MORNING); }))
        .child(div().flex_1())
        .when(done, (el) => el.child(div().pr(4).text_size(10.5).text_color(t.dim).child(`done ${new Date(morning.at).toTimeString().slice(0, 5)}`))))
      .children(STACKS.map((s) => this.row(s, t)));
  }
}
