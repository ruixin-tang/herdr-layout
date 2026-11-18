import { View, div, image } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, shared, checking } from "herdr";

// A Korok that pops up for a moment when something is finished: a ticket
// moved to Done or a PR merged. The My work panel says so through shared
// "korok.cheer" ({ text, at }); a click sends the Korok away early.
const STAY = 45000;

export default class Korok extends View {
  init(_props, cx) {
    this.gone = Number(localStorage.getItem("gone") ?? 0);
    // The redraw is what hides it again once its time is up.
    if (!checking()) cx.timer.every(5000, (cx) => cx.notify());
  }

  render() {
    const t = theme(), cheer = shared("korok.cheer");
    if (!cheer || Date.now() - cheer.at > STAY || cheer.at <= this.gone) return div();
    return v_flex().id("korok").p(4).gap(2).items_center().cursor_pointer().tooltip("Click to send it off")
      .on_click((_e, cx) => { this.gone = cheer.at; localStorage.setItem("gone", String(this.gone)); cx.notify(); })
      .child(div().max_w(150).px(6).py(2).rounded(6).bg(t.raised).text_size(11).text_color(t.foreground).truncate().child(cheer.text))
      .child(div().h(14).text_size(10).font_semibold().text_color(t.ansi2).frames(["Ya", "Yaha", "Yahaha!", "Yahaha!"], 400))
      .child(div().relative().flex_none().loop("top", { from: 0, to: -6, period: 450 })
        .child(image("mods/korok/korok.svg").w(56).h(56)));
  }
}
