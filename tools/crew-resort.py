"""Draws the ski resort seen from the side (ski-resort.svg, 1500 x 260) and a "down" pose,
and prints the lift's and the piste's waypoints for main.js. argv[1]: the mod's folder."""
import json, math, re, sys, importlib.util, io, contextlib
OUT = sys.argv[1]
W, H = 1500, 260
# The mountain's outline, left (valley) to right (summit).
PROFILE = [(0, 232), (200, 232), (262, 222), (470, 170), (540, 164), (690, 118), (1110, 118), (1200, 100), (1340, 84), (1500, 84)]
# The cable runs over the pylons' heads: valley station, four pylons, summit station.
CABLE = [(168, 172), (300, 152), (470, 106), (690, 56), (900, 56), (1110, 56), (1200, 38), (1340, 24), (1404, 24)]

def ground(x):
    for (x0, y0), (x1, y1) in zip(PROFILE, PROFILE[1:]):
        if x0 <= x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return PROFILE[-1][1]

def along(line, n):
    """n + 1 points at equal steps along a polyline."""
    segs = [(a, b, math.dist(a, b)) for a, b in zip(line, line[1:])]
    total = sum(s[2] for s in segs); out = []
    for i in range(n + 1):
        d = total * i / n
        for a, b, l in segs:
            if d <= l + 1e-6:
                t = d / l; out.append((round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t))); break
            d -= l
    return out

path = lambda pts: 'M' + ' L'.join(f'{x} {y}' for x, y in pts)
spec = importlib.util.spec_from_file_location('gen', __file__.replace('crew-resort.py', 'crew-gen.py'))
gen = importlib.util.module_from_spec(spec); sys.argv = [sys.argv[0], OUT]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(gen)

# What changes with the season.
LOOKS = {
    "ski": dict(bands=("#3d6375", "#30525f", "#25424e"), edge=("#e9f0f2", 5), tree="#14323a", cap=True, roof="#eef3f5"),
    "alp": dict(bands=("#3f6f4c", "#31593f", "#254635"), edge=("#8fd16a", 4), tree="#173f2c", cap=False, roof="#a07a55"),
}
PEAKS = '<path d="M0 110 L90 44 L150 80 L250 8 L330 70 L400 36 L520 110z" fill="#132a34"/><path d="M250 8 L226 26 l10 3 6 -6 9 8 8 -7 9 6 9 -4z M400 36 L384 48 l8 2 6 -5 8 6 8 -4z M90 44 L76 55 l8 1 6 -4 8 5 7 -3z" fill="#dfe8ec" opacity=".55"/>'
STATION = '''<rect x="8" y="30" width="56" height="40" fill="#2b4250"/><path d="M2 32 L36 10 L70 32z" fill="#3a5666"/><path d="M2 32 L36 10 L70 32 L64 32 L36 15 L8 32z" fill="ROOF"/>
  <rect x="16" y="40" width="14" height="12" rx="1" fill="#ffd166" opacity=".9"/><path d="M23 40 v12 M16 46 h14" stroke="#2b4250" stroke-width="1"/><rect x="38" y="42" width="18" height="28" rx="1" fill="#16303c"/>'''
CAFE = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', open(f'{OUT}/ski-cafe.svg').read().strip())


def bands(look, line):
    a, b, c = LOOKS[look]["bands"]
    low = lambda dy: path([(x, y + dy) for x, y in line]) + f' L{W} {H} L0 {H}z'
    return f'<path d="{low(0)}" fill="{a}"/><path d="{low(22)}" fill="{b}"/><path d="{low(54)}" fill="{c}"/>'


def tree(look, x, s=1.0, y=None):
    y = (ground(x) if y is None else y) + 2
    cap = f'<path d="M{x} {y-34*s:.0f} l{5*s:.0f} {8*s:.0f} l-{5*s:.0f} -{2*s:.0f} l-{5*s:.0f} {2*s:.0f}z" fill="#e3ecef" opacity=".85"/>' if LOOKS[look]["cap"] else ''
    return (f'<path d="M{x} {y-34*s:.0f} l{9*s:.0f} {14*s:.0f} h-{4*s:.0f} l{8*s:.0f} {12*s:.0f} h-{26*s:.0f} l{8*s:.0f} -{12*s:.0f} h-{4*s:.0f}z" fill="{LOOKS[look]["tree"]}"/>'
            f'{cap}<rect x="{x-1.5}" y="{y-8*s:.0f}" width="3" height="{8*s:.0f}" fill="#3a2a22"/>')


def gate(x, col):
    y = ground(x)
    return f'<path d="M{x} {y+1} v-17" stroke="#d9d4c0" stroke-width="1.4"/><path d="M{x} {y-16} l-9 3 9 3z" fill="{col}"/>'


def flowers(x):
    y = ground(x)
    return ''.join(f'<circle cx="{x+dx}" cy="{y-2-dy}" r="1.8" fill="{c}"/>' for dx, dy, c in [(0, 0, "#f29ac0"), (7, 2, "#ffd166"), (14, -1, "#f4f1e6"), (22, 1, "#f29ac0"), (30, -1, "#ffd166")])


def cow(x):
    y = ground(x)
    return (f'<ellipse cx="{x}" cy="{y-11}" rx="13" ry="7.5" fill="#f4f1e6"/><ellipse cx="{x-3}" cy="{y-12}" rx="4" ry="3" fill="#3a2a22"/><ellipse cx="{x+7}" cy="{y-9}" rx="3" ry="2.4" fill="#3a2a22"/>'
            f'<circle cx="{x-15}" cy="{y-14}" r="4.6" fill="#f4f1e6"/><path d="M{x-8} {y-5} v6 M{x+8} {y-5} v6" stroke="#f4f1e6" stroke-width="2.6"/><circle cx="{x-17}" cy="{y-15}" r=".9" fill="#16323b"/>')


def pylon(x, y):
    return f'<path d="M{x} {y} V{ground(x)+4:.0f}" stroke="#3f6272" stroke-width="5"/><path d="M{x-13} {y} h26" stroke="#3f6272" stroke-width="5" stroke-linecap="round"/>'


def resort(look):
    L = LOOKS[look]; roofed = lambda art: art.replace("ROOF", L["roof"]).replace('"#eef3f5"', f'"{L["roof"]}"') if look == "alp" else art.replace("ROOF", L["roof"])
    marks = (''.join(gate(x, c) for x, c in [(1290, "#ff9a3c"), (1175, "#5fd7ff"), (650, "#ff9a3c"), (570, "#5fd7ff"), (420, "#ff9a3c"), (300, "#5fd7ff")]) if look == "ski"
             else ''.join(flowers(x) for x in (300, 420, 510, 600, 1150, 1220, 1290)) + cow(1060) + cow(40))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <g transform="translate(-30,96)">{PEAKS}</g><g transform="translate(360,60) scale(1.15)">{PEAKS}</g><g transform="translate(900,2)">{PEAKS}</g>
  {bands(look, PROFILE)}
  {''.join(tree(look, x, s) for x, s in [(330, 1), (352, .8), (392, 1.1), (590, .9), (616, 1.1), (1150, .8), (1250, 1), (1276, .85), (1470, 1)])}
  <path d="{path(PROFILE)}" stroke="{L["edge"][0]}" stroke-width="{L["edge"][1]}" fill="none" stroke-linejoin="round"/>
  {marks}{''.join(pylon(x, y) for x, y in CABLE[1:-1])}
  <g transform="translate(118,{232-84}) scale(1.2)">{roofed(STATION)}</g>
  <g transform="translate(1372,{84-70})">{roofed(STATION)}</g>
  <g transform="translate(704,{118-99}) scale(1.1)">{roofed(CAFE)}</g>
  <path d="{path(CABLE)}" stroke="#a9bcc2" stroke-width="2" fill="none"/>
  <path d="M96 232 V190" stroke="#d9d4c0" stroke-width="2"/><path d="M96 191 l-14 5 14 5z" fill="#ff9a3c"/>
</svg>'''


def plateau(look):
    L = LOOKS[look]; flat = [(0, 84), (W, 84)]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <g transform="translate(120,-22)">{PEAKS}</g><g transform="translate(760,-10) scale(.9)">{PEAKS}</g>
  {bands(look, flat)}{''.join(tree(look, x, s, 84) for x, s in [(90, 1), (118, .8), (420, 1.1), (455, .85), (800, 1), (1130, .9), (1160, 1.1)])}
  <path d="M0 84 H{W}" stroke="{L["edge"][0]}" stroke-width="{L["edge"][1]}"/>
</svg>'''


def hiker(c, y, mouth):
    """Summer: a sun hat, sunglasses and a rucksack."""
    d = gen.dark(c, .6)
    m = {"o": f'<ellipse cx="32" cy="{y+5}" rx="1.5" ry="1.8" fill="#16323b"/>', "smile": f'<path d="M28.5 {y+4} q3.5 3.4 7 0" stroke="#16323b" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
         "flat": f'<path d="M29.5 {y+5} h5" stroke="#16323b" stroke-width="1.4" stroke-linecap="round"/>'}[mouth]
    return (f'<rect x="38" y="{y-4}" width="11" height="15" rx="4" fill="{gen.dark(c, .45)}"/>{gen.blob(c, y, 13)}'
            f'<ellipse cx="32" cy="{y-8.5}" rx="17" ry="3.6" fill="#e8d9a8"/><path d="M22 {y-9} a10 9 0 0 1 20 0z" fill="#f2e6bd"/><path d="M22 {y-9.6} h20" stroke="{d}" stroke-width="2"/>'
            f'<rect x="22.5" y="{y-4}" width="8" height="5.4" rx="2.4" fill="#16323b"/><rect x="33.5" y="{y-4}" width="8" height="5.4" rx="2.4" fill="#16323b"/><path d="M30.5 {y-2} h3" stroke="#16323b" stroke-width="1.4"/>{m}')


def alp(c, pose):
    S, feet, hands, star = gen.SVG, gen.feet, gen.hands, gen.star
    if pose == "working":  # on the chairlift
        return S % f'''  <path d="M32 0 V12" stroke="#9fb3b3" stroke-width="2" stroke-linecap="round"/><path d="M15 46 V26 a17 17 0 0 1 34 0 V46" stroke="#4a6470" stroke-width="2.4" fill="none"/>
  {hiker(c, 31, "smile")}<rect x="12" y="43" width="40" height="3.4" rx="1.7" fill="#4a6470"/>{feet([(26, 50), (38, 50)], c)}{hands([(18, 37), (46, 37)], c, 3.2)}'''
    if pose == "down":  # walking down, a stick in front
        y = 36
        return S % f'''  <ellipse cx="32" cy="61.5" rx="16" ry="2" fill="#000" opacity=".2"/><path d="M14 {y-4} L10 60" stroke="#8a6a4a" stroke-width="2" stroke-linecap="round"/>
  {feet([(24, y+16), (40, y+14)], c)}{hiker(c, y, "smile")}{hands([(14, y+2)], c, 3.2)}'''
    if pose == "rest":  # on the hut's bench with a glass
        y = 36
        return S % f'''  <ellipse cx="32" cy="61.5" rx="20" ry="2" fill="#000" opacity=".22"/>
  <rect x="9" y="49" width="46" height="4" rx="1.5" fill="#6b4a36"/><path d="M14 53 v8 M50 53 v8" stroke="#4a352b" stroke-width="3" stroke-linecap="round"/>
  {hiker(c, y, "smile")}{feet([(25, 53), (39, 53)], c)}{hands([(18, y+8)], c, 3.2)}
  <path d="M43 {y+1} h7 l-1 9 h-5z" fill="#ffd166" opacity=".9"/><path d="M43 {y+1} h7" stroke="#f4f1e6" stroke-width="1.6"/>{hands([(46, y+9)], c, 3)}'''
    y = 35
    flag = '<path d="M57 18 V58" stroke="#d9d4c0" stroke-width="1.6" stroke-linecap="round"/><path d="M57 19 l-10 3.5 10 3.5z" fill="#ff9a3c"/>' if pose == "blocked" else ''
    return S % f'''  <ellipse cx="32" cy="61" rx="17" ry="2.2" fill="#000" opacity=".28"/>{flag}
  {feet([(26, y+15), (38, y+15)], c)}{hiker(c, y, "o" if pose == "blocked" else "smile")}{hands([(17, y-9), (47, y-9)], c, 3.2)}{star(9) if pose == "done" else ''}'''


for look in LOOKS:
    open(f'{OUT}/{look}-resort.svg', 'w').write(resort(look)); open(f'{OUT}/{look}-plateau.svg', 'w').write(plateau(look))
for name, c in gen.COLORS.items():
    for pose in ("working", "down", "blocked", "done", "rest"):
        open(f'{OUT}/alp-{name}-{pose}.svg', 'w').write(alp(c, pose))
    y = 36; d = gen.dark(c, .6)   # the skier's "down": heading left in a tuck
    art = f'''  <ellipse cx="32" cy="61.5" rx="19" ry="2" fill="#000" opacity=".2"/>
  <path d="M40 {y+2} L58 {y+12}" stroke="#d9d4c0" stroke-width="1.5" stroke-linecap="round"/>
  {gen.feet([(27, y+15), (38, y+15)], c)}{gen.blob(c, y, 13)}
  <path d="M19.6 {y-4} a12.6 12.6 0 0 1 24.8 0z" fill="{d}"/><circle cx="36" cy="{y-14}" r="2.6" fill="#f4f1e6"/>
  <rect x="19" y="{y-5}" width="26" height="2.6" fill="#16323b"/><rect x="18" y="{y-6.5}" width="18" height="9.5" rx="4.6" fill="#16323b"/><rect x="19.4" y="{y-5.2}" width="15.2" height="6.9" rx="3.4" fill="#ffb86b" opacity=".9"/>
  <circle cx="24" cy="{y-1.6}" r="1.5" fill="#3a1d08"/><circle cx="30.5" cy="{y-1.6}" r="1.5" fill="#3a1d08"/>
  <path d="M6 55 q2 -3 5 -1.5 L56 53.5" stroke="#d9d4c0" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  {gen.hands([(42, y+3)], c, 3.2)}'''
    open(f'{OUT}/ski-{name}-down.svg', 'w').write(gen.SVG % art)

# "stuck": it needs my answer and sits where it stopped.
for name, c in gen.COLORS.items():
    y = 40
    ski_art = f'''  <ellipse cx="32" cy="61.5" rx="21" ry="2" fill="#000" opacity=".22"/>
  <path d="M8 60 L50 44 M14 44 L56 60" stroke="#d9d4c0" stroke-width="2.6" stroke-linecap="round"/>
  {gen.feet([(24, 56), (40, 56)], c)}{gen.skier(c, "blocked", y)}{gen.hands([(15, y+8), (49, y+8)], c, 3.2)}'''
    open(f'{OUT}/ski-{name}-stuck.svg', 'w').write(gen.SVG % ski_art)
    alp_art = f'''  <ellipse cx="32" cy="61.5" rx="21" ry="2" fill="#000" opacity=".22"/>
  <path d="M10 62 q2 -9 12 -9 h20 q10 0 12 9z" fill="#5d6b70"/>
  {gen.feet([(24, 55), (40, 55)], c)}{hiker(c, y - 2, "o")}
  <rect x="21" y="{y+4}" width="22" height="13" rx="1" fill="#f4f1e6" transform="rotate(-6 32 {y+10})"/><path d="M28 {y+4.5} v12 M36 {y+3.6} v12" stroke="#b9b4a0" stroke-width="1" transform="rotate(-6 32 {y+10})"/>
  {gen.hands([(20, y+11), (44, y+9)], c, 3.2)}'''
    open(f'{OUT}/alp-{name}-stuck.svg', 'w').write(gen.SVG % alp_art)

lift = along(CABLE, 12)
ski = [(x, round(ground(x))) for x in [1350, 1262, 1180, 1100, 1010, 900, 790, 690, 590, 500, 400, 300, 215]]
print('LIFT =', json.dumps(lift)); print('PISTE =', json.dumps(ski))
