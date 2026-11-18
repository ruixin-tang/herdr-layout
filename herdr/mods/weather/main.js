import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, run, shared, setShared, checking } from "herdr";

// The weather where I work and where I live, above the agenda: now, and the
// next two hours of rain as 24 five-minute bars. The rain comes from Buienradar,
// which reads it off the rain radar (a weather model said "dry soon" while it
// poured); temperature and sky from Open-Meteo. Both free, no key, every five minutes.
// At home the first place (work) is left out, and the trains block hides: "home"
// is any network I marked as such with the label at the bottom. A network is
// known by its router (address and hardware address); macOS keeps its name secret.
// Where I am goes to the other mods through shared "my-work.place", and the sky
// over where I am through shared "weather.sky": { rise, set, mm, snow, cloud, outlook }
// (the mountain strip draws it, the trains' nudge quotes the outlook).
const PLACES = [["Den Bosch", 51.6978, 5.3037], ["Eindhoven", 51.4416, 5.4697]];
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${PLACES.map((p) => p[1]).join(",")}&longitude=${PLACES.map((p) => p[2]).join(",")}`
  + "&current=temperature_2m,weather_code,cloud_cover&daily=sunrise,sunset&forecast_days=1&timezone=Europe%2FAmsterdam";
// One answer per place, 24 lines "077|15:20": the time and a strength, 10 ^ ((n - 109) / 32) mm an hour.
const RAIN = PLACES.map((p) => `curl -s -m 15 "https://gpsgadget.buienradar.nl/data/raintext?lat=${p[1].toFixed(2)}&lon=${p[2].toFixed(2)}" | tr '\n' ' '; echo`).join("; ");
const SNOWY = [71, 73, 75, 77, 85, 86];
// WMO weather codes, by their first match.
const SKY = [[[0, 1], "Clear"], [[2], "Partly cloudy"], [[3], "Cloudy"], [[45, 48], "Fog"], [[51, 53, 55, 56, 57], "Drizzle"], [[61, 63, 65, 66, 67, 80, 81, 82], "Rain"],
  [[71, 73, 75, 77, 85, 86], "Snow"], [[95, 96, 99], "Thunder"]];
const sky = (code) => SKY.find(([codes]) => codes.includes(code))?.[1] ?? "";
const clock = (at) => new Date(at).toTimeString().slice(0, 5);
// From 0.1 mm an hour it counts as wet; a bar is full at 5 mm an hour (a proper shower).
const WET = 0.1, FULL = 5, BAR = 20;
const BLOCK = "weather", ROW = 51;
const NETWORK = `gw=$(route -n get default 2>/dev/null | awk '/gateway/{print $2}'); [ -n "$gw" ] && echo "$gw|$(arp -n "$gw" 2>/dev/null | awk '{print $4}' | head -1)"`;

export default class Weather extends View {
  init(_props, cx) {
    this.places = null; this.at = null; this.failed = false;
    this.network = ""; this.homes = JSON.parse(localStorage.getItem("homes") ?? "[]");
    if (checking()) return;
    this.load(cx);
    cx.timer.every(300000, (cx) => this.load(cx));
  }

  atHome() { return Boolean(this.network) && this.homes.includes(this.network); }

  // Says where I am, and makes the block as high as the places it shows.
  settle() {
    const place = this.atHome() ? "home" : "away";
    if (shared("my-work.place") !== place) setShared("my-work.place", place);
    run("layout.resize", { id: BLOCK, px: (place === "home" ? PLACES.length - 1 : PLACES.length) * ROW + 26 });
  }

  load(cx) {
    cx.spawn(async (cx) => {
      this.network = (await exec("sh", ["-c", NETWORK]).catch(() => null))?.stdout.trim() ?? "";
      this.settle();
      try {
        const r = await exec("curl", ["-s", "-m", "15", URL]);
        const data = JSON.parse(r.stdout);
        const radar = (await exec("sh", ["-c", RAIN])).stdout.trim().split("\n").map((line) => line.trim().split(/\s+/).map((step) => step.split("|"))
          .filter((step) => step.length === 2).map(([n, at]) => ({ at, mm: Number(n) > 0 ? 10 ** ((Number(n) - 109) / 32) : 0 })));
        this.places = data.map((d, i) => {
          const rain = radar[i] ?? [], snow = SNOWY.includes(d.current.weather_code);
          // The radar knows better than the model whether it is wet right now.
          const now = (rain[0]?.mm ?? 0) >= WET ? (snow ? "Snow" : rain[0].mm >= 2 ? "Rain" : "Light rain") : sky(d.current.weather_code);
          return { name: PLACES[i][0], temp: Math.round(d.current.temperature_2m), sky: now, rain, snow,
            rise: Date.parse(d.daily.sunrise[0]), set: Date.parse(d.daily.sunset[0]), cloud: d.current.cloud_cover ?? 0 };
        });
        const here = this.places[this.atHome() ? this.places.length - 1 : 0];
        setShared("weather.sky", { rise: here.rise, set: here.set, mm: Math.round((here.rain[0]?.mm ?? 0) * 10) / 10, snow: here.snow, cloud: here.cloud, outlook: this.outlook(here) });
        this.at = Date.now(); this.failed = false;
      } catch { this.failed = true; }
      cx.notify();
    });
  }

  // "dry for 2 hours", "rain until 15:15", "snow from 16:30".
  outlook(p) {
    const first = p.rain.findIndex((x) => x.mm >= WET), what = p.snow ? "snow" : "rain";
    if (first < 0) return p.rain.length ? "dry for 2 hours" : "no radar";
    if (first > 0) return `${what} from ${p.rain[first].at}`;
    const stop = p.rain.findIndex((x) => x.mm < WET);
    return stop < 0 ? `${what} for 2 hours` : `${what} until ${p.rain[stop].at}`;
  }

  place(p, t) {
    return v_flex().flex_none().px(14).py(5).gap(3)
      .child(h_flex().gap(8).items_center()
        .child(div().w(70).flex_none().child(p.name))
        .child(div().flex_none().font_semibold().child(`${p.temp}°`))
        .child(div().flex_none().text_size(11).text_color(t.muted).child(p.sky))
        .child(div().flex_1())
        .child(div().flex_none().text_size(11).text_color(p.rain.some((x) => x.mm >= WET) ? t.accent : t.dim).child(this.outlook(p))))
      // 24 times five minutes: blue for rain, white for snow, a faint tick when dry.
      // Each one is a full-height column to hover: when, and how hard.
      .child(h_flex().h(BAR).gap(1.5)
        .children(p.rain.map((x, i) => {
          const wet = x.mm >= WET;
          const says = !wet ? "dry" : `${x.mm < 1 ? x.mm.toFixed(1) : Math.round(x.mm)} mm an hour · ${x.mm < 1 ? "light" : x.mm < 5 ? "moderate" : "heavy"} ${p.snow ? "snow" : "rain"}`;
          return v_flex().id(`bar-${p.name}-${i}`).flex_1().h(BAR).justify_end().tooltip(`${x.at} · ${says}`)
            .hover((el) => el.bg(t.hover))
            .child(div().rounded(1.5).h(wet ? Math.max(3, Math.round(Math.min(1, Math.sqrt(x.mm / FULL)) * BAR)) : 2).bg(!wet ? t.border : p.snow ? t.foreground : t.accent));
        })));
  }

  render() {
    const t = theme();
    return v_flex().id("weather").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .children((this.places ?? []).slice(this.atHome() ? 1 : 0).map((p) => this.place(p, t)))
      .child(h_flex().px(14).items_center().text_size(9.5).text_color(t.dim)
        .child(div().child("now")).child(div().flex_1())
        // Which this network is; a click says the other.
        .when(Boolean(this.network), (el) => el.child(div().id("weather-here").px(5).rounded(4).cursor_pointer().tooltip(this.atHome() ? "This network is home: work's weather and the trains are hidden. Click if it is not." : "Click when this network is your home: work's weather and the trains hide here.")
          .hover((h) => h.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => {
            this.homes = this.atHome() ? this.homes.filter((n) => n !== this.network) : [...this.homes, this.network];
            localStorage.setItem("homes", JSON.stringify(this.homes)); this.settle(); cx.notify();
          })
          .child(this.atHome() ? "at home" : "not at home")))
        .child(div().flex_1()).child(div().child(this.failed ? "weather not reached" : "+2 h")))
      .when(!this.places, (el) => el.child(div().px(14).py(8).text_size(11).text_color(t.dim).child(this.failed ? "The weather service did not answer." : "Fetching the weather…")));
  }
}
