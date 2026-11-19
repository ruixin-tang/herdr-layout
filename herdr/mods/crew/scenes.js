import { heaven } from "./sky.js";

// The three scenes that are not the mountain, each drawn as wide as the strip:
//   valley  (April to June)        a café, a shipping bin, a field, and a mine in the cliff
//   beach   (July and August)      a beach, a pier, open water with a buoy, a lighthouse
//   orchard (September to November) a farmhouse with a fire, a market stall, a cart, apple trees
// Each gives back what the mountain gives: the picture, and a lap of two halves (`lift`
// out, `down` back), here as [x, the ground there, the pose]. On top of that:
//   start   where a working agent sets off on foot
//   queue   where the done and blocked ones wait
//   stuck   the pose of a blocked one on its way back
//   steam   whether the idle ones' drink steams
//   empty   what to say when there is nobody
// Everybody stays on the ground (or the water): the ladder, the hoe and the boat are
// part of the figures' drawings.
const H = 260, G = 232;
// n + 1 places at equal steps from a to b.
const spread = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => Math.round(a + ((b - a) * i) / n));
const house = (cafe, roof) => `<g transform="translate(8,${G - 90})">${cafe.replaceAll('"#eef3f5"', `"${roof}"`)}</g>`;
// Rolling hills behind the ground, one row per colour.
const hills = (W, rows) => rows.map(([fill, dy], i) => {
  const from = -200 + i * 170, humps = [];
  for (let x = from, j = 0; x < W; x += 520, j++) humps.push(`Q${x + 260} ${G - 150 + dy - (j % 2) * 30} ${x + 520} ${G - 40 + dy}`);
  return `<path d="M${from} ${G - 40 + dy} ${humps.join(" ")} V${H} H${from}z" fill="${fill}"/>`;
}).join("");
const ground = (W, top, low, edge) => `<rect y="${G}" width="${W}" height="${H - G}" fill="${top}"/><rect y="${G + 14}" width="${W}" height="${H - G}" fill="${low}"/><path d="M0 ${G} H${W}" stroke="${edge}" stroke-width="4"/>`;
const tree = (x, crown, r, fruit) => `<rect x="${x - 3}" y="${G - 36}" width="6" height="36" fill="#5a3f30"/><circle cx="${x}" cy="${G - 36 - r * 0.7}" r="${r}" fill="${crown}"/><circle cx="${x - r * 0.3}" cy="${G - 36 - r * 0.95}" r="${r * 0.5}" fill="#ffffff" opacity=".1"/>`
  + (fruit ? [[-0.5, -0.2], [0.15, -0.5], [0.5, 0.15], [-0.15, 0.3], [0, -0.05]].map(([dx, dy]) => `<circle cx="${x + dx * r}" cy="${G - 36 - r * 0.7 + dy * r}" r="3.2" fill="${fruit}"/>`).join("") : "");

function valley(W, S, cafe) {
  const mine = W - 190, field = [620, Math.round(W * 0.56)];
  const out = spread(540, mine - 46, 12), back = spread(mine - 46, 540, 12);
  const rows = [];
  for (let x = field[0] + 12, i = 0; x < field[1] - 8; x += 26, i++) {
    rows.push(i % 2
      ? `<path d="M${x} ${G - 3} v-12" stroke="${S("#3f8f3a")}" stroke-width="2.4"/><circle cx="${x}" cy="${G - 17}" r="5" fill="${S(["#ff6b6b", "#ffd166", "#f29ac0"][i % 3])}"/>`
      : `<path d="M${x} ${G - 3} v-8 M${x} ${G - 9} q7 -6 9 -1 M${x} ${G - 7} q-7 -6 -9 -1" stroke="${S("#58b04a")}" stroke-width="2.4" fill="none"/>`);
  }
  const blossom = [];
  for (let x = field[1] + 90, i = 0; x < mine - 300; x += 150, i++) blossom.push(tree(x, S(["#f4a6c8", "#8fd16a", "#f7c6da"][i % 3]), 24));
  const svg = hills(W, [[S("#8fc47a"), 0], [S("#7ab567"), 40]])
    + `<path d="M${W - 420} ${G} L${W - 368} 96 L${W - 200} 70 L${W} 60 V${G}z" fill="${S("#7d7468")}"/><path d="M${W - 368} 96 L${W - 200} 70 L${W} 60 V74 L${W - 200} 84 L${W - 360} 110z" fill="${S("#a9df7c")}"/>`
    + [[W - 330, 150], [W - 90, 120], [W - 60, 190], [W - 310, 200]].map(([x, y]) => `<path d="M${x} ${y} h26" stroke="${S("#665d52")}" stroke-width="4" stroke-linecap="round"/>`).join("")
    + ground(W, S("#6fa85a"), S("#5c9450"), S("#a9df7c"))
    + `<path d="M0 ${G + 14} H${W}" stroke="${S("#e2c08a")}" stroke-width="9"/>`
    // The mine: a timbered mouth, a lamp beside it, a cart on its rails.
    + `<path d="M${mine - 40} ${G} v-62 q40 -34 80 0 v62z" fill="#1c1410"/><path d="M${mine - 46} ${G} v-64 q46 -40 92 0 v64" stroke="${S("#6b4a36")}" stroke-width="7" fill="none"/><circle cx="${mine + 60}" cy="${G - 62}" r="5" fill="#ffd166"/>`
    + `<path d="M${mine - 150} ${G + 6} H${mine + 30}" stroke="${S("#4a352b")}" stroke-width="2"/><rect x="${mine - 150}" y="${G - 16}" width="34" height="18" rx="3" fill="${S("#5d6b70")}"/><circle cx="${mine - 142}" cy="${G + 5}" r="4" fill="#2b2b2b"/><circle cx="${mine - 124}" cy="${G + 5}" r="4" fill="#2b2b2b"/>`
    + house(cafe, S("#b0563f"))
    // The shipping bin, where the done ones wait.
    + `<rect x="326" y="${G - 26}" width="40" height="26" rx="3" fill="${S("#8a5a36")}"/><rect x="322" y="${G - 32}" width="48" height="9" rx="3" fill="${S("#a9703f")}"/><rect x="342" y="${G - 18}" width="8" height="6" rx="1" fill="#ffd166"/>`
    + `<rect x="${field[0]}" y="${G - 5}" width="${field[1] - field[0]}" height="10" rx="3" fill="${S("#6b4a36")}"/>${rows.join("")}${blossom.join("")}`;
  return {
    svg, start: 520, queue: 398, stuck: "stuck", steam: true, empty: "Nobody in the valley: start an agent and it heads for the field.",
    lift: out.map((x, i) => [x, G, i >= 11 ? "mine" : x > field[0] && x < field[1] ? "hoe" : "walk"]),
    down: back.map((x) => [x, G, "carry"]),
  };
}

function beach(W, S, cafe) {
  const sea = G - 62, buoy = W - 300, pier = [330, 600];
  const out = spread(680, buoy - 40, 12), back = spread(buoy - 40, 680, 12);
  const waves = Array.from({ length: Math.round(W / 50) }, (_, i) => `<path d="M${(i * 211) % W} ${sea + 8 + ((i * 37) % (H - sea - 12))} h18" stroke="${S("#d8f1fb")}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`).join("");
  const posts = spread(pier[0] + 50, pier[1] - 10, 4).map((x) => `<rect x="${x}" y="${G + 7}" width="6" height="${H - G}" fill="${S("#6b4a36")}"/>`).join("");
  const rock = `<path d="M${W - 250} ${H} L${W - 214} ${G - 40} L${W - 80} ${G - 54} L${W} ${G - 40} V${H}z" fill="${S("#6f7b84")}"/>`
    + `<path d="M${W - 170} ${G - 50} L${W - 162} ${G - 162} H${W - 126} L${W - 118} ${G - 52}z" fill="${S("#fbf7ee")}"/><path d="M${W - 166} ${G - 100} H${W - 122} L${W - 121} ${G - 80} H${W - 167}z M${W - 163} ${G - 146} H${W - 125} l1 18 H${W - 164}z" fill="${S("#ff6b6b")}"/>`
    + `<rect x="${W - 168}" y="${G - 180}" width="48" height="20" rx="2" fill="#ffd166"/><path d="M${W - 174} ${G - 178} L${W - 144} ${G - 202} L${W - 114} ${G - 178}z" fill="${S("#ff6b6b")}"/>`;
  const svg = `<rect y="${sea}" width="${W}" height="${H - sea}" fill="${S("#3a8fd0")}"/><rect y="${sea + 26}" width="${W}" height="${H}" fill="${S("#4fa8dc")}"/><rect y="${sea + 58}" width="${W}" height="${H}" fill="${S("#6fc4e2")}"/>${waves}`
    + `<ellipse cx="${Math.round(W * 0.6)}" cy="${H - 6}" rx="90" ry="10" fill="${S("#f3dfa6")}"/>${rock}`
    + `<path d="M${buoy} ${G - 4} v-22" stroke="#16323b" stroke-width="2"/><rect x="${buoy - 8}" y="${G - 16}" width="16" height="20" rx="5" fill="${S("#ff6b6b")}"/><rect x="${buoy - 8}" y="${G - 9}" width="16" height="5" fill="${S("#fbf7ee")}"/>`
    // The beach: a dune behind, flat sand in front that runs under the pier and into the water.
    + `<path d="M0 ${G} V${sea - 6} Q150 ${sea - 46} 300 ${sea + 20} Q360 ${G - 14} 400 ${G}z" fill="${S("#e6cf8c")}"/>`
    + [40, 96, 150, 214].map((x) => `<path d="M${x} ${sea - 14 + (x % 20)} q-3 -14 2 -20 M${x + 5} ${sea - 13 + (x % 20)} q4 -12 9 -16" stroke="${S("#7fae4a")}" stroke-width="2" fill="none"/>`).join("")
    + `<path d="M0 ${G - 2} H400 Q470 ${G + 8} 520 ${H} H0z" fill="${S("#f3dfa6")}"/><path d="M0 ${G - 2} H400 Q470 ${G + 8} 520 ${H}" stroke="${S("#fff3cf")}" stroke-width="4" fill="none"/>`
    + `${posts}<rect x="${pier[0]}" y="${G - 1}" width="${pier[1] - pier[0]}" height="9" rx="2" fill="${S("#a9703f")}"/>`
    + house(cafe, S("#e0624a"));
  return {
    svg, start: pier[1] - 22, queue: 384, stuck: "adrift", steam: false, empty: "Nobody on the beach: start an agent and it sets sail.",
    // Out on the far lane, back on the near one, so boats pass each other.
    lift: out.map((x) => [x, G - 4, "sail"]),
    down: back.map((x) => [x, G + 10, "sailback"]),
  };
}

function orchard(W, S, cafe) {
  // Six trees to pick from: it walks up to each, then stands on its ladder there for a step.
  const stops = spread(770, W - 130, 5), back = spread(W - 60, 640, 12);
  const out = [...stops.flatMap((x) => [[x - 24, G, "walk"], [x - 24, G, "pick"]]), [W - 60, G, "walk"]];
  const leaves = Array.from({ length: Math.round(W / 55) }, (_, i) => `<path d="M${(i * 173) % W} ${40 + ((i * 61) % 170)} q4 -3 7 1 q-4 3 -7 -1z" fill="${S(["#e07b2a", "#c9482b", "#e0a82a"][i % 3])}"/>`).join("");
  // Smaller trees between them, a little further back.
  const trees = stops.slice(1).map((x, i) => tree(Math.round((x + stops[i]) / 2), S(["#8aa63a", "#c9a23a"][i % 2]), 20, S("#e5484d"))).join("")
    + stops.map((x, i) => tree(x, S(["#5f9a3a", "#8aa63a", "#c9a23a"][i % 3]), 28, S("#e5484d"))).join("");
  const pumpkin = (x) => `<ellipse cx="${x}" cy="${G - 8}" rx="13" ry="10" fill="${S("#f0812d")}"/><path d="M${x} ${G - 18} v20 M${x - 6} ${G - 16} q-3 8 0 16 M${x + 6} ${G - 16} q3 8 0 16" stroke="${S("#c9631f")}" stroke-width="1.6" fill="none"/><path d="M${x} ${G - 18} q2 -6 6 -5" stroke="${S("#3f8f3a")}" stroke-width="2.4" fill="none"/>`;
  // The market stall behind the ones who are done: an awning on two posts, a counter with the harvest.
  const stall = `<path d="M346 ${G} V${G - 84} M566 ${G} V${G - 84}" stroke="${S("#6b4a36")}" stroke-width="6"/><rect x="340" y="${G - 30}" width="232" height="30" rx="3" fill="${S("#a9703f")}"/>`
    + Array.from({ length: 10 }, (_, k) => `<path d="M${334 + k * 24.4} ${G - 94} h24.4 v22 q-12.2 9 -24.4 0z" fill="${S(k % 2 ? "#e5484d" : "#fbf7ee")}"/>`).join("")
    + Array.from({ length: 15 }, (_, k) => `<circle cx="${356 + k * 14.6}" cy="${G - 34}" r="6" fill="${S(["#e5484d", "#f0812d", "#e0a82a"][k % 3])}"/>`).join("");
  const cart = `<rect x="596" y="${G - 30}" width="74" height="22" rx="3" fill="${S("#8a5a36")}"/><path d="M670 ${G - 20} h26" stroke="${S("#5a3f30")}" stroke-width="4"/>`
    + Array.from({ length: 7 }, (_, k) => `<circle cx="${604 + k * 10}" cy="${G - 32 - (k % 2) * 4}" r="5" fill="${S(k % 3 ? "#e5484d" : "#e0a82a")}"/>`).join("")
    + [612, 654].map((x) => `<circle cx="${x}" cy="${G - 6}" r="11" fill="${S("#5a3f30")}"/><circle cx="${x}" cy="${G - 6}" r="4.5" fill="${S("#c98d4f")}"/>`).join("");
  const svg = hills(W, [[S("#d2a24c"), 0], [S("#c08a3e"), 40]]) + leaves
    + ground(W, S("#9a9a44"), S("#84853a"), S("#cdd070"))
    + `<path d="M0 ${G + 14} H${W}" stroke="${S("#e2c08a")}" stroke-width="9"/>`
    + trees + house(cafe, S("#7a4a2c")) + stall + cart + [W - 44, W - 16].map(pumpkin).join("")
    // The fire the idle ones sit by.
    + `<path d="M140 ${G} l10 -6 M162 ${G} l-10 -6" stroke="${S("#5a3f30")}" stroke-width="5" stroke-linecap="round"/><path d="M151 ${G - 5} q-10 -14 0 -28 q10 14 0 28z" fill="#ff9a3c"/><path d="M151 ${G - 5} q-5 -8 0 -16 q5 8 0 16z" fill="#ffd166"/>`;
  return {
    svg, start: 640, queue: 384, stuck: "stuck", steam: true, empty: "Nobody in the orchard: start an agent and it goes picking.",
    lift: out,
    down: back.map((x) => [x, G, "carry"]),
  };
}

// The scene `look` at width W under this sky, in the same shape as the mountain.
export function land(W, look, cafe, sky, lit) {
  const s = { valley, beach, orchard }[look](W, lit.shade, cafe);
  return { ...s, jump: -1, flat: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${heaven(W, H, sky, lit)}${s.svg}</svg>` };
}
