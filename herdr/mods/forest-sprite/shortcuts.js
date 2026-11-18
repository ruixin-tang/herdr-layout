import { focused, spaces, agents, keys, layout, shared, setShared } from "herdr";

// Shortcut training. The sprite watches what I do in the window (another space or tab,
// a new tab, a split, a zoom) and whether a mouse press came just before it:
//   done by clicking -> it shows the key that does the same, and how often I clicked today
//   done by key      -> a short cheer with that key
// Three things have keys of my own (keys.json): going to the agent that needs me, My work,
// and starting the dev stacks; clicking my way to those is answered with those keys.
// The keys are read from keys.json as it is now, so a rebound key is taught as rebound.
// Today's counts are shared as "shortcuts.today" ({ day, by: { <action>: { click, key } } }).
// It cannot see who did it: a tab an agent or a script opened counts as done by key.
const CLICK = 1500, HINT = 8000, CHEER = 2500;
const GLYPH = { cmd: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧", enter: "↩", left: "←", right: "→", up: "↑", down: "↓", tab: "⇥" };
// "cmd-shift-]" as a Mac writes it: "⇧⌘]".
export function pretty(key) {
  const parts = key.endsWith("--") ? [...key.slice(0, -2).split("-"), "-"] : key.split("-");
  const last = parts.pop(), mods = ["ctrl", "alt", "shift", "cmd"].filter((m) => parts.includes(m));
  return mods.map((m) => GLYPH[m]).join("") + (GLYPH[last] ?? last.toUpperCase());
}
const keyFor = (action) => keys().find((k) => k.section === "global" && k.action === action)?.keys;

// What the window shows now, as far as the training goes.
function look() {
  const f = focused();
  if (!f) return null;
  const all = spaces(), space = all.find((s) => s.id === f.space), tab = space?.tabs.find((t) => t.id === f.tab);
  const find = (n, id) => n && (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
  const panel = find(layout(), "panel");
  return {
    // The panes of the agents that want me, My work showing, and how many stacks run in Herdr.
    wanting: agents().filter((a) => a.status === "blocked" || a.status === "done").map((a) => a.pane),
    work: Boolean(panel && !panel.hidden && find(panel, "panel-body")?.active === "my-work"),
    stacks: Object.values(shared("dev-servers.state") ?? {}).filter((s) => s.terminal).length,
    space: f.space, spaceIndex: space?.index, spaces: all.length, tab: f.tab, tabIndex: tab?.index, tabs: space?.tabs.length ?? 0, pane: f.pane, panes: tab?.panes ?? 0, zoomed: Boolean(tab?.zoomed),
  };
}

// What happened between two looks: [the commands that do it, what to call it, cheer when done by key].
// Things that also happen by themselves (a pane closing when its program ends) are never cheered.
function what(a, b) {
  if (b.pane !== a.pane && a.wanting.includes(b.pane)) return [["forest-sprite.needs-me"], "the agent that needs you", true];
  if (b.work !== a.work) return [["forest-sprite.my-work"], b.work ? "My work" : "putting My work away", true];
  if (b.stacks > a.stacks) return [["dev-servers.start-all"], "starting the stacks", false];
  if (b.spaces > a.spaces) return [["space.new"], "a new space", true];
  if (b.space !== a.space) return b.spaces < a.spaces ? null : [b.spaceIndex <= 9 ? [`space.select:${b.spaceIndex}`] : ["space.prev", "space.next"], "this space", true];
  if (b.tabs > a.tabs) return [["tab.new"], "a new tab", true];
  if (b.tabs < a.tabs) return [["tab.close"], "closing a tab", false];
  if (b.tab !== a.tab) return [b.tabIndex <= 9 ? [`tab.select:${b.tabIndex}`] : ["tab.prev", "tab.next"], "this tab", true];
  if (b.panes > a.panes) return [["pane.split:right", "pane.split:down"], "a split, right or down", true];
  if (b.panes < a.panes) return [["pane.close"], "closing a pane", false];
  if (b.zoomed !== a.zoomed) return [["pane.zoom"], b.zoomed ? "zooming a pane" : "unzooming it", true];
  if (a.pane && b.pane && b.pane !== a.pane) return [["pane.go:left"], "the pane beside it", true, true];
  return null;
}

export class Trainer {
  constructor() {
    this.pressed = 0; this.before = null; this.note = null;
    try { this.stats = JSON.parse(localStorage.getItem("shortcuts")); } catch { /* starts empty */ }
  }

  // A mouse press anywhere in the window.
  press() { this.pressed = Date.now(); }

  // On every redraw: compares with the last look and leaves a note for the sprite.
  watch() {
    const now = look(), before = this.before;
    this.before = now;
    const found = now && before && what(before, now);
    if (!found) return;
    const [actions, label, cheer, arrows] = found, shown = actions.map(keyFor).filter(Boolean).map(pretty);
    if (!shown.length) return;
    const clicked = Date.now() - this.pressed < CLICK;
    this.pressed = 0;
    if (!clicked && !cheer) return;
    const day = new Date().toDateString(), kind = actions[0].split(":")[0];
    if (this.stats?.day !== day) this.stats = { day, by: {} };
    const count = this.stats.by[kind] ??= { click: 0, key: 0 };
    count[clicked ? "click" : "key"] += 1;
    localStorage.setItem("shortcuts", JSON.stringify(this.stats));
    setShared("shortcuts.today", JSON.parse(JSON.stringify(this.stats)));
    // The four pane keys differ only in their arrow.
    const key = arrows ? `${shown[0].slice(0, -1)} + arrow` : shown.join(" or ");
    this.note = { clicked, key, label, clicks: count.click, until: Date.now() + (clicked ? HINT : CHEER) };
  }

  // Something to say for a moment that is not about a key.
  tell(text) { this.note = { text, until: Date.now() + CHEER }; }

  // The note to show now, if any.
  current() { return this.note && Date.now() < this.note.until ? this.note : null; }

  // True once: the note has run out and the sprite should be drawn again.
  over() {
    if (!this.note || Date.now() < this.note.until) return false;
    this.note = null;
    return true;
  }
}
