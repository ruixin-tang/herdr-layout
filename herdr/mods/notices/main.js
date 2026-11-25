import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, shared, setShared } from "herdr";

// What wants me, as a list in the sidebar (block "notices", over the dev servers): get up for
// water, a meeting, the Dutch lesson, my train. Every notice stays until I dealt with it or it
// is over, so one no longer pushes another one away (the fox's bubble showed one at a time).
// The forest sprite knows all of it and shares the list as
//   "notices": [{ id, tag, color, text, acts: [{ key, label }] }]
// It also shows, hides and sizes this block, because a hidden block does not run. A click on a
// button goes back to the sprite: shared "notices.click" { id, key, at } and its "notice" command.
// With the sidebar narrow only the tags show.
export default class Notices extends View {
  render() {
    const t = theme(), list = shared("notices") ?? [], narrow = Boolean(shared("sidebar.collapsed"));
    const tag = (n) => div().flex_none().h(16).min_w(16).px(4).flex().items_center().justify_center().rounded(8)
      .text_size(10).font_semibold().bg(t[n.color] ?? t.accent).text_color(t.accent_foreground).child(n.tag);
    if (narrow) return v_flex().id("notices").size_full().items_center().pt(6).gap(4).overflow_hidden().children(list.map(tag));
    return v_flex().id("notices").size_full().overflow_hidden().px(10).pt(8).gap(8).border_t(1).border_color(t.border).text_color(t.foreground)
      .children(list.map((n) => v_flex().gap(4)
        .child(h_flex().gap(6).items_start().child(tag(n)).child(div().flex_1().min_w_0().text_size(11.5).whitespace_normal().child(n.text)))
        .when(n.acts.length > 0, (el) => el.child(h_flex().gap(6).children(n.acts.map((a, i) => div().id(`notice-${n.id}-${a.key}`).px(7).py(2).rounded(5).cursor_pointer()
          .border_1().border_color(i === 0 ? t.input : t.border).text_size(10.5).text_color(i === 0 ? t.foreground : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { setShared("notices.click", { id: n.id, key: a.key, at: Date.now() }); run("forest-sprite.notice"); }).child(a.label)))))));
  }
}
