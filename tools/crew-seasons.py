"""Draws the figures of the three scenes that are not the ski resort: the valley (spring),
the beach (summer) and the orchard (autumn), as <scene>-<colour>-<pose>.svg, and what follows
an agent with sub-agents there, as <scene>-follower.svg. argv[1]: the mod's folder."""
import contextlib, importlib.util, io, sys, tempfile

OUT = sys.argv[1]
# crew-gen.py draws when it is loaded: let it do that somewhere else.
spec = importlib.util.spec_from_file_location('gen', __file__.replace('crew-seasons.py', 'crew-gen.py'))
gen = importlib.util.module_from_spec(spec); sys.argv = [sys.argv[0], tempfile.mkdtemp()]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(gen)
S, blob, feet, hands, star, dark = gen.SVG, gen.blob, gen.feet, gen.hands, gen.star, gen.dark
INK = "#16323b"


def shadow(rx=17):
    return f'<ellipse cx="32" cy="61.5" rx="{rx}" ry="2" fill="#000" opacity=".22"/>'


def head(scene, c, y, mouth="smile"):
    """The round body with what the scene wears: a straw hat in the valley, a white cap and
    sunglasses on the beach, a flat cap and a scarf in the orchard."""
    m = {"o": f'<ellipse cx="32" cy="{y+5}" rx="1.5" ry="1.8" fill="{INK}"/>',
         "smile": f'<path d="M28.5 {y+4} q3.5 3.4 7 0" stroke="{INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>'}[mouth]
    eyes = f'<circle cx="27.5" cy="{y-1}" r="1.7" fill="{INK}"/><circle cx="36.5" cy="{y-1}" r="1.7" fill="{INK}"/>'
    if scene == "valley":
        return (f'{blob(c, y, 13)}<ellipse cx="32" cy="{y-8.5}" rx="17" ry="3.6" fill="#e8d9a8"/><path d="M22 {y-9} a10 9 0 0 1 20 0z" fill="#f2e6bd"/>'
                f'<path d="M22 {y-9.6} h20" stroke="{dark(c, .6)}" stroke-width="2"/>{eyes}{m}')
    if scene == "beach":
        return (f'{blob(c, y, 13)}<path d="M19.8 {y-5} a12.4 12.4 0 0 1 24.4 0z" fill="#fbf7ee"/><path d="M19 {y-5.4} h26 l3 3 h-32z" fill="#e2dccb"/>'
                f'<rect x="22.5" y="{y-3}" width="8" height="5.4" rx="2.4" fill="{INK}"/><rect x="33.5" y="{y-3}" width="8" height="5.4" rx="2.4" fill="{INK}"/><path d="M30.5 {y-1} h3" stroke="{INK}" stroke-width="1.4"/>{m}')
    return (f'{blob(c, y, 13)}<path d="M19.8 {y-5} a12.4 11 0 0 1 24.4 0z" fill="{dark(c, .5)}"/><path d="M19 {y-5.4} h26 l4 3 h-31z" fill="{dark(c, .4)}"/>{eyes}{m}'
            f'<path d="M20.4 {y+7} q11.6 5 23.2 0 l.8 3.4 q-12.4 5.4 -24.8 0z" fill="#f4f1e6"/><rect x="36.5" y="{y+9}" width="4.6" height="8" rx="1.6" fill="#e2dccb"/>')


def standing(scene, c, pose):
    """walk, done (a star overhead, hands up) and blocked (an "o", hands up)."""
    y = 41
    if pose == "walk":
        return S % f'  {shadow()}{feet([(25, 57), (39, 55)], c)}{head(scene, c, y)}{hands([(18, y+5), (46, y+5)], c, 3.2)}'
    extra = star(11) if pose == "done" else ''
    if scene == "beach" and pose == "done":  # the catch, held up
        extra += '<path d="M47 27 q7 -7 13 -1 q-6 6 -13 1z M60 26 l3.6 -3.6 v7.6z" fill="#8fd0f0"/><circle cx="50.5" cy="25.6" r=".9" fill="#16323b"/>'
    return S % f'  {shadow()}{feet([(26, 56), (38, 56)], c)}{head(scene, c, y, "o" if pose == "blocked" else "smile")}{hands([(17, y-9), (47, y-9)], c, 3.2)}{extra}'


def mug(kind, c, y):
    """The large mug of the ski resort's idle skiers, held at the same place."""
    body, liquid, extra = gen.DRINKS[kind]
    return (f'<path d="M52 38.5 q4.6 .8 0 5.6" stroke="{body}" stroke-width="1.8" fill="none"/><rect x="41" y="35" width="11" height="11" rx="2.2" fill="{body}"/>'
            f'<ellipse cx="46.5" cy="36.2" rx="4.4" ry="1.5" fill="{liquid}"/>{extra}{hands([(40.5, y+8)], c, 3)}')


def valley(c, pose):
    if pose == "rest":  # on the café's bench with a mug of tea
        return S % f'''  {shadow(20)}<rect x="9" y="49" width="46" height="4" rx="1.5" fill="#6b4a36"/><path d="M14 53 v8 M50 53 v8" stroke="#4a352b" stroke-width="3" stroke-linecap="round"/>
  {head("valley", c, 36)}{feet([(25, 53), (39, 53)], c)}{mug("tea", c, 36)}'''
    if pose == "stuck":  # sitting in the grass
        return S % f'  {shadow(20)}{head("valley", c, 44, "o")}{feet([(22, 58), (42, 58)], c)}{hands([(16, 51), (48, 51)], c, 3.2)}'
    y = 41
    if pose == "hoe":  # in the field
        return S % f'''  {shadow()}{feet([(26, 56), (38, 56)], c)}{head("valley", c, y)}
  <path d="M46 26 L53 59" stroke="#8a6a4a" stroke-width="2.2" stroke-linecap="round"/><path d="M53 59 l-8 .6 l2 -5z" fill="#9aa7ad"/>{hands([(18, y+5), (48, y-2)], c, 3.2)}'''
    if pose == "mine":  # at the mine, the pick over its shoulder, a lantern in its hand
        return S % f'''  {shadow()}<path d="M44 20 L50 54" stroke="#8a6a4a" stroke-width="2.2" stroke-linecap="round"/><path d="M34 23 q10 -9 21 -1" stroke="#9aa7ad" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  {feet([(26, 56), (38, 56)], c)}{head("valley", c, y)}<rect x="11" y="45" width="7" height="9" rx="1.6" fill="#ffd166"/><path d="M12 45 q2.5 -4 5 0" stroke="#5a3f30" stroke-width="1.4" fill="none"/>{hands([(16, y+3), (47, y-1)], c, 3.2)}'''
    # "carry": on the way back, a sack on its back
    return S % f'''  {shadow()}<ellipse cx="45" cy="35" rx="10" ry="12.5" fill="#c9a36b"/><path d="M41 24 q4 -5 8 0" stroke="#8a6a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  {feet([(25, 57), (39, 55)], c)}{head("valley", c, y)}{hands([(18, y+5), (46, y-3)], c, 3.2)}'''


def boat(c, sail, mouth="smile", wave=False):
    """Bow to the right: the sailor at the stern, the sail in its colour."""
    rig = f'<path d="M38 6 V46 H61z" fill="{c}"/><path d="M38 20 V46 H52.5z" fill="{dark(c, .8)}"/>' if sail else f'<path d="M39.5 9 V45" stroke="{c}" stroke-width="5" stroke-linecap="round"/>'
    hand = hands([(21, 25)], c, 3.2) if wave else ''
    return S % f'''  <path d="M36 50 V4" stroke="#5a3f30" stroke-width="2.4" stroke-linecap="round"/>{rig}
  <g transform="translate(-12,-3)">{head("beach", c, 40, mouth)}</g>{hand}
  <path d="M5 49 H59 L51 60 H12z" fill="#fbf7ee"/><path d="M8 55 H55 L51 60 H12z" fill="#a9703f"/><path d="M1 62 h62" stroke="#d8f1fb" stroke-width="2" stroke-linecap="round" opacity=".75"/>'''


def beach(c, pose):
    if pose in ("rest", "rest-open"):  # on a lounger with a cold drink; under a parasol, or (the front row) in the sun
        parasol = '<path d="M52 12 V60" stroke="#8a6a4a" stroke-width="2.2" stroke-linecap="round"/><path d="M30 16 Q52 -8 64 12 V16z" fill="#ff6b6b"/><path d="M44 16 Q52 -2 60 16z" fill="#fbf7ee"/>' if pose == "rest" else ''
        return S % f'''  {shadow(22)}{parasol}
  <rect x="7" y="50" width="42" height="3.6" rx="1.6" fill="#fbf7ee"/><path d="M12 53 v7 M44 53 v7" stroke="#b9b4a0" stroke-width="2.4" stroke-linecap="round"/>
  {head("beach", c, 37)}{feet([(25, 53), (39, 53)], c)}{hands([(18, 44)], c, 3.2)}
  <path d="M41.5 37 h7 l-1 9 h-5z" fill="#bfe6f7"/><path d="M42 41 h6 l-.6 5 h-4.8z" fill="#ff9a3c"/><path d="M46 39 l2.6 -6" stroke="#ff6b6b" stroke-width="1.2" stroke-linecap="round"/>{hands([(44.5, 45)], c, 3)}'''
    if pose == "sail": return boat(c, True)
    if pose == "sailback": return boat(c, True).replace('\n', '\n<g transform="translate(64,0) scale(-1,1)">', 1).replace('</svg>', '</g></svg>')
    return boat(c, False, "o", wave=True)  # "adrift": the sail down, waving


def orchard(c, pose):
    if pose == "rest":  # on a log by the fire with a mug of hot chocolate
        return S % f'''  {shadow(20)}<rect x="8" y="48.5" width="48" height="8" rx="4" fill="#6b4a36"/><ellipse cx="52" cy="52.5" rx="3.4" ry="4" fill="#c9a36b"/><ellipse cx="52" cy="52.5" rx="1.4" ry="1.8" fill="#8a6a4a"/>
  {head("orchard", c, 36)}{feet([(25, 53), (39, 53)], c)}{mug("choco", c, 36)}'''
    if pose == "stuck":  # sitting on a pumpkin
        return S % f'''  {shadow(20)}<ellipse cx="32" cy="53" rx="15" ry="8.5" fill="#f0812d"/><path d="M32 45 v17 M24 46.5 q-4 6.5 0 13 M40 46.5 q4 6.5 0 13" stroke="#c9631f" stroke-width="1.4" fill="none"/>
  {head("orchard", c, 37, "o")}{feet([(23, 58), (41, 58)], c)}{hands([(16, 45), (48, 45)], c, 3.2)}'''
    if pose == "pick":  # up the ladder, an apple in its hand
        rungs = ''.join(f'<path d="M{20 + (61 - y) * 5 / 57:.1f} {y} H{44 - (61 - y) * 5 / 57:.1f}" stroke="#c98d4f" stroke-width="2"/>' for y in (12, 22, 52))
        return S % f'''  {shadow(14)}<path d="M20 61 L25 4 M44 61 L39 4" stroke="#a9703f" stroke-width="2.6" stroke-linecap="round"/>{rungs}
  {feet([(27, 46), (37, 46)], c)}{head("orchard", c, 31)}{hands([(20.5, 36)], c, 3.2)}<circle cx="48" cy="16" r="3.8" fill="#e5484d"/><path d="M48 12.4 q1 -2.6 3 -2.4" stroke="#3f8f3a" stroke-width="1.4" fill="none"/>{hands([(46, 20)], c, 3.2)}'''
    # "carry": a crate of apples in its arms
    y = 41
    apples = ''.join(f'<circle cx="{23.5 + k * 5.6}" cy="48.6" r="3.2" fill="{"#e5484d" if k % 2 == 0 else "#e0a82a"}"/>' for k in range(4))
    return S % f'''  {shadow()}{feet([(25, 57), (39, 55)], c)}{head("orchard", c, y)}{apples}
  <rect x="19" y="49.5" width="26" height="9" rx="2" fill="#a9703f"/><path d="M19 54 h26" stroke="#6b4a36" stroke-width="1.4"/>{hands([(18.5, 53), (45.5, 53)], c, 3.2)}'''


FOLLOWERS = {
    # A chicken, a seagull on the wing, a goose.
    "valley": '''  <ellipse cx="30" cy="58" rx="16" ry="2" fill="#000" opacity=".2"/><path d="M24 50 v8 M34 50 v8" stroke="#ff9a3c" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="28" cy="40" rx="17" ry="13" fill="#f4f1e6"/><path d="M11 38 q-7 -8 -3 -14 q6 2 9 9z" fill="#e2dccb"/><circle cx="45" cy="25" r="9" fill="#f4f1e6"/>
  <path d="M40 17 q2 -6 5 -1 q3 -5 5 1z" fill="#ff6b6b"/><path d="M53 24 l8 3 -8 3z" fill="#ff9a3c"/><circle cx="47" cy="23.5" r="1.6" fill="#16323b"/>''',
    "beach": '''  <path d="M4 30 Q18 6 32 26 Q46 6 60 30" stroke="#fbf7ee" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="32" cy="30" rx="8" ry="5" fill="#fbf7ee"/><path d="M38 30 l7 2 -7 2z" fill="#ff9a3c"/><circle cx="36" cy="28.6" r="1.2" fill="#16323b"/>''',
    "orchard": '''  <ellipse cx="28" cy="58" rx="17" ry="2" fill="#000" opacity=".2"/><path d="M22 50 v8 M32 50 v8" stroke="#ff9a3c" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="26" cy="42" rx="18" ry="12" fill="#fbf7ee"/><path d="M8 40 q-6 -6 -2 -12 q6 3 8 9z" fill="#e2dccb"/><path d="M38 38 Q46 24 43 12" stroke="#fbf7ee" stroke-width="8" fill="none" stroke-linecap="round"/>
  <circle cx="43.5" cy="11" r="5.6" fill="#fbf7ee"/><path d="M48.5 9.6 l8 2 -8 2.6z" fill="#ff9a3c"/><circle cx="45" cy="9.8" r="1.3" fill="#16323b"/>''',
}
POSES = {"valley": (valley, ("rest", "stuck", "hoe", "mine", "carry")), "beach": (beach, ("rest", "rest-open", "sail", "sailback", "adrift")), "orchard": (orchard, ("rest", "stuck", "pick", "carry"))}

n = 0
for scene, (draw, poses) in POSES.items():
    open(f"{OUT}/{scene}-follower.svg", "w").write(S % FOLLOWERS[scene]); n += 1
    for name, c in gen.COLORS.items():
        for pose in ("walk", "done", "blocked"):
            open(f"{OUT}/{scene}-{name}-{pose}.svg", "w").write(standing(scene, c, pose)); n += 1
        for pose in poses:
            open(f"{OUT}/{scene}-{name}-{pose}.svg", "w").write(draw(c, pose)); n += 1
print(n, "files")
