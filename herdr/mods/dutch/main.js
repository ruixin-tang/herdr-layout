import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, checking, shared, setShared, props, closeOverlay, notify, appHome, readTextFile } from "herdr";

// The Dutch lesson, as a dialog over the whole window: every day my calendar has a
// "Dutch" event, the forest sprite opens this when it starts, and it stays in the way
// until the lesson is over. How much that is depends on where I am (the weather mod knows):
//   at the office   the NOS Journaal in Makkelijke Taal, WATCH minutes: I have a train to catch
//   at home         the whole Journaal, then QUIZ of its words (each one until I have it right),
//                   then LISTEN minutes of a slow podcast on Xitun
//   by itself       however it is opened, the Journaal opens at once in a new Chrome window
//                   over the middle of this dialog: nothing to click. It is the last episode
//                   from before today, and its hard words (words.sh, run by the sprite) stand
//                   beside the video in the order they are said. Every other screen is covered
//                   (cover.swift) and shows the same word list, large. When the lesson is over
//                   the streak grows and the workspace and the screens come back
//   Esc             only snoozes: the sprite opens it again a few minutes later
//   "Niet vandaag"  asks twice, then lets me go and ends the streak
//   props.refresh   the next morning (the sprite): REFRESH of yesterday's words as a quiz, the
//                   ones I had wrong first. No video, nothing covered, Esc is fine
//   props.look      only the list, with the sentences (the sprite's "words" command)
// The state is shared as "dutch": { day, openedAt, closedAt, watchAt, watchMs, plan, stage,
// stageAt, done, skipped, streak, last, learned, missed, refreshed, refreshAsked }.
// Sound: a quiz says each word when it comes up; a click on a word or a sentence, anywhere, says it.
// The list of episodes, for when there is no word list (which knows the episode itself).
const URL = "https://npo.nl/start/serie/nos-journaal-in-makkelijke-taal/afleveringen";
// Dutch Today (slow, about 6 minutes an episode, text and translation with it).
const LISTEN_URL = "https://xitun.ltd/my/nl/daily-listening?view=show&source=1f221b58-74bf-4adc-a2c3-64799ea612c1";
const WATCH = 8 * 60000, LISTEN = 6 * 60000, QUIZ = 5, REFRESH = 8;
// props.demo (the sprite's "demo" command): the whole lesson at home in two minutes, to show it.
// It keeps its own state, so today's real lesson, the streak and the learned words stay as they are.
const demo = () => Boolean(props()?.demo), KEY = () => (demo() ? "dutch.demo" : "dutch");
const T = () => (demo() ? { watch: 45000, listen: 20000, quiz: 3 } : { watch: WATCH, listen: LISTEN, quiz: QUIZ });
const WORDS = () => `${appHome()}/data/dutch/words.json`, LEARNED = () => `${appHome()}/data/dutch/learned.json`;
// cover.swift, built into data/dutch/cover when the source is newer. "news" lays a page over the
// dialog (plain `open` if that fails), "close" takes it away, "dark" covers the other screens
// (one cover at a time), "stop" ends that.
const cover = (...args) => exec("sh", ["-c", `src="$1/mods/dutch/cover.swift"; bin="$1/data/dutch/cover"; shift
  case "$1" in dark|stop) pkill -f "[d]ata/dutch/cover dark";; esac; [ "$1" = stop ] && exit 0
  [ "$bin" -nt "$src" ] || { mkdir -p "$(dirname "$bin")" && swiftc -O "$src" -o "$bin"; } || { [ "$1" = news ] && open "$2"; exit 1; }
  "$bin" "$@" || { [ "$1" = news ] && open "$2"; }`, "sh", appHome(), ...args.map(String)], { timeout: 1200000 }).catch(() => null);
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
// The working day before a day, as a date string: a streak runs over the weekend.
const before = (day) => { const d = new Date(day); do d.setDate(d.getDate() - 1); while (d.getDay() % 6 === 0); return d.toDateString(); };
const shuffled = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const meaning = (x) => [x.zh, x.en].filter(Boolean).join(" · ");
// Said out loud by a Dutch voice of the Mac, a little slower than it talks by itself: Claire
// (Enhanced), which I downloaded in System Settings, or else Xander, who is always there. A new
// word or sentence cuts off the one still being said.
const say = (text) => { if (text) exec("sh", ["-c", 'pkill -x say; say -v "Claire (Enhanced)" -r 150 "$1" 2>/dev/null || say -v Xander -r 150 "$1"', "sh", text], { timeout: 60000 }).catch(() => null); };
const load = async (path) => { try { return JSON.parse(await readTextFile(path)); } catch { return null; } };

export default class Dutch extends View {
  init(_props, cx) {
    this.armed = false; this.quiz = null;
    if (checking()) return;
    // Only the words: no lesson, no video, no covered screens.
    if (props()?.look) { cx.spawn(async (cx) => { this.words = await load(WORDS()); cx.notify(); }); return; }
    if (props()?.refresh) {
      this.set({ refreshAsked: new Date().toDateString() });
      cx.spawn(async (cx) => { this.words = await load(LEARNED()); this.ask(REFRESH, shared(KEY())?.missed ?? []); cx.notify(); });
      return;
    }
    const day = new Date().toDateString(), was = shared(KEY()) ?? {};
    // A new day starts clean; the streak, its last day and yesterday's words come along.
    this.set(was.day === day && !demo() ? { openedAt: Date.now() } : { day, openedAt: Date.now(), closedAt: 0, watchAt: null, stage: null, stageAt: 0, plan: null, done: false, skipped: false });
    cx.spawn(async (cx) => {
      this.words = await load(WORDS());
      if (!shared(KEY())?.watchAt) {
        const plan = demo() || shared("my-work.place") === "home" ? "home" : "office";
        // At home to the end of the episode (and a little for the page to start), else the fixed time.
        this.set({ watchAt: Date.now(), stage: "watch", plan, watchMs: plan === "home" && this.words?.seconds && !demo() ? (this.words.seconds + 20) * 1000 : T().watch });
        cover("news", this.words?.url ?? URL);
      }
      this.enter();
      cx.notify();
    });
    // The countdown, and the step to the next part.
    cx.timer.every(1000, (cx) => {
      const s = shared(KEY()) ?? {}, now = Date.now();
      if (!s.done && s.stage === "watch" && s.watchAt && now - s.watchAt >= (s.watchMs ?? T().watch)) {
        if (s.plan === "home" && (this.words?.words?.length ?? 0) >= 4) { this.set({ stage: "quiz" }); cover("close"); this.enter(); }
        else this.finish();
      }
      if (!s.done && s.stage === "listen" && now - s.stageAt >= T().listen) this.finish();
      cx.notify();
    });
  }

  set(change) { setShared(KEY(), { ...(shared(KEY()) ?? {}), ...change }); }

  // What the part I am in needs, also when the dialog comes back after a snooze: the other
  // screens covered for as long as it lasts (with the words only while the Journaal plays).
  enter() {
    const s = shared(KEY()) ?? {}, now = Date.now(), secs = (ms) => Math.ceil(ms / 1000) + 2;
    if (s.done) return;
    if (s.stage === "watch" && s.watchAt + (s.watchMs ?? T().watch) > now) cover("dark", secs(s.watchAt + (s.watchMs ?? T().watch) - now), WORDS());
    if (s.stage === "quiz") { cover("dark", 900); if (!this.quiz) this.ask(T().quiz, []); }
    if (s.stage === "listen" && s.stageAt + T().listen > now) cover("dark", secs(s.stageAt + T().listen - now));
  }

  // A quiz of n words from the list, the ones in `first` before the others.
  ask(n, first) {
    const all = this.words?.words ?? [];
    if (all.length < 4) { this.quiz = null; return; }
    const items = [...shuffled(all.filter((x) => first.includes(x.nl))), ...shuffled(all.filter((x) => !first.includes(x.nl)))].slice(0, n);
    this.quiz = { all, items, total: items.length, i: 0, wrong: false, missed: [] };
    this.choices();
  }

  choices() {
    const q = this.quiz, word = q.items[q.i];
    q.options = shuffled([word, ...shuffled(q.all.filter((x) => x.nl !== word.nl && meaning(x) !== meaning(word))).slice(0, 3)]);
    say(word.nl);
  }

  // Wrong: the answer is shown and the word comes back at the end.
  answer(option) {
    const q = this.quiz, word = q.items[q.i];
    if (option.nl === word.nl) return this.next();
    if (!q.missed.includes(word.nl)) q.missed.push(word.nl);
    q.items.push(word); q.wrong = true;
  }

  next() {
    const q = this.quiz;
    q.i += 1; q.wrong = false;
    if (q.i < q.items.length) return this.choices();
    this.quiz = null;
    if (props()?.refresh) {
      this.set({ refreshed: new Date().toDateString(), missed: q.missed });
      notify({ title: "Goed zo!", body: q.missed.length ? `Nog lastig: ${q.missed.join(", ")}.` : "Alle woorden van gisteren zitten erin.", level: "success", timeout: 8000 });
      return closeOverlay(props().overlay);
    }
    // The lesson at home goes on: Xitun over the dialog.
    this.set({ missed: q.missed, stage: "listen", stageAt: Date.now() });
    cover("news", LISTEN_URL);
    this.enter();
  }

  finish() {
    if (demo()) {
      this.set({ done: true }); cover("stop"); cover("close");
      notify({ title: "Demo klaar", body: "Zo gaat de les thuis: Journaal, woorden, luisteren. Dit telde niet mee.", level: "success", timeout: 8000 });
      return closeOverlay(props().overlay);
    }
    const s = shared(KEY()) ?? {}, day = new Date().toDateString();
    const streak = s.last === before(day) ? (s.streak ?? 0) + 1 : s.last === day ? s.streak ?? 1 : 1;
    this.set({ done: true, streak, last: day, learned: this.words ? day : s.learned });
    cover("stop");
    // Today's words, for tomorrow morning and for the sprite during the day.
    if (this.words) exec("cp", [WORDS(), LEARNED()]).catch(() => null);
    notify({ title: "Goed gedaan!", body: `${s.plan === "home" ? "Journaal, woorden en luisteren" : "Journaal gekeken"}. Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}.`, level: "success", timeout: 8000 });
    closeOverlay(props().overlay);
  }

  // Esc, or anything else that closes it: the sprite reads this as a snooze. The other screens come back.
  async close() { if (props()?.look || props()?.refresh) return; this.set({ closedAt: Date.now() }); cover("stop"); if (demo()) cover("close"); }

  button(id, label, t, fn) {
    return div().id(id).px(10).py(4).rounded(8).cursor_pointer().flex_none().text_size(11).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(fn).child(label);
  }

  // Half of the word list, in the strip beside the video: the minute, the word, what it means.
  column(list, w, t) {
    return v_flex().w(w).h_full().flex_none().px(14).pt(44).pb(8).gap(10).overflow_hidden().children(list.map((x) => v_flex().id(`dutch-side-${x.at}-${x.nl}`).gap(1).cursor_pointer().on_click(() => say(x.nl))
      .child(h_flex().gap(6).items_baseline()
        .child(div().flex_none().text_size(10).text_color(t.dim).child(x.at))
        .child(div().text_size(15).font_semibold().text_color(t.accent).child(x.nl)))
      .child(div().text_size(12).text_color(t.foreground).child(x.zh ?? ""))
      .child(div().text_size(11).text_color(t.muted).child(x.en ?? ""))));
  }

  // One question: the word, the sentence it was said in, four meanings.
  question(t) {
    const q = this.quiz;
    if (!q) return div().text_size(14).text_color(t.muted).child("Geen woordenlijst.");
    const word = q.items[q.i];
    return v_flex().w(560).gap(12).items_center()
      .child(div().text_size(12).text_color(t.dim).child(`${Math.min(q.i + 1, q.total)} van ${q.total}${q.items.length > q.total ? `, en ${q.items.length - Math.max(q.i, q.total)} opnieuw` : ""}`))
      .child(h_flex().id(`dutch-word-${q.i}`).gap(10).items_baseline().cursor_pointer().on_click(() => say(word.nl))
        .child(div().text_size(34).font_semibold().text_color(t.accent).child(word.nl))
        .child(div().text_size(12).text_color(t.dim).child("▶ nog een keer")))
      .child(div().id(`dutch-zin-${q.i}`).w_full().text_size(13).text_color(t.muted).text_center().whitespace_normal().cursor_pointer()
        .hover((s) => s.text_color(t.foreground)).on_click(() => say(word.zin)).child(word.zin ?? ""))
      .when(!q.wrong, (el) => el.child(v_flex().w_full().gap(8).pt(8).children(q.options.map((o, i) => div().id(`dutch-option-${q.i}-${i}`).w_full().px(16).py(10).rounded(10).cursor_pointer()
        .border_1().border_color(t.border).text_size(15).hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.answer(o); cx.notify(); }).child(meaning(o))))))
      .when(q.wrong, (el) => el.child(v_flex().w_full().gap(10).pt(8).items_center()
        .child(div().text_size(13).text_color(t.blocked).child("Niet goed. Het is:"))
        .child(div().text_size(20).font_semibold().child(meaning(word)))
        .child(div().id("dutch-on").px(18).py(8).rounded(10).cursor_pointer().bg(t.accent).text_color(t.accent_foreground).text_size(13).font_semibold()
          .on_click((_e, cx) => { this.next(); cx.notify(); }).child("Verder (het woord komt terug)"))));
  }

  render() {
    const t = theme(), s = shared(KEY()) ?? {}, streak = s.streak ?? 0, now = Date.now();
    // Looking only: the whole list, each word with the sentence it was said in.
    if (props()?.look) return v_flex().id("dutch").size_full().px(40).py(28).gap(9).overflow_hidden().bg(t.popover).text_color(t.foreground)
      .child(div().text_size(18).font_semibold().pb(6).child(this.words ? `De woorden van het Journaal van ${this.words.date}  (klik op een woord of zin om het te horen)` : "Nog geen woordenlijst."))
      .children((this.words?.words ?? []).map((x, i) => h_flex().gap(14).items_baseline()
        .child(div().w(34).flex_none().text_size(11).text_color(t.dim).child(x.at))
        .child(div().id(`dutch-look-${i}`).w(210).flex_none().text_size(15).font_semibold().text_color(t.accent).cursor_pointer().on_click(() => say(x.nl)).child(`▶ ${x.nl}`))
        .child(div().w(250).flex_none().text_size(12).child(`${x.zh ?? ""}  ${x.en ?? ""}`))
        .child(div().id(`dutch-look-zin-${i}`).flex_1().min_w_0().truncate().text_size(12).text_color(t.muted).cursor_pointer()
          .hover((s) => s.text_color(t.foreground)).on_click(() => say(x.zin)).child(x.zin ?? ""))));
    if (props()?.refresh) return v_flex().id("dutch").size_full().items_center().justify_center().gap(22).bg(t.popover).text_color(t.foreground)
      .child(div().text_size(16).text_color(t.muted).child(`Goedemorgen! Eerst de woorden van het Journaal van ${this.words?.date ?? "gisteren"}.`))
      .child(this.question(t))
      .child(div().text_size(11).text_color(t.dim).child("Esc: nu niet"));
    const kept = streak > 0 && (s.last === new Date().toDateString() || s.last === before(new Date().toDateString()));
    const stage = s.stage ?? "watch", home = s.plan === "home";
    const until = stage === "listen" ? s.stageAt + T().listen : (s.watchAt ?? now) + (s.watchMs ?? T().watch), left = Math.max(0, until - now);
    const line = stage === "quiz" ? "Kies de goede betekenis. Daarna 6 minuten luisteren."
      : stage === "listen" ? `Luisteren op Xitun. Je werk komt terug om ${clock(until)} (nog ${mmss(left)}).`
      : home ? `Tot ${clock(until)} (nog ${mmss(left)}), daarna ${T().quiz} woorden en 6 minuten luisteren.`
      : `Je werk komt terug om ${clock(until)} (nog ${mmss(left)}).`;
    // A page lies over the middle (cover.swift decides how wide), so the words get what is
    // left beside it and everything else sits in a strip at the bottom.
    const wide = props()?.wide ?? 1100, side = Math.max(0, Math.floor((wide - Math.min(wide - 80, Math.max(900, wide * 0.7))) / 2) - 30);
    const words = stage === "watch" && side >= 150 ? this.words?.words ?? [] : [], half = Math.ceil(words.length / 2);
    return v_flex().id("dutch").size_full().bg(t.popover).text_color(t.foreground)
      .child(stage === "quiz" ? v_flex().flex_1().min_h_0().w_full().items_center().justify_center().child(this.question(t))
        : h_flex().flex_1().min_h_0().w_full().justify_between()
          .child(this.column(words.slice(0, half), side, t))
          .child(this.column(words.slice(half), side, t)))
      .child(v_flex().flex_none().items_center().pb(22).gap(6)
        .child(h_flex().gap(12).items_baseline()
          .child(div().text_size(20).font_semibold().child(stage === "quiz" ? "Wat betekent het?" : stage === "listen" ? "Goed luisteren!" : s.watchAt ? "Veel kijkplezier!" : "Tijd voor Nederlands"))
          .child(div().text_size(14).text_color(t.muted).child(line))
          .child(div().text_size(13).text_color(kept ? t.accent : t.dim).child(demo() ? "Demo: telt niet mee" : kept ? `Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"} achter elkaar` : "Vandaag begint een nieuwe reeks.")))
        .child(h_flex().gap(16).items_center()
          .when(stage !== "quiz", (el) => el.child(this.button("dutch-again", stage === "listen" ? "Open Xitun opnieuw" : "Open het Journaal opnieuw", t, () => { cover("news", stage === "listen" ? LISTEN_URL : this.words?.url ?? URL); })))
          .child(div().text_size(11).text_color(t.dim).child("Esc: over 5 minuten opnieuw (snooze)"))
          .child(this.button("dutch-skip", this.armed ? (kept ? `Zeker? Je reeks van ${streak} stopt. Klik nog een keer.` : "Zeker? Klik nog een keer.") : "Niet vandaag (skip)", t, (_e, cx) => {
            if (!this.armed) { this.armed = true; cx.notify(); return; }
            this.set({ skipped: true, streak: 0 });
            cover("stop");
            closeOverlay(props().overlay);
          }))));
  }
}
