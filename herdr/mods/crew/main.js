import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, terminals, theme, run, shared, layout, appHome, readTextFile, exec, checking, nextCommand } from "herdr";
import { mix, light, heaven as sky_ } from "./sky.js";
import { land } from "./scenes.js";

// The crew on a mountain seen from the side, in a strip above the terminals.
// Every agent is a small figure, and where it is says what it does:
//   working -> a lap of the mountain: up on the chairlift, then down the slope
//              (over the jump on the plateau, in winter)
//   blocked -> stops where it is with a "!": sitting in the snow, or hanging in
//              its chair. It goes on from there once I have answered.
//   done    -> gets off the lift, heads straight down at double speed with a
//              "!" and waits by the orange flag in the valley, holding up a star
// In the ski season half of them are on a snowboard instead of skis.
//   idle    -> on a bench beside the hut, at the far left of the valley, a little
//              dimmed, with a mug of hot chocolate, tea or coffee (in the ski
//              season; a glass in summer). No names there, a hover says who it
//              is. More than four sit in two rows.
// Nobody flies: on the mountain they follow the lift and the slope, in the
// valley they walk along the floor.
// An agent's sub-agents, in the ski season: while any is running it carries a folded
// wing on its back in the chair, and comes down flying under that wing instead of on
// its skis. How many there are is not shown (a hover says).
// In the valley chickens follow it, on the beach seagulls, in the orchard geese
// (up to four, then "+n").
// They are Claude Code's subagents (the sidebar mod shares the running ones as
// "over9k.subs") and Herdr's own (agents an agent started with `hc run`).
// Once I have looked at a done agent Herdr makes it idle: it is on its bench in one go.
// A click goes to that agent. Its colour stays with its terminal.
// The scene goes with the time of year (season()): the ski resort from December to
// March ("ski", drawn here), then the valley, the beach and the orchard (scenes.js).
// `crew.season` shows the next scene for a look ahead, round to the calendar's own.
// The same mountain in summer with hikers ("alp") is still here but in no month.
// The sky is the real one over where I am (the weather mod's shared "weather.sky"):
// the sun crosses from sunrise to sunset, the moon at night, clouds when it is
// overcast, a darker sky and falling rain or snow when the radar says so; the
// mountain's colours go with the light. A wooden clock (day, time, the season's sign) sits in the sky, top left.
// In the compact layout (shared "compact", set by the forest sprite on the laptop screen) the
// strip is lower: the same mountain, drawn smaller (SMALLER), with everything on it.
// The mountain is drawn here, as wide as the strip (the valley on the left, the
// summit station at the right edge), and saved as one picture under data/;
// the figures are <season>-<colour>-<pose>.svg (crew-gen.py and crew-resort.py made them).
const ART = "mods/crew", SCENES = "data/crew-scene";
// Raise this when the mountain is drawn differently: a saved picture is reused by its name.
const DRAWING = 6;
const H = 260, SIZE = 56, STEP = 3000;
// The compact strip's height against the full one's.
const SMALLER = 160 / 260;
// A follower's size, how far the first one is behind its parent, and how many are drawn.
const SMALL = 28, BEHIND = 34, TRAIL = 20, FOLLOWERS = 4;
// How high over the piste a skier under its wing comes down.
const FLIGHT = 14;
const VALLEY = 232, SUMMIT = 84;
// The valley floor, left to right: the hut, its benches, the flag with the queue, the lift station.
const BENCHES = [168, 300], QUEUE = 350, STATION = 400, FLAT = 530;
// How much nearer (lower) the front row of the idle ones sits.
const FRONT = 16;
// Where the middle of the body is in a drawing (of 64), for what is put on it afterwards.
const BODY = { ski: { blocked: 35, done: 35, fly: 35, down: 36, working: 31, pack: 31, stuck: 40, carve: 33 }, flat: { pick: 31, sail: [20, 37], adrift: [20, 37], sailback: [44, 37] } };
const body_ = (look, pose) => {
  const at = look === "ski" ? BODY.ski[pose] ?? 36 : pose === "stuck" ? (look === "orchard" ? 37 : 44) : BODY.flat[pose] ?? 41;
  return Array.isArray(at) ? at : [32, at];
};
// The mountain's outline and the lift's cable, drawn 1500 wide; fit() moves them to the strip's width.
const PROFILE = [[0, 232], [470, 232], [530, 222], [700, 172], [760, 166], [880, 124], [1130, 124], [1210, 102], [1340, 84], [1500, 84]];
const CABLE = [[452, 172], [600, 146], [700, 112], [880, 62], [1005, 62], [1130, 62], [1210, 40], [1340, 24], [1404, 24]];
const SUITS = ["pink", "cyan", "gold", "mint", "violet", "ember"];
// What an idle skier drinks; like its colour, it stays with its terminal.
const DRINKS = ["choco", "tea", "coffee"];
// Half of them snowboard, by their terminal like the colour: the poses that have a board under them.
// With the wing (sub-agents running) everybody is on skis.
const BOARDED = ["working", "down", "stuck", "carve", "blocked", "done"];
const boards = (address) => Math.floor(hash(address) / SUITS.length) % 2 === 1;
const LOOKS = {
  ski: { bands: ["#3d6375", "#30525f", "#25424e"], edge: ["#e9f0f2", 5], tree: "#14323a", roof: "#eef3f5" },
  alp: { bands: ["#3f6f4c", "#31593f", "#254635"], edge: ["#8fd16a", 4], tree: "#173f2c", roof: "#a07a55" },
};
const PEAKS = '<path d="M0 110 L90 44 L150 80 L250 8 L330 70 L400 36 L520 110z" fill="FAR"/><path d="M250 8 L226 26 l10 3 6 -6 9 8 8 -7 9 6 9 -4z M400 36 L384 48 l8 2 6 -5 8 6 8 -4z M90 44 L76 55 l8 1 6 -4 8 5 7 -3z" fill="#dfe8ec" opacity=".55"/>';
const STATION_ART = '<rect x="8" y="30" width="56" height="40" fill="#2b4250"/><path d="M2 32 L36 10 L70 32z" fill="#3a5666"/><path d="M2 32 L36 10 L70 32 L64 32 L36 15 L8 32z" fill="ROOF"/>'
  + '<rect x="16" y="40" width="14" height="12" rx="1" fill="#ffd166" opacity=".9"/><path d="M23 40 v12 M16 46 h14" stroke="#2b4250" stroke-width="1"/><rect x="38" y="42" width="18" height="28" rx="1" fill="#16303c"/>';
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hash = (address) => [...address].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const YEAR = ["ski", "valley", "beach", "orchard"];
const season = () => { const m = new Date().getMonth(); return m === 11 || m <= 2 ? "ski" : m <= 5 ? "valley" : m <= 7 ? "beach" : "orchard"; };

// The valley keeps its size on the left and the summit on the right; the slope between stretches.
const fit = (W) => (x) => Math.round(x <= FLAT ? x : x <= 1340 ? FLAT + ((x - FLAT) * (W - 160 - FLAT)) / (1340 - FLAT) : W - 160 + (x - 1340));
const heightAt = (line, x) => {
  for (let i = 1; i < line.length; i++) if (x <= line[i][0]) return line[i - 1][1] + ((line[i][1] - line[i - 1][1]) * (x - line[i - 1][0])) / (line[i][0] - line[i - 1][0] || 1);
  return line[line.length - 1][1];
};
// n + 1 points at equal steps along a line.
function along(line, n) {
  const legs = line.slice(1).map((b, i) => [line[i], b, Math.hypot(b[0] - line[i][0], b[1] - line[i][1])]);
  const total = legs.reduce((sum, l) => sum + l[2], 0);
  return Array.from({ length: n + 1 }, (_, i) => {
    let d = (total * i) / n;
    for (const [a, b, len] of legs) {
      if (d <= len + 0.001) return [Math.round(a[0] + ((b[0] - a[0]) * d) / len), Math.round(a[1] + ((b[1] - a[1]) * d) / len)];
      d -= len;
    }
    return line[line.length - 1];
  });
}

// Everything that depends on the strip's width: the lines, the laps' waypoints, and the picture.
function mountain(W, look, cafe, sky, now) {
  const f = fit(W), lit = light(sky, now);
  const L = { ...LOOKS[look], bands: LOOKS[look].bands.map(lit.shade), edge: [lit.shade(LOOKS[look].edge[0]), LOOKS[look].edge[1]], tree: lit.shade(LOOKS[look].tree) };
  const profile = PROFILE.map(([x, y]) => [f(x), y]), cable = CABLE.map(([x, y]) => [f(x), y]);
  const ground = (x) => heightAt(profile, x);
  const path = (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")}`;
  const band = (dy, fill) => `<path d="${path(profile.map(([x, y]) => [x, y + dy]))} L${W} ${H} L0 ${H}z" fill="${fill}"/>`;
  const tree = (x0, s) => {
    const x = f(x0), y = Math.round(ground(x)) + 2, r = (n) => Math.round(n * s);
    return `<path d="M${x} ${y - r(34)} l${r(9)} ${r(14)} h-${r(4)} l${r(8)} ${r(12)} h-${r(26)} l${r(8)} -${r(12)} h-${r(4)}z" fill="${L.tree}"/>`
      + (look === "ski" ? `<path d="M${x} ${y - r(34)} l${r(5)} ${r(8)} l-${r(5)} -${r(2)} l-${r(5)} ${r(2)}z" fill="#e3ecef" opacity=".85"/>` : "")
      + `<rect x="${x - 1.5}" y="${y - r(8)}" width="3" height="${r(8)}" fill="#3a2a22"/>`;
  };
  const gate = (x0, col) => { const x = f(x0), y = Math.round(ground(x)); return `<path d="M${x} ${y + 1} v-17" stroke="#d9d4c0" stroke-width="1.4"/><path d="M${x} ${y - 16} l-9 3 9 3z" fill="${col}"/>`; };
  const flowers = (x0) => { const x = f(x0), y = Math.round(ground(x)); return [[0, 0, "#f29ac0"], [7, 2, "#ffd166"], [14, -1, "#f4f1e6"], [22, 1, "#f29ac0"], [30, -1, "#ffd166"]].map(([dx, dy, c]) => `<circle cx="${x + dx}" cy="${y - 2 - dy}" r="1.8" fill="${c}"/>`).join(""); };
  const cow = (x0) => { const x = f(x0), y = Math.round(ground(x)); return `<ellipse cx="${x}" cy="${y - 11}" rx="13" ry="7.5" fill="#f4f1e6"/><ellipse cx="${x - 3}" cy="${y - 12}" rx="4" ry="3" fill="#3a2a22"/><ellipse cx="${x + 7}" cy="${y - 9}" rx="3" ry="2.4" fill="#3a2a22"/><circle cx="${x - 15}" cy="${y - 14}" r="4.6" fill="#f4f1e6"/><path d="M${x - 8} ${y - 5} v6 M${x + 8} ${y - 5} v6" stroke="#f4f1e6" stroke-width="2.6"/><circle cx="${x - 17}" cy="${y - 15}" r=".9" fill="#16323b"/>`; };
  const pylon = ([x, y]) => `<path d="M${x} ${y} V${Math.round(ground(x)) + 4}" stroke="#3f6272" stroke-width="5"/><path d="M${x - 13} ${y} h26" stroke="#3f6272" stroke-width="5" stroke-linecap="round"/>`;
  const roofed = (art) => (look === "alp" ? art.replaceAll('"#eef3f5"', `"${L.roof}"`) : art).replaceAll("ROOF", L.roof);
  // Far peaks behind the slope, their feet hidden by it.
  const far = Array.from({ length: Math.ceil(W / 430) + 1 }, (_, i) => { const x = -40 + i * 430; return `<g transform="translate(${x},${Math.round(ground(x + 260)) - 108 - (i % 2) * 14})">${PEAKS.replace("FAR", mix(lit.shade("#1d3a48"), lit.low, 0.35))}</g>`; }).join("");
  const marks = look === "ski"
    ? [[1290, "#ff9a3c"], [1180, "#5fd7ff"], [850, "#ff9a3c"], [780, "#5fd7ff"], [680, "#ff9a3c"], [590, "#5fd7ff"]].map(([x, c]) => gate(x, c)).join("")
    : [580, 650, 740, 820, 1160, 1230, 1290].map(flowers).join("") + cow(1060) + cow(960);
  const heaven = sky_(W, H, sky, lit);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${heaven}${far}`
    + band(0, L.bands[0]) + band(22, L.bands[1]) + band(54, L.bands[2])
    + [[620, 1], [645, 0.8], [672, 1.1], [790, 0.9], [815, 1.1], [1165, 0.8], [1250, 1], [1276, 0.85], [1470, 1]].map(([x, s]) => tree(x, s)).join("")
    + `<path d="${path(profile)}" stroke="${L.edge[0]}" stroke-width="${L.edge[1]}" fill="none" stroke-linejoin="round"/>${marks}${cable.slice(1, -1).map(pylon).join("")}`
    + `<g transform="translate(${STATION},${VALLEY - 84}) scale(1.2)">${roofed(STATION_ART)}</g><g transform="translate(${W - 128},${SUMMIT - 70})">${roofed(STATION_ART)}</g>`
    + `<g transform="translate(8,${VALLEY - 90})">${roofed(cafe)}</g>`
    + `<path d="${path(cable)}" stroke="#a9bcc2" stroke-width="2" fill="none"/><path d="M${QUEUE - 26} 232 V190" stroke="#d9d4c0" stroke-width="2"/><path d="M${QUEUE - 26} 191 l-14 5 14 5z" fill="#ff9a3c"/></svg>`;
  const top = f(1350), n = 12;
  const down = Array.from({ length: n + 1 }, (_, i) => { const x = Math.round(top - ((top - 500) * i) / n); return [x, Math.round(ground(x))]; });
  // On the plateau: the way down's step nearest its middle is the jump (winter) or passes the picnic (summer).
  const mid = f(1005), jump = down.reduce((best, p, i) => (Math.abs(p[0] - mid) < Math.abs(down[best][0] - mid) ? i : best), 0);
  const [jx, jy] = down[jump];
  const spot = look === "ski"
    ? `<path d="M${jx + 92} ${jy} L${jx + 34} ${jy - 16} V${jy}z" fill="#cfdde3"/><path d="M${jx + 92} ${jy} L${jx + 34} ${jy - 16}" stroke="#e9f0f2" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M${jx - 30} ${jy - 1} h44 l5 -5 h-44z" fill="#e0624a"/><path d="M${jx - 19} ${jy - 1} l5 -5 M${jx - 8} ${jy - 1} l5 -5 M${jx + 3} ${jy - 1} l5 -5" stroke="#f4f1e6" stroke-width="3"/>`
      + `<rect x="${jx + 22}" y="${jy - 12}" width="13" height="10" rx="2" fill="#a07a55"/><path d="M${jx + 23} ${jy - 12} q5.5 -8 11 0" stroke="#6b4a36" stroke-width="1.6" fill="none"/>`;
  return {
    svg: svg.replace("</svg>", `${spot}</svg>`),
    jump: look === "ski" ? jump : -1,
    lift: along(cable, 12),
    down,
  };
}

export default class Crew extends View {
  init(_props, cx) {
    this.width = 0; this.tick = 0; this.scene = null;
    // Where each agent is on its lap: 0 is on foot at the lift station, then the steps
    // along the lift, then the way down. Absent: not on the mountain.
    this.lap = {};
    // For the walk between the benches and the rest: who was out there last time, when each one
    // came back, and where each one sat.
    this.out = new Set(); this.back = {}; this.seat = {};
    if (checking()) return;
    this.measure(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        // A look at the next scene of the year; back at the calendar's own it follows the calendar again.
        if ((await nextCommand()) !== "season") continue;
        const next = YEAR[(YEAR.indexOf(this.preview ?? season()) + 1) % YEAR.length];
        this.preview = next === season() ? null : next;
        this.measure(cx);
      }
    });
    // One step of everybody's lap; the figures glide to their next spot by themselves.
    cx.timer.every(STEP, (cx) => { this.tick += 1; this.step(); if (this.tick % 3 === 0) this.measure(cx); cx.notify(); });
    // Drawn again every second for the clock. The same timer notices the layout going compact or back, so the mountain is drawn again at once.
    cx.timer.every(1000, (cx) => { if (Boolean(shared("compact")) !== this.compact) this.measure(cx); cx.notify(); });
  }

  // Everybody one step on. A working agent walks to the station, rides up, comes
  // down, and again. A blocked one stays where it is. One that is done (or was
  // stopped) gets off the lift onto the slope under it and goes down two steps
  // at a time, then leaves the mountain.
  step() {
    if (!this.scene) return;
    const { lift, down } = this.scene, laps = 1 + lift.length + down.length, live = new Set();
    for (const a of agents()) {
      live.add(a.address);
      const at = this.lap[a.address];
      if (a.status === "working") this.lap[a.address] = at === undefined ? (this.started ? 0 : hash(a.address) % laps) : (at + 1) % laps;
      else if (at !== undefined && a.status !== "blocked") {
        if (at === 0 || at >= laps - 1) delete this.lap[a.address];
        else if (at <= lift.length) this.lap[a.address] = 1 + lift.length + down.reduce((best, p, k) => (Math.abs(p[0] - lift[at - 1][0]) < Math.abs(down[best][0] - lift[at - 1][0]) ? k : best), 0);
        else this.lap[a.address] = Math.min(at + 2, laps - 1);
      }
    }
    for (const address of Object.keys(this.lap)) if (!live.has(address)) delete this.lap[address];
    // Only the agents found working at the start are spread over the lap; later ones start at the station.
    this.started = true;
  }

  // How wide the strip is: the window less the sidebar, the right panel when it shows, and the gaps.
  // The mountain is drawn again when that, or the season, changes.
  measure(cx) {
    cx.spawn(async (cx) => {
      try {
        const win = JSON.parse(await readTextFile(`${appHome()}/window.json`)).bounds[2];
        const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
        const panel = find(layout(), "panel");
        const side = shared("sidebar.collapsed") ? 44 : shared("sidebar.width") ?? 268;
        // Compact: the mountain is drawn as wide as it would be at full height, then shown smaller.
        const compact = this.compact = Boolean(shared("compact")), k = compact ? SMALLER : 1;
        const shown = Math.max(compact ? 560 : 960, Math.round(win - side - 16 - (panel && !panel.hidden ? (panel.size?.px ?? 368) + 8 : 0)));
        const width = Math.round(shown / k);
        const sky = shared("weather.sky") ?? null, now = Date.now();
        // A new picture every ten minutes, and when rain starts or stops.
        const look = this.preview ?? season(), key = `${look}-${width}-${DRAWING}-${Math.floor(now / 600000)}${(sky?.mm ?? 0) >= 0.1 ? "w" : "d"}`;
        if (this.scene?.key !== key) {
          const cafe = (await readTextFile(`${appHome()}/${ART}/ski-cafe.svg`)).trim().replace(/^<svg[^>]*>|<\/svg>$/g, "");
          const m = look === "ski" || look === "alp" ? mountain(width, look, cafe, sky, now) : land(width, look, cafe, sky, light(sky, now));
          // The picture before this one stays, under the new one, until the new one has loaded:
          // without it the strip is empty for a frame at every change.
          const before = this.scene && this.width === shown ? this.scene.key : null;
          await exec("sh", ["-c", 'mkdir -p "$1" && printf %s "$3" > "$1/$2" && for f in "$1"/*.svg; do [ "$f" = "$1/$2" ] || [ "$f" = "$1/$4.svg" ] || rm -f "$f"; done', "sh", `${appHome()}/${SCENES}`, `${key}.svg`, m.svg, before ?? ""]);
          this.width = shown; this.scene = { ...m, key, before, k, look, sky, dark: light(sky, now).night > 0.5 };
          if (!this.started) this.step();
        }
      } catch { /* keeps the last mountain */ }
      cx.notify();
    });
  }

  // One agent at a spot (x: its middle, y: the top of its drawing), gliding there
  // from wherever it was: its drawing, a "!" above when it wants me, its name below.
  // `back`: where "behind" is, as [direction along x, the slope there]; followers hang or stand along it.
  figure(a, pose, x, y, t, { size = SIZE, wants = false, dim = false, bounce = 0, named = true, steam = false, wing = false, back = [-1, 0] } = {}) {
    const name = a.title.replace(/^[^A-Za-z0-9]+/, "") || a.tab_name || a.program?.name || "agent", k = this.scene.k;
    // The spot and the drawings follow the mountain's size; the "!" and the name stay readable.
    x *= k; y *= k; size = Math.round(size * k);
    const little = Math.round(SMALL * k);
    const subs = this.followers(a), ski = this.scene.look === "ski", coat = this.wet && !pose.startsWith("rest");
    const says = a.status === "done" ? "finished, have a look" : a.status === "blocked" ? "needs your answer" : a.status;
    const body = v_flex().w(84).items_center()
      .child(h_flex().h(14).justify_center().when(wants, (el) => el.child(div().h(14).min_w(14).px(3).flex().items_center().justify_center().rounded(7)
        .text_size(10).font_semibold().bg(t.blocked).text_color(t.accent_foreground).child("!").loop("opacity", { from: 0.4, to: 1, period: 800 }))))
      // Only the drawing itself takes the click: the boxes around two neighbours overlap, the drawings don't.
      .child(div().id(`crew-hit-${a.address}`).w(size).h(size).cursor_pointer().tooltip(`${name} · ${a.space_name} · ${says}${subs.length ? ` · ${subs.length} sub-agent${subs.length > 1 ? "s" : ""} running` : ""}`)
        .on_click(() => { run("agent.focus", { terminal: a.address }); })
        .child(image(`${ART}/${this.scene.look}-${SUITS[hash(a.address) % SUITS.length]}-${pose}${ski && BOARDED.includes(pose) && boards(a.address) ? "-board" : ""}.svg`).w(size).h(size).when(dim, (el) => el.opacity(0.8)))
        // A puff of steam over the mug, each at its own pace.
        .when(steam, (el) => el.relative().child(div().absolute().left(size * 0.69).top(size * 0.4).size(size / 12).rounded(size / 24).bg("#f4f7f8")
          .loop("opacity", { from: 0.05, to: 0.6, period: 1800 + (hash(a.address) % 5) * 300 })))
        // In rain or snow: a yellow rain hat and coat, put on where the body is in this drawing.
        .when(coat, (el) => { const [cx, cy] = body_(this.scene.look, pose); return el.relative().child(image(`${ART}/raincoat.svg`).absolute().left(((cx - 32) * size) / 64).top(((cy - 37) * size) / 64).w(size).h(size)); }))
      .when(named, (el) => el.child(div().w(84).h(13).text_size(10).truncate().text_color(wants ? t.blocked : t.muted).child(name)));
    // In a chair it is another element than on foot, so it gets on and off in one go and never glides between cable and ground.
    // On its bench it is another one too: it sits down there in one go, and does not slide over, bench and all.
    // The followers are part of the figure, so they glide along with it. Chairs line up
    // by their tops (the cable), everybody else by their feet.
    // Nothing follows a skier (it has its wing), nor the idle ones of the new scenes: their benches stay calm.
    const kids = ski || (this.scene.flat && pose.startsWith("rest")) ? [] : subs, suit = SUITS[hash(a.address) % SUITS.length], chair = pose === "working" || pose === "pack";
    const flat = Boolean(this.scene.flat), gulls = this.scene.look === "beach";
    // In the new scenes an animal follows, the same for every colour: chickens, seagulls (in the air), geese.
    const small = flat ? null : chair ? "working" : pose.startsWith("rest") ? "rest" : pose === "stuck" ? pose : this.scene.look === "ski" ? "carve" : "down";
    const trail = kids.slice(0, FOLLOWERS).map((kid, i) => {
      const dx = back[0] * (BEHIND + i * TRAIL) * k, dy = Math.round(back[1] * dx);
      return div().id(`crew-sub-${a.address}-${i}`).absolute().left(42 + dx - little / 2).top(14 + dy + (chair ? 0 : gulls ? -4 - (i % 2) * 8 : size - little - 2))
        .w(little).h(little).cursor_pointer().tooltip(`${kid} · sub-agent of ${name}`)
        .on_click(() => { run("agent.focus", { terminal: a.address }); })
        .child(image(small ? `${ART}/${this.scene.look}-${suit}-${small}.svg` : `${ART}/${this.scene.look}-follower.svg`).w(little).h(little).opacity(dim ? 0.5 : 0.9));
    });
    const more = kids.length > FOLLOWERS ? [div().absolute().left(42 + back[0] * (BEHIND + FOLLOWERS * TRAIL) * k - 10).top(14 + Math.round(back[1] * back[0] * (BEHIND + FOLLOWERS * TRAIL) * k) + (chair ? 8 : size - 16))
      .w(20).text_size(10).text_color(t.muted).child(`+${kids.length - FOLLOWERS}`)] : [];
    return div().id(`crew-${a.address}-${chair ? "chair" : pose.startsWith("rest") ? "seat" : "foot"}`).absolute().left(x - 42).top(y - 14)
      .transition("left", { duration: STEP, easing: "linear" }).transition("top", { duration: STEP, easing: "linear" })
      .children(trail).children(more)
      // The wing is drawn at the figure's scale: its lines end at the flying skier's hands.
      .when(wing, (el) => el.child(image(`${ART}/ski-${suit}-wing.svg`).absolute().left(42 - (56 * size) / 64).top(14 - (24 * size) / 64).w((112 * size) / 64).h((50 * size) / 64)))
      .child(div().relative().child(body).when(bounce > 0, (el) => el.loop("top", { from: 0, to: -4, period: bounce })));
  }

  // The names of an agent's running sub-agents: what each was asked to do.
  followers(a) {
    const mine = terminals().filter((k) => k.parent === a.address && k.state === "live" && k.program?.agent).map((k) => k.title || k.name || k.program?.name || "agent");
    return [...(shared("over9k.subs")?.[a.address] ?? []).map((x) => x.desc || "subagent"), ...mine];
  }

  render() {
    const t = theme(), s = this.scene, k = s?.k ?? 1;
    // The slope of a line at one of its points, for the followers behind a figure there.
    const slope = (line, i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)]; return (b[1] - a[1]) / (b[0] - a[0] || 1); };
    const frame = div().id("crew").size_full().relative().overflow_hidden().rounded(6).bg(t.chrome).border_1().border_color(t.border);
    if (!s) return frame;
    const list = agents(), ms = Date.now();
    const wanting = list.filter((a) => a.status === "blocked" || a.status === "done");
    const idle = list.filter((a) => !["working", "blocked", "done"].includes(a.status));
    // On the mountain: whoever is on a lap, working or on its way down to tell me something.
    // One that just started working is at the station at once: its lap only begins with the next
    // step, and until then it would be drawn as one more on the benches, gliding about there.
    const onLap = (a) => this.lap[a.address] !== undefined || a.status === "working";
    const queue = wanting.filter((a) => !onLap(a)), seated = idle.filter((a) => !onLap(a));

    const inFront = new Set();
    // Whoever comes back to the benches walks there first, and only then sits down; whoever
    // leaves them stands up at its seat first, and walks from there.
    for (const a of list) {
      if (!seated.includes(a)) this.out.add(a.address);
      else if (this.out.delete(a.address)) this.back[a.address] = ms;
    }
    const rise = (a, x, y) => {
      const from = this.seat[a.address];
      if (!from) return [x, y];
      // Drawn once where it sat, so the walk has somewhere to start.
      if (from[2] === undefined) { from[2] = ms; return [from[0], from[1]]; }
      if (ms - from[2] < 100) return [from[0], from[1]];
      delete this.seat[a.address];
      return [x, y];
    };
    this.wet = (s.sky?.mm ?? 0) >= 0.1;
    const afoot = s.flat ? "walk" : s.look === "ski" ? "carve" : "down";
    const figures = list.map((a) => {
      const wants = a.status === "blocked" || a.status === "done";
      // Sub-agents running, in the ski season: the wing, on its back or over its head.
      const winged = s.look === "ski" && a.status === "working" && this.followers(a).length > 0;
      if (onLap(a)) {
        const at = this.lap[a.address] ?? 0, stuck = a.status === "blocked";
        // On foot to the station first: a chair only ever hangs from the cable.
        if (at === 0) return this.figure(a, afoot, ...rise(a, s.start ?? s.lift[0][0], VALLEY - SIZE + 4), t, { wants });
        // In the flat scenes a step says its own pose, and its height is the ground's, not a cable's.
        if (at <= s.lift.length && s.flat) return this.figure(a, s.lift[at - 1][2], s.lift[at - 1][0], s.lift[at - 1][1] - SIZE + 4, t, { wants });
        if (at <= s.lift.length) return this.figure(a, winged ? "pack" : "working", s.lift[at - 1][0], s.lift[at - 1][1], t, { wants, back: [-1, slope(s.lift, at - 1)] });
        const leg = at - 1 - s.lift.length, [x, y] = s.down[leg];
        if (s.flat) return this.figure(a, stuck ? s.stuck : s.down[leg][2], x, y - SIZE + 4, t, { wants, back: [1, 0] });
        // In the air over the jump, unless it sits there waiting for me.
        const air = !stuck && leg === s.jump ? 30 : 0;
        // They come down from the right, so behind is uphill.
        if (winged) return this.figure(a, "fly", x, y - SIZE + 4 - air - FLIGHT, t, { wants, wing: true });
        return this.figure(a, stuck ? "stuck" : "down", x, y - SIZE + 4 - air, t, { wants, back: [1, slope(s.down, leg)] });
      }
      if (wants) {
        const i = queue.indexOf(a);
        return this.figure(a, a.status, ...rise(a, (s.queue ?? QUEUE) + i * 58, VALLEY - SIZE + 4), t, { wants: true, bounce: 420 + (i % 3) * 60 });
      }
      // On the benches, without names. Up to four share one bench; more sit in two rows, the
      // front row one fewer and in the gaps of the back row, so every face shows. Many: closer and smaller.
      const i = seated.indexOf(a), rear = seated.length > 4 ? Math.ceil((seated.length + 1) / 2) : seated.length, near = seated.length - rear;
      const gap = Math.min(44, (BENCHES[1] - BENCHES[0]) / Math.max(1, rear - 1));
      const size = Math.round(Math.min(48, Math.max(30, gap * 1.5))), ski = s.look === "ski", front = i >= rear;
      if (front) inFront.add(a.address);
      const x = BENCHES[0] + (front ? (i - rear) + (rear - near) / 2 : i) * gap;
      this.seat[a.address] = [x, VALLEY + (front ? FRONT : 0) - SIZE + 4];
      if (ms - (this.back[a.address] ?? 0) < STEP) return this.figure(a, afoot, ...this.seat[a.address], t, { named: false });
      const pose = ski ? `rest-${DRINKS[(hash(a.address) >>> 3) % DRINKS.length]}` : front && s.look === "beach" ? "rest-open" : "rest";
      // On the beach the front row has no parasols: they would stand in front of the back row's faces.
      return this.figure(a, pose, x, VALLEY + (front ? FRONT : 0) - size + 4, t, { size, dim: true, named: false, steam: ski || Boolean(s.steam) });
    });
    // In rain or snow one big umbrella stands over the benches, as wide as the back row, its
    // rim just over their heads (over the parasols on the beach). It is drawn behind everybody.
    const shelter = [];
    if (this.wet && seated.length) {
      const rear = seated.length > 4 ? Math.ceil((seated.length + 1) / 2) : seated.length, gap = Math.min(44, (BENCHES[1] - BENCHES[0]) / Math.max(1, rear - 1));
      const size = Math.round(Math.min(48, Math.max(30, gap * 1.5))), wide = (rear - 1) * gap + size + 40, tall = wide * 0.28;
      const mid = BENCHES[0] + ((rear - 1) * gap) / 2, rim = VALLEY - size + 4 + (s.look === "beach" ? 0 : size * 0.3) - 2;
      shelter.push(div().absolute().left((mid - 1.5) * k).top((rim - tall + 4) * k).w(3 * k).h((VALLEY + 4 - rim + tall - 4) * k).rounded(1).bg("#6b4a2f"),
        image(`${ART}/umbrella-big.svg`).absolute().left((mid - wide / 2) * k).top((rim - tall) * k).w(wide * k).h(tall * k));
    }
    // The front row is drawn over the back row.
    const drawn = [...figures.filter((_, i) => !inFront.has(list[i].address)), ...figures.filter((_, i) => inFront.has(list[i].address))];

    // What falls from the sky right ms, more of it when it pours. Every drop only ever
    // goes down. It lives three steps: one waiting, hardly visible, at the top edge (it
    // has to be inside the strip, or Herdr does not animate it), then two in which it
    // falls through the strip, slanting with the wind. Each starts at its own moment
    // anywhere in a whole step, so the rain neither comes down in rows nor thins out
    // between steps. Then a fresh one takes its place. Snow does the same, slowly.
    const mm = s.sky?.mm ?? 0, snow = Boolean(s.sky?.snow);
    const count = !this.wet ? 0 : Math.round(Math.min(1, 0.4 + mm / 4) * (this.width / (snow ? 12 : 3.2)));
    const fall = snow ? 2800 : 1000;
    const falling = Array.from({ length: count }, (_, i) => {
      const life = Math.floor((this.tick + i) / 3), going = (this.tick + i) % 3 > 0;
      // A new place, moment and look for every life, well scrambled, so the rain does not repeat or line up.
      let seed = Math.imul(i + 1, 2654435761) ^ Math.imul(life + 1, 1597334677);
      seed = Math.imul(seed ^ (seed >>> 15), 2246822519); seed = (seed ^ (seed >>> 13)) >>> 0;
      const x = seed % (this.width + 60), wait = (seed >>> 8) % STEP, near = (seed >>> 20) % 3;
      const drift = snow ? ((seed % 3) - 1) * 18 : -40;
      return div().id(`fall-${i}-${life}`).absolute().left(going ? x + drift : x).top(going ? H * k + 20 : snow ? seed % 40 : 0)
        .opacity(going ? (snow ? 0.85 : 0.26 + near * 0.11) : 0.02)
        .transition("top", { duration: fall, delay: wait, easing: "linear" }).transition("left", { duration: fall, delay: wait, easing: "linear" })
        .transition("opacity", { duration: 60, delay: wait })
        .map((el) => (snow ? el.size(3 + (seed % 2)).rounded(2).bg("#f4f7f8") : el.w(1.5).h(going ? 8 + near * 4 : 1).rounded(1).bg("#d7e8f1")));
    });
    const now = new Date();

    return frame
      .when(Boolean(s.before), (el) => el.child(image(`${SCENES}/${s.before}.svg`).absolute().left(0).top(0).w(this.width).h(Math.round(H * k))))
      .child(image(`${SCENES}/${s.key}.svg`).absolute().left(0).top(0).w(this.width).h(Math.round(H * k)))
      .children(falling)
      // The clock, as in Stardew Valley: a wooden box with the day and the time on parchment, and
      // the season's sign beside them.
      .child(h_flex().absolute().left(12).top(k < 1 ? 4 : 8).p(4).gap(4).rounded(7).bg("#a8672c").border_2().border_color("#3a2313").text_color("#3a2313").font_semibold()
        .child(v_flex().gap(3)
          .child(div().w(k < 1 ? 70 : 88).px(6).rounded(3).bg("#f8e7b4").text_size(k < 1 ? 11 : 14).child(`${DAYS[now.getDay()].slice(0, 3)}. ${now.getDate()}`))
          .child(div().w(k < 1 ? 70 : 88).px(6).rounded(3).bg("#f8e7b4").text_size(k < 1 ? 11 : 14).child(now.toTimeString().slice(0, 8))))
        .child(h_flex().w(k < 1 ? 30 : 40).items_center().justify_center().rounded(3).bg("#f8e7b4")
          .child(image(`${ART}/clock-${s.look === "alp" ? "valley" : s.look}.svg`).w(k < 1 ? 20 : 28).h(k < 1 ? 20 : 28))))
      .children(shelter)
      .children(drawn)
      .when(!list.length, (el) => el.child(div().absolute().left(560 * k).top((VALLEY - 16) * k).text_size(11).text_color(t.dim).child(s.empty ?? "Nobody on the mountain: start an agent and it takes the lift.")));
  }
}
