"""Draws the fox: the mascot that floats in the sidebar (mods/forest-sprite/fox-<mood>.svg) and the small heads in front of the My work rows (mods/my-work/fox-<side>.svg).
    python3 tools/fox.py ~/.config/herdr-app/mods
"""
import sys

INK, FUR, DARK, CREAM = "#16323b", "#f08a3c", "#5a2e1a", "#fbf7ee"

def eyes(mood):
    if mood == "sleep":
        return f'<path d="M21 29 q3 2.600 6 0 M37 29 q3 2.600 6 0" stroke="{INK}" stroke-width="1.800" fill="none" stroke-linecap="round"/>'
    if mood == "happy":
        return f'<path d="M21 30 q3 -4 6 0 M37 30 q3 -4 6 0" stroke="{INK}" stroke-width="1.800" fill="none" stroke-linecap="round"/>'
    if mood == "alert":
        return "".join(f'<circle cx="{x}" cy="29" r="4.200" fill="#fff"/><circle cx="{x}" cy="29" r="2.200" fill="{INK}"/>' for x in (24, 40))
    glint = "#5fd7ff" if mood == "busy" else "#fff"
    return "".join(f'<circle cx="{x}" cy="29" r="2.900" fill="{INK}"/><circle cx="{x + 1}" cy="28" r="1" fill="{glint}"/>' for x in (24, 40))

def mouth(mood):
    if mood == "happy": return '<path d="M28.500 41.500 q3.500 4.500 7 0z" fill="#2a1c16"/>'
    if mood == "alert": return '<ellipse cx="32" cy="43" rx="1.800" ry="2.200" fill="#2a1c16"/>'
    if mood == "busy": return '<path d="M29.500 42.500 h5" stroke="#2a1c16" stroke-width="1.400" stroke-linecap="round"/>'
    if mood == "sleep": return '<ellipse cx="32" cy="42.600" rx="1.400" ry="1.100" fill="#2a1c16"/>'
    return '<path d="M29 42 q3 2.400 6 0" stroke="#2a1c16" stroke-width="1.400" fill="none" stroke-linecap="round"/>'

def head(mood):
    # Ears, the face with its white cheeks, eyes, nose, mouth.
    return (f'<path d="M14 12 l4 15 10 -9z M50 12 l-4 15 -10 -9z" fill="{FUR}"/><path d="M16.500 15.500 l2.500 9 6 -5.500z M47.500 15.500 l-2.500 9 -6 -5.500z" fill="{DARK}"/>'
            f'<path d="M12 28 Q14 16 32 16 Q50 16 52 28 Q46 44 32 46 Q18 44 12 28z" fill="{FUR}"/>'
            f'<path d="M12 28 Q20 30 27 38 Q30 42 32 46 Q18 44 12 28z M52 28 Q44 30 37 38 Q34 42 32 46 Q46 44 52 28z" fill="{CREAM}"/>'
            + eyes(mood) + '<ellipse cx="32" cy="38.500" rx="2.600" ry="2" fill="#2a1c16"/>' + mouth(mood))

def fox(mood):
    return ('<ellipse cx="32" cy="59" rx="15" ry="2.500" fill="#000" opacity=".25"/>'
            f'<path d="M44 50 q14 2 13 -12 q-2 -6 -7 -2 q4 8 -8 8z" fill="{FUR}"/><path d="M57 38 q-2 -6 -7 -2 q2 3 1.500 6 q3 -1 5.500 -4z" fill="{CREAM}"/>'
            f'<path d="M21 38 h22 q4 18 -11 19 q-15 -1 -11 -19z" fill="{FUR}"/><path d="M26 44 h12 q2 11 -6 12 q-8 -1 -6 -12z" fill="{CREAM}"/>'
            + head(mood))

def svg(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n  {body}\n</svg>\n'
# A head alone, large in its box: at 18 px a whole fox is a blob.
def big(mood, x=30, y=37, k=1.4): return f'<g transform="translate({x - 32 * k:.1f},{y - 29 * k:.1f}) scale({k})">{head(mood)}</g>'
BANG = '<circle cx="52" cy="12" r="11" fill="#ff9a3c"/><path d="M52 6 v7.500" stroke="#fff" stroke-width="3.400" stroke-linecap="round"/><circle cx="52" cy="18" r="1.900" fill="#fff"/>'
ZED = '<path d="M44 3 h13 l-13 13 h13" stroke="#8fb7d9" stroke-width="3.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
STAR = '<path d="M52 1 l3.400 7 7.600 1 -5.600 5.200 1.400 7.600 -6.800 -3.800 -6.800 3.800 1.400 -7.600 -5.600 -5.200 7.600 -1z" fill="#ffd23a"/>'

mods = sys.argv[1]
for mood in ("idle", "busy", "happy", "sleep", "alert"):
    open(f"{mods}/forest-sprite/fox-{mood}.svg", "w").write(svg(fox(mood)))
TURNS = {
    "action": big("alert") + BANG,                    # mine: wide awake
    "waiting": f'<g opacity=".7">{big("sleep")}</g>' + ZED,   # someone else's: asleep
    "team": big("idle", 16, 44, 0.78) + big("idle", 48, 44, 0.78) + big("idle", 32, 30, 0.9),
    "shipped": big("happy") + STAR,
}
for side, body in TURNS.items():
    open(f"{mods}/my-work/fox-{side}.svg", "w").write(svg(body))
