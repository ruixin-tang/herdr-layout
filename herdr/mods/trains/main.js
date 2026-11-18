import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, readTextFile, theme, home, run, shared, setShared, checking } from "herdr";

// The trains home, under the weather: the next direct ones from 's-Hertogenbosch
// to Eindhoven Strijp-S (sprinter) and Eindhoven Centraal (intercity), with
// platform, delay and cancellations. From the NS travel information API, asked
// every two minutes; my key is in ~/.config/my-work/ns-key and stays there.
// Above them, any disruption or maintenance NS has active on the stretch between,
// in NS's English translation.
// An appointment on my calendar with a location comes first, and so does a
// "travel to <town>" block (there by its end, not its start): from AHEAD hours
// before it, the block shows the journeys that get me there in time, from where
// I am (Eindhoven when the weather mod says I am at home, else Den Bosch) to the
// station nearest the location's town. It then shows at any hour, at home too.
// "Elsewhere today" takes another destination for one day (a dinner in another
// town): type a place, pick the station. Then it shows the trains there, changes
// included, until midnight; tomorrow it is Eindhoven again.
// The block only shows, and NS is only asked, between SHOW_FROM and SHOW_UNTIL:
// I don't go home in the morning, and by the evening I am home.
// And not at all at home (the weather mod knows, shared "my-work.place").
// From ALERT_FROM o'clock a disruption, or a late or cancelled next train, goes
// to the forest sprite through shared "train.alert".
// Once a day at NUDGE_AT, on the way home, the sprite also gets the plan: when to
// get up for the next train I can reach, and the rain outlook (shared "train.nudge").
const FROM = "HT", HOME = [["EHS", "Strijp-S"], ["EHV", "Centraal"]];
const SHOWN = 4, LATE = 5, SHOW_FROM = "15:00", SHOW_UNTIL = "18:30", ALERT_FROM = 16;
// The stations on the way home: a disruption counts when it names two or more of them.
const ROUTE = ["HT", "VG", "BTL", "BET", "EHS", "EHV"];
const BLOCK = "trains";
// Today's meetings with their typed location ("place"), written by the Claude Code mod `my-tickets`.
const MEETINGS = `${home()}/.cache/my-work/meetings.json`;
const AHEAD = 4, EARLY = 10 * 60000;
// Packing up and walking to the station: a train leaving sooner than this is out of reach.
const WALK = 15 * 60000;
const NUDGE_AT = "17:15";
const START = { home: ["EHV", "Eindhoven"], away: [FROM, "Den Bosch"] };
const API = "https://gateway.apiportal.ns.nl/reisinformatie-api/api";
// The key is read by the shell ($1 is its file), never by this script.
const CURL = `curl -s -m 15 -H "Accept-Language: en" -H "Ocp-Apim-Subscription-Key: $(tr -d '[:space:]' < "$1")"`;
// "2026-11-18T14:58:00+0100": the first 19 characters are my local time.
const time = (text) => (text ? new Date(text.slice(0, 19)).getTime() : null);
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
const today = () => new Date().toDateString();

export default class Trains extends View {
  init(_props, cx) {
    this.trains = null; this.failed = null; this.troubles = [];
    // Another destination, for the day it was picked on: { day, code, name }.
    this.other = JSON.parse(localStorage.getItem("other") ?? "null");
    this.picking = false; this.matches = null;
    // The appointment I travel to, once its station is known: { title, by, travel, code, name }; and stations found for locations before.
    this.trip = null; this.found = JSON.parse(localStorage.getItem("found") ?? "{}");
    if (checking()) return;
    this.input = InputState.new({ placeholder: "town or station, then Enter" });
    this.input.on("submit", (_e, cx) => this.search(cx));
    this.load(cx);
    cx.timer.every(120000, (cx) => this.load(cx));
  }

  // Where to today: the picked station while its day lasts, else home.
  elsewhere() { return this.other?.day === today() ? this.other : null; }

  key() { return `${home()}/.config/my-work/ns-key`; }

  // The next appointment today that has a location, from AHEAD hours before it starts, with the station for its town.
  async appointment() {
    try {
      const now = Date.now(), list = JSON.parse(await readTextFile(MEETINGS)).meetings ?? [];
      // When I have to be there: a little before an appointment starts, or by the end of a travel block.
      const by = (x) => (x.travel ? x.end : x.start - EARLY);
      const m = list.find((x) => x.place && by(x) > now && x.start - now < AHEAD * 3600000);
      if (!m) return null;
      if (!(m.place in this.found)) {
        // The town is usually the last part of an address: try the parts from the end, without postcode and country.
        const parts = m.place.split(",").map((part) => part.replace(/\b\d{4}\s?[A-Z]{2}\b|\b(the )?netherlands\b|\bnederland\b/gi, "").replace(/[^\p{L}\p{N} '-]/gu, "").trim()).filter((part) => part.length > 1).reverse();
        let hit = null;
        for (const part of parts.slice(0, 3)) {
          const r = await exec("sh", ["-c", `${CURL} -G --data-urlencode "q=$2" "${API}/v2/stations"`, "sh", this.key(), part]);
          const st = (JSON.parse(r.stdout).payload ?? []).find((x) => x.land === "NL");
          if (st) { hit = { code: st.code, name: st.namen?.lang ?? st.code }; break; }
        }
        this.found[m.place] = hit; localStorage.setItem("found", JSON.stringify(this.found));
      }
      const st = this.found[m.place];
      return st ? { title: m.title, by: by(m), travel: Boolean(m.travel), ...st } : null;
    } catch { return null; }
  }

  // As high as what it shows; away altogether outside its hours and at home, unless an appointment calls.
  fit() {
    const now = new Date().toTimeString().slice(0, 5);
    const shown = Boolean(this.trip) || (now >= SHOW_FROM && (now < SHOW_UNTIL || Boolean(this.elsewhere())) && shared("my-work.place") !== "home");
    run(shown ? "layout.show" : "layout.hide", { id: BLOCK });
    const picking = this.picking ? 30 + (this.matches ? Math.max(1, this.matches.length) * 22 : 0) : 0;
    if (shown) run("layout.resize", { id: BLOCK, px: 26 + picking + this.troubles.length * 22 + Math.max(1, (this.trains ?? []).length) * 22 + 12 });
    return shown;
  }

  load(cx) {
    cx.spawn(async (cx) => {
      const [from, fromName] = START[shared("my-work.place") === "home" ? "home" : "away"];
      const trip = await this.appointment();
      this.trip = trip && trip.code !== from ? { ...trip, from: fromName } : null;
      if (!this.fit()) return;
      const other = this.trip ?? this.elsewhere(), to = other ? [[other.code, other.name]] : HOME;
      // For an appointment: the journeys that arrive a little before it starts.
      const by = this.trip ? `&dateTime=${new Date(this.trip.by).toISOString().slice(0, 19)}Z&searchForArrival=true` : "";
      const ask = [...to.map(([code]) => `${CURL} "${API}/v3/trips?fromStation=${this.trip ? from : FROM}&toStation=${code}${by}&lang=en"; echo`), `${CURL} "${API}/v3/disruptions?isActive=true"; echo`].join("; ");
      try {
        const r = await exec("sh", ["-c", ask, "sh", this.key()]);
        const lines = r.stdout.trim().split("\n").map((line) => JSON.parse(line)), answers = lines.slice(0, to.length);
        if (answers.some((a) => !a.trips)) throw new Error(answers.find((a) => !a.trips)?.message ?? "no trips in the answer");
        // Trouble on the way home: what NS lists for the stretch. Elsewhere: what NS attaches to the journeys themselves.
        const listed = other ? [] : (Array.isArray(lines[to.length]) ? lines[to.length] : []).flatMap((d) => {
          const hit = (d.publicationSections ?? []).find((sec) => (sec.section?.stations ?? []).filter((st) => ROUTE.includes(st.stationCode)).length >= 2);
          return hit ? [{ title: (d.title ?? "").replace(/\.$/, ""), does: hit.consequence?.description ?? (d.type === "MAINTENANCE" ? "maintenance" : "disruption"),
            more: [d.timespans?.[0]?.situation?.label, d.expectedDuration?.description].filter(Boolean).join(" ") }] : [];
        });
        const attached = answers.flatMap((a) => a.trips).map((trip) => trip.primaryMessage).filter((m) => m?.title)
          .map((m) => ({ title: m.title.replace(/\.$/, ""), does: m.type === "MAINTENANCE" ? "maintenance" : "disruption", more: m.message?.text ?? "" }));
        this.troubles = [...listed, ...attached].filter((d, i, all) => all.findIndex((x) => x.title === d.title) === i).slice(0, 3);
        const now = Date.now();
        // Home: direct trains only (a change at Centraal is the intercity row). Elsewhere: every journey NS offers.
        this.trains = answers.flatMap((a, i) => a.trips.filter((trip) => other || trip.legs.length === 1).map((trip) => {
          const leg = trip.legs[0], last = trip.legs[trip.legs.length - 1], planned = time(leg.origin.plannedDateTime), actual = time(leg.origin.actualDateTime) ?? planned;
          return { to: to[i][1], kind: leg.product?.shortCategoryName ?? "", planned, leaves: actual, late: Math.round((actual - planned) / 60000),
            track: leg.origin.actualTrack ?? leg.origin.plannedTrack ?? "", arrives: time(last.destination.actualDateTime) ?? time(last.destination.plannedDateTime),
            changes: trip.legs.length - 1, cancelled: trip.legs.some((l) => l.cancelled) || trip.status === "CANCELLED" };
        })).filter((x) => x.leaves > now - 60000 && (!this.trip || x.arrives <= this.trip.by)).sort((a, b) => a.planned - b.planned).slice(this.trip ? -SHOWN : 0, this.trip ? undefined : SHOWN);
        this.failed = null;
        // The sprite hears about the next train only, and only late in the day.
        const next = this.trains[0];
        const late = new Date().getHours() >= ALERT_FROM;
        const alert = !late ? null : next && (next.cancelled || next.late >= LATE) ? `${clock(next.planned)} to ${next.to} ${next.cancelled ? "is cancelled" : `+${next.late} min`}`
          : this.troubles.length ? `${this.troubles[0].title}: ${this.troubles[0].does}` : null;
        if ((shared("train.alert") ?? null) !== alert) setShared("train.alert", alert);
        // The plan for going home, once: the first train I can still reach from my desk.
        const hhmm = new Date().toTimeString().slice(0, 5), reach = this.trains.find((x) => !x.cancelled && x.leaves - now >= WALK);
        if (!other && hhmm >= NUDGE_AT && reach && shared("train.nudge")?.day !== today()) {
          const rain = shared("weather.sky")?.outlook;
          setShared("train.nudge", { day: today(), text: `Leave at ${clock(reach.leaves - WALK)} for the ${clock(reach.planned)} to ${reach.to}${reach.late > 0 ? ` (+${reach.late})` : ""}${rain ? ` · ${rain}` : ""}` });
        }
      } catch (e) { this.failed = String(e.message ?? e).slice(0, 80); }
      this.fit();
      cx.notify();
    });
  }

  // Dutch stations matching what was typed (letters, digits, spaces and dashes only reach the shell).
  search(cx) {
    const q = this.input.value().replace(/[^\p{L}\p{N} '-]/gu, "").trim();
    if (q.length < 2) return;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("sh", ["-c", `${CURL} -G --data-urlencode "q=$2" "${API}/v2/stations"`, "sh", this.key(), q]);
        this.matches = (JSON.parse(r.stdout).payload ?? []).filter((s) => s.land === "NL" && s.code !== FROM).slice(0, 5).map((s) => ({ code: s.code, name: s.namen?.lang ?? s.code }));
      } catch { this.matches = []; }
      this.fit(); cx.notify();
    });
  }

  go(other, cx) {
    this.other = other; localStorage.setItem("other", JSON.stringify(other));
    this.picking = false; this.matches = null; this.trains = null; this.troubles = [];
    this.load(cx); cx.notify();
  }

  link(id, label, color, t, fn) {
    return div().id(id).px(4).rounded(4).flex_none().cursor_pointer().text_color(color).hover((el) => el.bg(t.hover).text_color(t.foreground)).on_click(fn).child(label);
  }

  row(x, i, t) {
    const off = x.cancelled ? t.ansi1 : x.late >= LATE ? t.blocked : t.dim;
    // Out of reach from my desk: dimmed. The others say when to get up.
    const gone = x.leaves - Date.now() < WALK;
    const where = this.trip || this.elsewhere() ? `arrives ${clock(x.arrives)}${x.changes ? ` · ${x.changes} change${x.changes > 1 ? "s" : ""}` : ""}` : x.to;
    return h_flex().id(`train-${i}`).h(22).flex_none().px(14).gap(8).items_center().text_color(x.cancelled || gone ? t.dim : t.foreground)
      .tooltip(x.cancelled ? "Cancelled" : gone ? `Too soon to reach from your desk · arrives ${clock(x.arrives)}` : `Leave your desk by ${clock(x.leaves - WALK)} · arrives ${clock(x.arrives)}`)
      .child(div().w(38).flex_none().font_semibold().child(clock(x.planned)))
      .child(div().w(52).flex_none().text_size(11).text_color(off).child(x.cancelled ? "cancelled" : x.late > 0 ? `+${x.late} min` : "on time"))
      .child(div().w(26).flex_none().text_size(11).text_color(t.muted).child(x.kind))
      .child(div().flex_1().min_w(0).truncate().child(where))
      .child(div().flex_none().text_size(11).text_color(t.muted).child(x.track ? `platform ${x.track}` : ""));
  }

  render() {
    const t = theme(), trip = this.trip, other = trip ? null : this.elsewhere();
    const note = this.failed ? `NS not reached: ${this.failed}` : !this.trains ? "Asking NS…" : this.trains.length ? "" : trip ? "No train gets you there in time any more." : "No trains in the coming hours.";
    return v_flex().id("trains").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(26).flex_none().px(14).gap(4).items_center().text_size(11).text_color(t.muted)
        .child(div().id("trains-title").flex_1().min_w(0).truncate().when(Boolean(trip), (el) => el.text_color(t.accent).tooltip(`For "${trip.title}": at the station by ${clock(trip.by)}`))
          .child(trip ? `${trip.from} → ${trip.name} · there by ${clock(trip.by)}` : other ? `Den Bosch → ${other.name} · today` : "Den Bosch → Eindhoven"))
        .when(Boolean(other), (el) => el.child(this.link("trains-home", "back to Eindhoven", t.dim, t, (_e, cx) => this.go(null, cx))))
        .when(!other && !trip, (el) => el.child(this.link("trains-other", this.picking ? "cancel" : "elsewhere today", t.dim, t, (_e, cx) => {
          this.picking = !this.picking; this.matches = null;
          if (this.picking) { this.input.set_value(""); this.input.focus(); }
          this.fit(); cx.notify();
        }))))
      .when(this.picking, (el) => el
        .child(div().px(14).h(30).flex_none().child(Input.new(this.input).w_full().h(24).px(6).rounded(5).border_1().border_color(t.accent).bg(t.background).text_size(12.5).text_color(t.foreground)))
        .children((this.matches ?? []).map((m, i) => h_flex().id(`station-${i}`).h(22).flex_none().mx(8).px(6).rounded(5).items_center().cursor_pointer().text_color(t.accent)
          .hover((h) => h.bg(t.hover)).on_click((_e, cx) => this.go({ day: today(), ...m }, cx)).child(m.name)))
        .when(this.matches?.length === 0, (m) => m.child(div().px(14).h(22).text_size(11).text_color(t.dim).child("No Dutch station by that name."))))
      .children(this.troubles.map((d, i) => h_flex().id(`trouble-${i}`).h(22).flex_none().px(14).gap(6).items_center().text_size(11.5).text_color(t.blocked).tooltip(d.more || d.does)
        .child(div().flex_none().font_semibold().child("!")).child(div().flex_1().min_w(0).truncate().child(`${d.title}: ${d.does}`))))
      .children((this.trains ?? []).map((x, i) => this.row(x, i, t)))
      .when(Boolean(note), (el) => el.child(div().px(14).py(4).text_size(11).text_color(this.failed ? t.ansi1 : t.dim).child(note)));
  }
}
