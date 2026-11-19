"""Draws the crew artwork: <theme>-<colour>-<state>.svg into the folder given as argv[1]."""
import colorsys
import sys

OUT = sys.argv[1]
COLORS = {"pink": "#f29ac0", "cyan": "#5fd7ff", "gold": "#ffd166", "mint": "#9be08e", "violet": "#b48ad6", "ember": "#ff9a3c"}
STATES = ("working", "blocked", "done", "idle")


def dark(h, f=0.72):
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(hh, l * f, s)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n%s\n</svg>'


def star(cy):
    return f'<path d="M32 {cy-9} l2.6 5.4 5.9 .8 -4.3 4.1 1 5.9 -5.2 -2.8 -5.2 2.8 1 -5.9 -4.3 -4.1 5.9 -.8z" fill="#ffd166" stroke="#f2a93b" stroke-width=".8"/>'


def eyes(state, y, col="#e6f7ff", sleep="#7fa4ad", dx=4.5):
    l, r = 32 - dx, 32 + dx
    return {
        "working": f'<circle cx="{l}" cy="{y}" r="1.6" fill="{col}"/><circle cx="{r}" cy="{y}" r="1.6" fill="{col}"/>',
        "blocked": f'<circle cx="{l}" cy="{y}" r="2.1" fill="{col}"/><circle cx="{r}" cy="{y}" r="2.1" fill="{col}"/><ellipse cx="32" cy="{y+4.2}" rx="1.4" ry="1.7" fill="{col}"/>',
        "done": f'<path d="M{l-2} {y+.5} q2 -2.6 4 0 M{r-2} {y+.5} q2 -2.6 4 0" stroke="{col}" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
        "idle": f'<path d="M{l-2} {y+.5} h4 M{r-2} {y+.5} h4" stroke="{sleep}" stroke-width="1.4" stroke-linecap="round"/>',
    }[state]


def blob(c, y, r=15):
    d = dark(c)
    return (f'<circle cx="32" cy="{y}" r="{r}" fill="{c}"/>'
            f'<path d="M{32-r} {y} a{r} {r} 0 0 0 {r} {r} a{r+1} {r+1} 0 0 1 -{r*0.6:.1f} -{r} a{r+1} {r+1} 0 0 1 {r*0.2:.1f} -{r*0.83:.1f} a{r} {r} 0 0 0 -{r*0.6:.1f} {r*0.83:.1f}z" fill="{d}"/>')


def hands(pts, c, r=3.5):
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{dark(c)}"/>' for x, y in pts)


def feet(pts, c):
    return ''.join(f'<ellipse cx="{x}" cy="{y}" rx="5" ry="3" fill="{dark(c, .5)}"/>' for x, y in pts)


def space(c, state):
    dd = dark(c, .5)
    up = state in ("blocked", "done")
    y = 30 if up else 34
    screen = {"working": "#5fd7ff", "idle": "#1c3a44"}.get(state)
    console = '' if up else f'''<path d="M8 50 h48 l4 12 h-56z" fill="#1b3540"/><path d="M8 50 h48 l1.2 3.6 h-50.4z" fill="#2b5563"/>
  <rect x="24" y="44" width="16" height="9" rx="1.5" fill="#0c1a20" stroke="#2b5563" stroke-width="1"/><rect x="26" y="46" width="12" height="5" rx=".8" fill="{screen}"/>
  <circle cx="14" cy="57" r="1.4" fill="{'#ff9a3c' if state == 'working' else '#2b5563'}"/><circle cx="19" cy="57" r="1.4" fill="{'#9be08e' if state == 'working' else '#2b5563'}"/><rect x="44" y="56" width="9" height="2" rx="1" fill="#2b5563"/>'''
    return SVG % f'''  <ellipse cx="32" cy="61" rx="15" ry="2.2" fill="#000" opacity=".28"/>
  <path d="M32 {y-15} V{y-21}" stroke="{dd}" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="{y-22}" r="2" fill="{'#ff9a3c' if state == 'blocked' else '#e6f7ff'}"/>
  {feet([(25, y+15), (39, y+15)], c) if up else ''}{blob(c, y)}
  <rect x="20.5" y="{y-7}" width="23" height="13.5" rx="6.7" fill="#16323b"/><path d="M24 {y-4.2} q3 -2 7 -1.6" stroke="#4f7f8c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  {eyes(state, y-1)}{hands([(15.5, y-9), (48.5, y-9)] if up else [(19, y+9), (45, y+9)], c)}{star(10) if state == "done" else ''}{console}'''


def skier(c, state, y):
    """A beanie with a pompom, goggles on a strap."""
    d = dark(c, .6)
    return f'''{blob(c, y, 13)}
  <path d="M19.6 {y-4} a12.6 12.6 0 0 1 24.8 0z" fill="{d}"/><circle cx="32" cy="{y-14.5}" r="2.6" fill="#f4f1e6"/>
  <rect x="19" y="{y-5}" width="26" height="2.6" fill="#16323b"/><rect x="22" y="{y-6.5}" width="20" height="9.5" rx="4.6" fill="#16323b"/><rect x="23.4" y="{y-5.2}" width="17.2" height="6.9" rx="3.4" fill="#ffb86b" opacity=".9"/>
  {eyes(state, y-1.6, "#3a1d08", "#8a5a2a", 4.2)}'''


def skis(y):
    return f'<rect x="10" y="{y}" width="40" height="2.4" rx="1.2" fill="#d9d4c0"/><rect x="15" y="{y+3}" width="40" height="2.4" rx="1.2" fill="#b9b4a0"/>'


def ski(c, state):
    if state == "working":  # on the chairlift
        return SVG % f'''  <path d="M32 0 V12" stroke="#9fb3b3" stroke-width="2" stroke-linecap="round"/>
  <path d="M15 46 V26 a17 17 0 0 1 34 0 V46" stroke="#4a6470" stroke-width="2.4" fill="none"/>
  {skier(c, state, 31)}
  <rect x="12" y="43" width="40" height="3.4" rx="1.7" fill="#4a6470"/>{feet([(26, 49), (38, 49)], c)}{skis(53)}{hands([(18, 37), (46, 37)], c, 3.2)}'''
    if state == "idle":  # in the hut, its pennant in the suit's colour
        return SVG % f'''  <ellipse cx="32" cy="61" rx="22" ry="2.2" fill="#000" opacity=".28"/>
  <rect x="13" y="34" width="38" height="26" fill="#3a2a22"/><path d="M13 40 h38 M13 47 h38 M13 54 h38" stroke="#2a1d17" stroke-width="1"/>
  <path d="M8 36 L32 16 L56 36z" fill="#4a352b"/><path d="M8 36 L32 16 L56 36 L52 36 L32 20.5 L12 36z" fill="#eef3f5"/>
  <rect x="19" y="41" width="11" height="9" rx="1" fill="#1c1410" stroke="#5a4335" stroke-width="1"/><path d="M24.5 41 v9 M19 45.5 h11" stroke="#5a4335" stroke-width=".8"/>
  <rect x="36" y="42" width="9" height="18" rx="1" fill="#2a1d17"/><circle cx="43" cy="51" r=".9" fill="#8a6a4a"/>
  <path d="M44 22 v-15" stroke="#8a8a8a" stroke-width="1.2"/><path d="M44 7 l10 3 -10 3z" fill="{c}"/>'''
    y = 35
    flag = '<path d="M57 18 V58" stroke="#d9d4c0" stroke-width="1.6" stroke-linecap="round"/><path d="M57 19 l-10 3.5 10 3.5z" fill="#ff9a3c"/>' if state == "blocked" else ''
    return SVG % f'''  <ellipse cx="32" cy="61" rx="17" ry="2.2" fill="#000" opacity=".28"/>{flag}
  {feet([(26, y+15), (38, y+15)], c)}{skier(c, state, y)}{skis(54)}{hands([(17, y-9), (47, y-9)], c, 3.2)}{star(11) if state == "done" else ''}'''


def ski_extra(c, state):
    """The two poses only the ski scene has: carving down the piste, and a break at the café."""
    d = dark(c)
    if state == "carve":  # seen from the front, poles out, ski tips towards me
        y = 33
        poles = f'<path d="M15 {y-2} L9 58 M49 {y-2} L55 58" stroke="#d9d4c0" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="58" r="1.6" fill="#d9d4c0"/><circle cx="55" cy="58" r="1.6" fill="#d9d4c0"/>'
        tips = '<path d="M22 50 q4 -2 8 0 l-1.5 12 h-5z" fill="#d9d4c0"/><path d="M34 50 q4 -2 8 0 l-1.5 12 h-5z" fill="#b9b4a0"/>'
        return SVG % f'''  <ellipse cx="32" cy="61.5" rx="16" ry="2" fill="#000" opacity=".22"/>{poles}{tips}
  {feet([(26, y+15), (38, y+15)], c)}{skier(c, "working", y)}{hands([(15, y-1), (49, y-1)], c, 3.2)}'''
    # "rest": on the café bench with a mug
    y = 36
    return SVG % f'''  <ellipse cx="32" cy="61.5" rx="20" ry="2" fill="#000" opacity=".22"/>
  <rect x="9" y="49" width="46" height="4" rx="1.5" fill="#6b4a36"/><path d="M14 53 v8 M50 53 v8" stroke="#4a352b" stroke-width="3" stroke-linecap="round"/>
  {skier(c, "done", y)}{feet([(25, 53), (39, 53)], c)}{hands([(18, y+7)], c, 3.2)}
  <rect x="42" y="{y+2}" width="8" height="7.5" rx="1.6" fill="#f4f1e6"/><path d="M50 {y+3.5} q3.4 .6 0 4.4" stroke="#f4f1e6" stroke-width="1.4" fill="none"/>
  <path d="M44.5 {y-.5} q-1.4 -2 0 -3.6 M47.5 {y-.5} q-1.4 -2 0 -3.6" stroke="#9fb3b3" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>{hands([(45, y+8)], c, 3)}'''


# What an idle skier holds: the mug's colour, the drink's, and what tells it apart from above.
DRINKS = {
    "choco": ("#d8574a", "#6b3f2a", '<path d="M42.6 35.6 q.4 -3.4 3 -2.6 q1.2 -2.2 3 -.4 q2.6 -.6 2.8 3z" fill="#fbf7ee"/>'),
    "tea": ("#f4f1e6", "#c98a3a", '<path d="M44 35.5 V43" stroke="#8a9a9a" stroke-width=".8"/><rect x="42.2" y="42" width="3.6" height="3.6" rx=".6" fill="#9be08e"/>'),
    "coffee": ("#f4f1e6", "#3a2418", '<rect x="41" y="40" width="11" height="2.6" fill="#8a5a3a"/>'),
}


def ski_rest(c, drink):
    """Idle: on the café bench with a large mug of something hot, held in both hands."""
    y = 36
    mug, liquid, extra = DRINKS[drink]
    return SVG % f'''  <ellipse cx="32" cy="61.5" rx="20" ry="2" fill="#000" opacity=".22"/>
  <rect x="9" y="49" width="46" height="4" rx="1.5" fill="#6b4a36"/><path d="M14 53 v8 M50 53 v8" stroke="#4a352b" stroke-width="3" stroke-linecap="round"/>
  {skier(c, "done", y)}{feet([(25, 53), (39, 53)], c)}
  <path d="M52 38.5 q4.6 .8 0 5.6" stroke="{mug}" stroke-width="1.8" fill="none"/><rect x="41" y="35" width="11" height="11" rx="2.2" fill="{mug}"/>
  <ellipse cx="46.5" cy="36.2" rx="4.4" ry="1.5" fill="{liquid}"/>{extra}
  {hands([(40.5, y+8)], c, 3)}'''


def ski_subs(c, pose):
    """A skier whose sub-agents are running: "pack" in the chair with the folded wing on its back,
    "fly" hanging under the wing (the wing itself is ski-<colour>-wing.svg, drawn above it)."""
    d = dark(c, .6)
    if pose == "pack":
        pack = f'<rect x="40" y="22" width="14" height="19" rx="5" fill="{d}"/><rect x="44" y="18.5" width="6" height="5" rx="2.4" fill="{d}"/><path d="M41 29 h13 M41 34 h13" stroke="{c}" stroke-width="1.6"/>'
        return SVG % f'''  <path d="M32 0 V12" stroke="#9fb3b3" stroke-width="2" stroke-linecap="round"/>
  <path d="M15 46 V26 a17 17 0 0 1 34 0 V46" stroke="#4a6470" stroke-width="2.4" fill="none"/>
  {pack}{skier(c, "working", 31)}
  <rect x="12" y="43" width="40" height="3.4" rx="1.7" fill="#4a6470"/>{feet([(26, 49), (38, 49)], c)}{skis(53)}{hands([(18, 37), (46, 37)], c, 3.2)}'''
    y = 35  # in the air: no shadow, hands up on the lines, the skis hanging
    return SVG % f'''  {feet([(26, y+15), (38, y+15)], c)}{skier(c, "working", y)}{skis(54)}{hands([(18, y-9), (46, y-9)], c, 3.2)}'''


def board(c, y, tilt=0):
    """A snowboard under the feet, cream with a stripe in the suit's colour."""
    return (f'<g transform="rotate({tilt} 32 {y+2})"><rect x="8" y="{y}" width="48" height="4.6" rx="2.3" fill="#f4f1e6"/>'
            f'<rect x="20" y="{y}" width="24" height="4.6" fill="{dark(c, .6)}"/><rect x="29" y="{y}" width="6" height="4.6" fill="{c}"/></g>')


def boarder(c, pose):
    """The same skier on a snowboard, for every pose that shows skis (never with the wing)."""
    if pose == "working":  # on the chairlift, the board hanging from its feet
        return SVG % f'''  <path d="M32 0 V12" stroke="#9fb3b3" stroke-width="2" stroke-linecap="round"/>
  <path d="M15 46 V26 a17 17 0 0 1 34 0 V46" stroke="#4a6470" stroke-width="2.4" fill="none"/>
  {skier(c, pose, 31)}
  <rect x="12" y="43" width="40" height="3.4" rx="1.7" fill="#4a6470"/>{feet([(26, 49), (38, 49)], c)}{board(c, 52, -8)}{hands([(18, 37), (46, 37)], c, 3.2)}'''
    if pose == "down":  # riding left, looking where it goes, arms out
        y = 35; d = dark(c, .6)
        return SVG % f'''  <ellipse cx="32" cy="61.5" rx="19" ry="2" fill="#000" opacity=".2"/>
  {feet([(24, y+16), (40, y+14)], c)}{blob(c, y, 13)}
  <path d="M19.6 {y-4} a12.6 12.6 0 0 1 24.8 0z" fill="{d}"/><circle cx="36" cy="{y-14}" r="2.6" fill="#f4f1e6"/>
  <rect x="19" y="{y-5}" width="26" height="2.6" fill="#16323b"/><rect x="18" y="{y-6.5}" width="18" height="9.5" rx="4.6" fill="#16323b"/><rect x="19.4" y="{y-5.2}" width="15.2" height="6.9" rx="3.4" fill="#ffb86b" opacity=".9"/>
  <circle cx="24" cy="{y-1.6}" r="1.5" fill="#3a1d08"/><circle cx="30.5" cy="{y-1.6}" r="1.5" fill="#3a1d08"/>
  {board(c, 53, -5)}{hands([(14, y+3), (50, y-3)], c, 3.2)}'''
    if pose == "stuck":  # sitting in the snow, the board still on
        y = 40
        return SVG % f'''  <ellipse cx="32" cy="61.5" rx="21" ry="2" fill="#000" opacity=".22"/>
  {skier(c, "blocked", y)}{feet([(24, 55), (40, 55)], c)}{board(c, 56)}{hands([(15, y+8), (49, y+8)], c, 3.2)}'''
    y = 35
    if pose == "carve":  # on foot, standing on the board
        return SVG % f'''  <ellipse cx="32" cy="61.5" rx="17" ry="2" fill="#000" opacity=".22"/>
  {feet([(26, y+15), (38, y+15)], c)}{skier(c, "working", y)}{board(c, 53)}{hands([(15, y-1), (49, y-1)], c, 3.2)}'''
    flag = '<path d="M57 18 V58" stroke="#d9d4c0" stroke-width="1.6" stroke-linecap="round"/><path d="M57 19 l-10 3.5 10 3.5z" fill="#ff9a3c"/>' if pose == "blocked" else ''
    return SVG % f'''  <ellipse cx="32" cy="61" rx="17" ry="2.2" fill="#000" opacity=".28"/>{flag}
  {feet([(26, y+15), (38, y+15)], c)}{skier(c, pose, y)}{board(c, 53)}{hands([(17, y-9), (47, y-9)], c, 3.2)}{star(11) if pose == "done" else ''}'''


def wing(c):
    """The paraglider over a flying skier, in its colour, at the figure's own scale:
    its lines end at (42, 50) and (70, 50), where the hands of the "fly" pose are (18, 26) and (46, 26)."""
    lines = ''.join(f'<path d="M{x} {y} L{70 if x > 56 else 42} 50" stroke="#dfe8ec" stroke-width="1" opacity=".85"/>' for x, y in [(8, 17), (30, 9), (82, 9), (104, 17)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 50" width="112" height="50">
  {lines}<path d="M3 20 Q56 -14 109 20 Q56 4 3 20z" fill="{c}"/><path d="M3 20 Q56 4 109 20 Q56 10 3 20z" fill="{dark(c, .7)}"/>
  <path d="M28 8.5 Q56 -3 84 8.5 Q56 2.5 28 8.5z" fill="#fff" opacity=".4"/>
</svg>'''


def hold(x, y, col, r=3.6):
    return f'<path d="M{x-r} {y} q{r*.2:.1f} -{r*1.2:.1f} {r} -{r} q{r*1.1:.1f} {r*.1:.1f} {r} {r} q-{r*.2:.1f} {r:.1f} -{r} {r} q-{r*.9:.1f} 0 -{r} -{r}z" fill="{col}"/>'


def climber(c, state, y):
    """A bare round face with a headband."""
    return f'''{blob(c, y, 13)}<path d="M19.4 {y-4.5} q12.6 -5 25.2 0 l-.4 2.6 q-12.2 -4.6 -24.4 0z" fill="#f4f1e6"/>{eyes(state, y, "#16323b", "#16323b", 4.4)}'''


def boulder(c, state):
    d = dark(c)

    def arm(x1, y1, x2, y2):
        return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{d}" stroke-width="4.6" stroke-linecap="round"/>'

    chalk = '<circle cx="45" cy="45" r="3.4" fill="#f4f1e6"/><path d="M42.4 43 h5.2" stroke="#b9b4a0" stroke-width="1"/>'
    if state == "working":  # on the wall, reaching
        return SVG % f'''  {hold(15, 13, "#ff9a3c")}{hold(49, 19, "#5ce0d8")}{hold(23, 56, "#b48ad6", 3)}{hold(42, 58, "#f2b84b", 3)}
  {arm(24, 26, 16, 15)}{arm(40, 27, 48, 21)}{arm(27, 46, 24, 54)}{arm(37, 46, 41, 56)}
  {climber(c, state, 35)}{chalk}'''
    if state == "blocked":  # hanging from one hold, waving
        return SVG % f'''  {hold(32, 7, "#ff9a3c", 4.2)}{arm(32, 22, 32, 10)}{arm(42, 30, 51, 21)}
  {arm(27, 45, 25, 55)}{arm(37, 45, 39, 55)}{climber(c, state, 34)}{hands([(52, 20)], c, 3.3)}{chalk}'''
    if state == "done":  # topped out, sitting on the boulder
        return SVG % f'''  <path d="M6 62 q-2 -16 10 -19 q8 -5 18 -2 q14 -3 22 6 q5 7 2 15z" fill="#3f5158"/><path d="M6 62 q-2 -16 10 -19 q8 -5 18 -2 q-12 3 -17 10 q-4 6 -3 11z" fill="#33434a"/>
  {feet([(25, 45), (39, 45)], c)}{climber(c, state, 31)}{hands([(17, 22), (47, 22)], c, 3.2)}{star(8)}'''
    return SVG % f'''  <rect x="6" y="52" width="52" height="9" rx="3" fill="{dark(c, .45)}"/><path d="M6 56 h52" stroke="#0c1a20" stroke-width="1" opacity=".5"/>
  {feet([(22, 52), (42, 52)], c)}{climber(c, state, 40)}{hands([(18, 47), (46, 47)], c, 3.2)}'''


open(f"{OUT}/ski-peaks.svg", "w").write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 110" width="520" height="110">
  <path d="M0 110 L90 44 L150 80 L250 8 L330 70 L400 36 L520 110z" fill="#16303c"/>
  <path d="M250 8 L226 26 l10 3 6 -6 9 8 8 -7 9 6 9 -4z M400 36 L384 48 l8 2 6 -5 8 6 8 -4z M90 44 L76 55 l8 1 6 -4 8 5 7 -3z" fill="#dfe8ec" opacity=".85"/>
  <path d="M0 110 L60 78 L130 96 L200 62 L290 98 L360 74 L450 100 L520 84 V110z" fill="#1c3a48"/>
</svg>''')
open(f"{OUT}/ski-station.svg", "w").write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 70" width="80" height="70">
  <rect x="8" y="30" width="56" height="40" fill="#2b4250"/><path d="M2 32 L36 10 L70 32z" fill="#3a5666"/><path d="M2 32 L36 10 L70 32 L64 32 L36 15 L8 32z" fill="#eef3f5"/>
  <rect x="16" y="40" width="14" height="12" rx="1" fill="#ffd166" opacity=".85"/><path d="M23 40 v12 M16 46 h14" stroke="#2b4250" stroke-width="1"/>
  <rect x="38" y="42" width="18" height="28" rx="1" fill="#16303c"/>
  <path d="M74 70 V34" stroke="#d9d4c0" stroke-width="2"/><path d="M74 35 l-12 4 12 4z" fill="#ff9a3c"/>
</svg>''')
open(f"{OUT}/ski-cafe.svg", "w").write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 90" width="130" height="90">
  <rect x="96" y="14" width="9" height="22" fill="#4a352b"/><rect x="94" y="11" width="13" height="4" fill="#eef3f5"/>
  <path d="M100 8 q-5 -5 0 -9" stroke="#9fb3b3" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>
  <rect x="12" y="44" width="106" height="46" fill="#5a3f30"/><path d="M12 55 h106 M12 66 h106 M12 77 h106" stroke="#46301f" stroke-width="1.2"/>
  <path d="M2 48 L65 10 L128 48z" fill="#6b4a36"/><path d="M2 48 L65 10 L128 48 L119 48 L65 17.5 L11 48z" fill="#eef3f5"/>
  <rect x="22" y="54" width="20" height="16" rx="1.5" fill="#ffd166"/><path d="M32 54 v16 M22 62 h20" stroke="#5a3f30" stroke-width="1.2"/>
  <rect x="88" y="54" width="20" height="16" rx="1.5" fill="#ffd166"/><path d="M98 54 v16 M88 62 h20" stroke="#5a3f30" stroke-width="1.2"/>
  <rect x="54" y="56" width="22" height="34" rx="1.5" fill="#3a271c"/><circle cx="71" cy="74" r="1.4" fill="#ffd166"/>
  <rect x="50" y="30" width="30" height="13" rx="2" fill="#16303c" stroke="#eef3f5" stroke-width="1"/>
  <rect x="59" y="33" width="8" height="7" rx="1.4" fill="#eef3f5"/><path d="M67 34.4 q3 .5 0 4" stroke="#eef3f5" stroke-width="1.2" fill="none"/>
</svg>''')

n = 0
for name, c in COLORS.items():
    for st in ("carve", "rest"):
        open(f"{OUT}/ski-{name}-{st}.svg", "w").write(ski_extra(c, st))
        n += 1
    for pose in ("pack", "fly"):
        open(f"{OUT}/ski-{name}-{pose}.svg", "w").write(ski_subs(c, pose))
        n += 1
    open(f"{OUT}/ski-{name}-wing.svg", "w").write(wing(c))
    n += 1
    for pose in ("working", "down", "stuck", "carve", "blocked", "done"):
        open(f"{OUT}/ski-{name}-{pose}-board.svg", "w").write(boarder(c, pose))
        n += 1
    for drink in DRINKS:
        open(f"{OUT}/ski-{name}-rest-{drink}.svg", "w").write(ski_rest(c, drink))
        n += 1
for name, c in COLORS.items():
    for st in STATES:
        for theme, fn in (("space", space), ("ski", ski), ("boulder", boulder)):
            open(f"{OUT}/{theme}-{name}-{st}.svg", "w").write(fn(c, st))
            n += 1
print(n, "files")
