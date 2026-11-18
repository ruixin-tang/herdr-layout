import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, theme, run, shared, layout, appHome, readTextFile, exec, checking } from "herdr";

// The crew on a mountain seen from the side, in a strip above the terminals.
// Every agent is a small figure, and where it is says what it does:
//   working -> a lap of the mountain: up on the chairlift, then down the slope
//              (over the jump on the plateau, in winter)
//   blocked -> stops where it is with a "!": sitting in the snow, or hanging in
//              its chair. It goes on from there once I have answered.
//   done    -> gets off the lift, heads straight down at double speed with a
//              "!" and waits by the orange flag in the valley, holding up a star
//   idle    -> on a bench beside the hut, at the far left of the valley, dimmed
// Nobody flies: on the mountain they follow the lift and the slope, in the
// valley they walk along the floor.
// Once I have looked at a done agent Herdr makes it idle, so it walks to the hut.
// A click goes to that agent. Its colour stays with its terminal.
// In the ski season (November to March) it is a ski resort ("ski"), the rest of
// the year the same mountain in summer with hikers ("alp").
// The sky is the real one over where I am (the weather mod's shared "weather.sky"):
// the sun crosses from sunrise to sunset, the moon at night, clouds when it is
// overcast, a darker sky and falling rain or snow when the radar says so; the
// mountain's colours go with the light. A clock sits in the sky, top left.
// The mountain is drawn here, as wide as the strip (the valley on the left, the
// summit station at the right edge), and saved as one picture under data/;
// the figures are <season>-<colour>-<pose>.svg (crew-gen.py and crew-resort.py made them).
const ART = "mods/crew", SCENES = "data/crew-scene";
// Raise this when the mountain is drawn differently: a saved picture is reused by its name.
const DRAWING = 4;
const H = 260, SIZE = 56, STEP = 3000;
const VALLEY = 232, SUMMIT = 84;
// The valley floor, left to right: the hut, its benches, the flag with the queue, the lift station.
const BENCHES = [168, 300], QUEUE = 350, STATION = 400, FLAT = 530;
// The mountain's outline and the lift's cable, drawn 1500 wide; fit() moves them to the strip's width.
const PROFILE = [[0, 232], [470, 232], [530, 222], [700, 172], [760, 166], [880, 124], [1130, 124], [1210, 102], [1340, 84], [1500, 84]];
const CABLE = [[452, 172], [600, 146], [700, 112], [880, 62], [1005, 62], [1130, 62], [1210, 40], [1340, 24], [1404, 24]];
const SUITS = ["pink", "cyan", "gold", "mint", "violet", "ember"];
const LOOKS = {
  ski: { bands: ["#3d6375", "#30525f", "#25424e"], edge: ["#e9f0f2", 5], tree: "#14323a", roof: "#eef3f5" },
  alp: { bands: ["#3f6f4c", "#31593f", "#254635"], edge: ["#8fd16a", 4], tree: "#173f2c", roof: "#a07a55" },
};
const PEAKS = '<path d="M0 110 L90 44 L150 80 L250 8 L330 70 L400 36 L520 110z" fill="FAR"/><path d="M250 8 L226 26 l10 3 6 -6 9 8 8 -7 9 6 9 -4z M400 36 L384 48 l8 2 6 -5 8 6 8 -4z M90 44 L76 55 l8 1 6 -4 8 5 7 -3z" fill="#dfe8ec" opacity=".55"/>';
const STATION_ART = '<rect x="8" y="30" width="56" height="40" fill="#2b4250"/><path d="M2 32 L36 10 L70 32z" fill="#3a5666"/><path d="M2 32 L36 10 L70 32 L64 32 L36 15 L8 32z" fill="ROOF"/>'
  + '<rect x="16" y="40" width="14" height="12" rx="1" fill="#ffd166" opacity=".9"/><path d="M23 40 v12 M16 46 h14" stroke="#2b4250" stroke-width="1"/><rect x="38" y="42" width="18" height="28" rx="1" fill="#16303c"/>';
// Blends two colours: mix("#000000", "#ffffff", 0.25) is a quarter of the way to white.
const mix = (a, b, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;
// The light at a moment: the sky's two colours, how dark the land is, and where the sun or moon stands (0 rising, 1 setting).
function light(sky, now) {
  const HOUR = 3600000, rise = sky?.rise ?? new Date(now).setHours(8, 0, 0, 0), set = sky?.set ?? new Date(now).setHours(17, 0, 0, 0);
  const near = (at) => Math.max(0, 1 - Math.abs(now - at) / (0.7 * HOUR));
  const day = now > rise && now < set, glow = Math.max(near(rise), near(set));
  let top = day ? "#2a5f88" : "#060a15", low = day ? "#6da3c4" : "#101b2e";
  top = mix(top, "#2c2a57", glow * 0.8); low = mix(low, "#d27a4e", glow * 0.85);
  // Overcast greys it, rain or snow darkens it.
  const grey = Math.min(1, (sky?.cloud ?? 0) / 100) * 0.55 + ((sky?.mm ?? 0) >= 0.1 ? 0.2 : 0);
  top = mix(top, day ? "#39434d" : "#0b0f17", grey); low = mix(low, day ? "#5d6a74" : "#141b25", grey);
  const night = day ? 0 : 1 - glow;
  const at = day ? (now - rise) / (set - rise) : now >= set ? (now - set) / (rise + 24 * HOUR - set) : (now + 24 * HOUR - set) / (rise + 24 * HOUR - set);
  return { top, low, day, glow, night, grey, at, shade: (c) => mix(mix(mix(c, "#0a1422", night * 0.55), "#b06a55", glow * 0.16), "#56626b", day ? grey * 0.3 : 0) };
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const hash = (address) => [...address].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const season = () => ([10, 11, 0, 1, 2].includes(new Date().getMonth()) ? "ski" : "alp");

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
  // The sky: its colours, a few stars at night, the sun or the moon on its arc, clouds by how overcast it is.
  const bodyX = Math.round(70 + lit.at * (W - 140)), bodyY = Math.round(150 - Math.sin(Math.PI * lit.at) * 118);
  const veil = 1 - Math.min(0.75, lit.grey);
  const body = lit.day
    ? `<circle cx="${bodyX}" cy="${bodyY}" r="34" fill="#ffd98a" opacity="${(0.18 * veil).toFixed(2)}"/><circle cx="${bodyX}" cy="${bodyY}" r="15" fill="#ffd166" opacity="${veil.toFixed(2)}"/>`
    : `<circle cx="${bodyX}" cy="${bodyY}" r="13" fill="#e9eef2" opacity="${veil.toFixed(2)}"/><circle cx="${bodyX + 6}" cy="${bodyY - 4}" r="12" fill="${lit.top}"/>`;
  const stars = lit.night > 0.3 ? Array.from({ length: Math.round(W / 34) }, (_, i) => `<circle cx="${(i * 7919) % W}" cy="${8 + ((i * 104729) % 120)}" r="${i % 5 === 0 ? 1.4 : 0.9}" fill="#dfe8ec" opacity="${(0.25 + (i % 4) * 0.15) * lit.night * veil}"/>`).join("") : "";
  const cover = Math.min(1, (sky?.cloud ?? 0) / 100), cloudFill = mix(lit.day ? "#e6edf1" : "#4a5563", "#2f3740", (sky?.mm ?? 0) >= 0.1 ? 0.5 : 0);
  const clouds = cover < 0.25 ? "" : Array.from({ length: Math.round((W / 260) * cover) + 1 }, (_, i) => {
    const x = Math.round(((i * 2654435761) % 1000) / 1000 * W), y = 18 + ((i * 97) % 60), w = 70 + ((i * 53) % 60);
    return `<g opacity="${(0.35 + cover * 0.4).toFixed(2)}" fill="${cloudFill}"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="13"/><ellipse cx="${x - w * 0.35}" cy="${y - 9}" rx="${w * 0.4}" ry="12"/><ellipse cx="${x + w * 0.25}" cy="${y - 12}" rx="${w * 0.45}" ry="15"/></g>`;
  }).join("");
  const heaven = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lit.top}"/><stop offset="1" stop-color="${lit.low}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}${body}${clouds}`;
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
    if (checking()) return;
    this.measure(cx);
    // One step of everybody's lap; the figures glide to their next spot by themselves.
    cx.timer.every(STEP, (cx) => { this.tick += 1; this.step(); if (this.tick % 3 === 0) this.measure(cx); cx.notify(); });
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
        const width = Math.max(960, Math.round(win - side - 16 - (panel && !panel.hidden ? (panel.size?.px ?? 368) + 8 : 0)));
        const sky = shared("weather.sky") ?? null, now = Date.now();
        // A new picture every ten minutes, and when rain starts or stops.
        const look = season(), key = `${look}-${width}-${DRAWING}-${Math.floor(now / 600000)}${(sky?.mm ?? 0) >= 0.1 ? "w" : "d"}`;
        if (this.scene?.key !== key) {
          const cafe = (await readTextFile(`${appHome()}/${ART}/ski-cafe.svg`)).trim().replace(/^<svg[^>]*>|<\/svg>$/g, "");
          const m = mountain(width, look, cafe, sky, now);
          await exec("sh", ["-c", 'mkdir -p "$1" && rm -f "$1"/*.svg && printf %s "$3" > "$1/$2"', "sh", `${appHome()}/${SCENES}`, `${key}.svg`, m.svg]);
          this.width = width; this.scene = { ...m, key, look, sky, dark: light(sky, now).night > 0.5 };
          if (!this.started) this.step();
        }
      } catch { /* keeps the last mountain */ }
      cx.notify();
    });
  }

  // One agent at a spot (x: its middle, y: the top of its drawing), gliding there
  // from wherever it was: its drawing, a "!" above when it wants me, its name below.
  figure(a, pose, x, y, t, { size = SIZE, wants = false, dim = false, bounce = 0, drop = 0 } = {}) {
    const name = a.title.replace(/^[^A-Za-z0-9]+/, "") || a.tab_name || a.program?.name || "agent";
    const says = a.status === "done" ? "finished, have a look" : a.status === "blocked" ? "needs your answer" : a.status;
    const body = v_flex().w(84).items_center()
      .child(h_flex().h(14).justify_center().when(wants, (el) => el.child(div().h(14).min_w(14).px(3).flex().items_center().justify_center().rounded(7)
        .text_size(10).font_semibold().bg(t.blocked).text_color(t.accent_foreground).child("!").loop("opacity", { from: 0.4, to: 1, period: 800 }))))
      // Only the drawing itself takes the click: the boxes around two neighbours overlap, the drawings don't.
      .child(div().id(`crew-hit-${a.address}`).w(size).h(size).cursor_pointer().tooltip(`${name} · ${a.space_name} · ${says}`)
        .on_click(() => { run("agent.focus", { terminal: a.address }); })
        .child(image(`${ART}/${this.scene.look}-${SUITS[hash(a.address) % SUITS.length]}-${pose}.svg`).w(size).h(size).when(dim, (el) => el.opacity(0.55))))
      .child(div().w(84).h(13).mt(drop).text_size(10).truncate().text_color(wants ? t.blocked : dim ? t.dim : t.muted).child(name));
    // In a chair it is another element than on foot, so it gets on and off in one go and never glides between cable and ground.
    return div().id(`crew-${a.address}-${pose === "working" ? "chair" : "foot"}`).absolute().left(x - 42).top(y - 14)
      .transition("left", { duration: STEP, easing: "linear" }).transition("top", { duration: STEP, easing: "linear" })
      .child(div().relative().child(body).when(bounce > 0, (el) => el.loop("top", { from: 0, to: -4, period: bounce })));
  }

  render() {
    const t = theme(), s = this.scene;
    const frame = div().id("crew").size_full().relative().overflow_hidden().rounded(6).bg(t.chrome).border_1().border_color(t.border);
    if (!s) return frame;
    const list = agents();
    const wanting = list.filter((a) => a.status === "blocked" || a.status === "done");
    const idle = list.filter((a) => !["working", "blocked", "done"].includes(a.status));
    // On the mountain: whoever is on a lap, working or on its way down to tell me something.
    const onLap = (a) => this.lap[a.address] !== undefined;
    const queue = wanting.filter((a) => !onLap(a)), seated = idle.filter((a) => !onLap(a));

    const figures = list.map((a) => {
      const wants = a.status === "blocked" || a.status === "done";
      if (onLap(a)) {
        const at = this.lap[a.address], stuck = a.status === "blocked";
        // On foot to the station first: a chair only ever hangs from the cable.
        if (at === 0) return this.figure(a, s.look === "ski" ? "carve" : "down", s.lift[0][0], VALLEY - SIZE + 4, t, { wants });
        if (at <= s.lift.length) return this.figure(a, "working", s.lift[at - 1][0], s.lift[at - 1][1], t, { wants });
        const leg = at - 1 - s.lift.length, [x, y] = s.down[leg];
        // In the air over the jump, unless it sits there waiting for me.
        const air = !stuck && leg === s.jump ? 30 : 0;
        return this.figure(a, stuck ? "stuck" : "down", x, y - SIZE + 4 - air, t, { wants });
      }
      if (wants) {
        const i = queue.indexOf(a);
        return this.figure(a, a.status, QUEUE + i * 58, VALLEY - SIZE + 4, t, { wants: true, bounce: 420 + (i % 3) * 60 });
      }
      // On the benches: closer together when there are many, their names on two rows.
      const i = seated.indexOf(a), gap = Math.min(56, Math.max(18, (BENCHES[1] - BENCHES[0]) / Math.max(1, seated.length - 1)));
      return this.figure(a, "rest", BENCHES[0] + i * gap, VALLEY - 48 + 4, t, { size: 48, dim: true, drop: (i % 2) * 12 });
    });

    // What falls from the sky right now, more of it when it pours. Every drop only ever
    // goes down. It lives two steps: one waiting unseen at the top edge (it has to be
    // inside the strip, or Herdr does not animate it), one falling through the strip,
    // slanting with the wind, each starting at its own moment. Then a fresh one takes
    // its place. Snow does the same, slowly.
    const mm = s.sky?.mm ?? 0, snow = Boolean(s.sky?.snow), wet = mm >= 0.1;
    const count = !wet ? 0 : Math.round(Math.min(1, 0.4 + mm / 4) * (this.width / (snow ? 16 : 6)));
    const fall = snow ? 2800 : 1100;
    const falling = Array.from({ length: count }, (_, i) => {
      const life = Math.floor((this.tick + i) / 2), going = (this.tick + i) % 2 === 1;
      // A new place and a new moment for every life, so the rain does not repeat itself.
      const seed = (i * 7919 + life * 104729) >>> 0, x = seed % (this.width + 60), wait = snow ? 0 : seed % (STEP - fall);
      const drift = snow ? ((seed % 3) - 1) * 18 : -30, long = 9 + (seed % 3) * 4;
      return div().id(`fall-${i}-${life}`).absolute().left(going ? x + drift : x).top(going ? H + 20 : snow ? seed % 40 : 0).opacity(going ? (snow ? 0.85 : 0.3 + (seed % 3) * 0.1) : 0.02)
        .transition("top", { duration: fall, delay: wait, easing: "linear" }).transition("left", { duration: fall, delay: wait, easing: "linear" })
        .transition("opacity", { duration: 60, delay: wait })
        .map((el) => (snow ? el.size(3 + (seed % 2)).rounded(2).bg("#f4f7f8") : el.w(1.5).h(long).rounded(1).bg("#cfe3ee")));
    });
    const now = new Date();

    return frame
      .child(image(`${SCENES}/${s.key}.svg`).absolute().left(0).top(0).w(this.width).h(H))
      .children(falling)
      // The clock: the time large, the day under it.
      .child(v_flex().absolute().left(16).top(8).text_color("#f4f7f8")
        .child(div().text_size(28).font_semibold().child(now.toTimeString().slice(0, 5)))
        .child(div().text_size(11).opacity(0.8).child(`${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`)))
      .children(figures)
      .when(!list.length, (el) => el.child(div().absolute().left(560).top(VALLEY - 16).text_size(11).text_color(t.dim).child("Nobody on the mountain: start an agent and it takes the lift.")));
  }
}
