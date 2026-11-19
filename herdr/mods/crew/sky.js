// The sky over every scene of the crew strip, and the light that goes with it.
// Blends two colours: mix("#000000", "#ffffff", 0.25) is a quarter of the way to white.
export const mix = (a, b, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;
// The light at a moment: the sky's two colours, how dark the land is, and where the sun or moon stands (0 rising, 1 setting).
export function light(sky, now) {
  const HOUR = 3600000, rise = sky?.rise ?? new Date(now).setHours(8, 0, 0, 0), set = sky?.set ?? new Date(now).setHours(17, 0, 0, 0);
  const near = (at) => Math.max(0, 1 - Math.abs(now - at) / (0.7 * HOUR));
  const day = now > rise && now < set, glow = Math.max(near(rise), near(set));
  let top = day ? "#2a5f88" : "#060a15", low = day ? "#6da3c4" : "#101b2e";
  top = mix(top, "#2c2a57", glow * 0.8); low = mix(low, "#d27a4e", glow * 0.85);
  // Overcast greys it, rain or snow darkens it.
  const grey = Math.min(1, (sky?.cloud ?? 0) / 100) * 0.55 + ((sky?.mm ?? 0) >= 0.1 ? 0.2 : 0);
  top = mix(top, day ? "#39434d" : "#0b0f17", grey); low = mix(low, day ? "#5d6a74" : "#141b25", grey);
  const night = day ? 0 : 1 - glow;
  const at = day ? (now - rise) / (set - rise) : now >= set ? (now - set) / (rise + 24 * HOUR - set) : (now + 24 * HOUR - set) / (rise + 24 * HOUR - set);
  return { top, low, day, glow, night, grey, at, shade: (c) => mix(mix(mix(c, "#0a1422", night * 0.55), "#b06a55", glow * 0.16), "#56626b", day ? grey * 0.3 : 0) };
}

// The sky as SVG, W by H: its colours, a few stars at night, the sun or the moon on its arc, clouds by how overcast it is.
export function heaven(W, H, sky, lit) {
  const bodyX = Math.round(70 + lit.at * (W - 140)), bodyY = Math.round(150 - Math.sin(Math.PI * lit.at) * 118);
  const veil = 1 - Math.min(0.75, lit.grey);
  const body = lit.day
    ? `<circle cx="${bodyX}" cy="${bodyY}" r="34" fill="#ffd98a" opacity="${(0.18 * veil).toFixed(2)}"/><circle cx="${bodyX}" cy="${bodyY}" r="15" fill="#ffd166" opacity="${veil.toFixed(2)}"/>`
    : `<circle cx="${bodyX}" cy="${bodyY}" r="13" fill="#e9eef2" opacity="${veil.toFixed(2)}"/><circle cx="${bodyX + 6}" cy="${bodyY - 4}" r="12" fill="${lit.top}"/>`;
  const stars = lit.night > 0.3 ? Array.from({ length: Math.round(W / 34) }, (_, i) => `<circle cx="${(i * 7919) % W}" cy="${8 + ((i * 104729) % 120)}" r="${i % 5 === 0 ? 1.4 : 0.9}" fill="#dfe8ec" opacity="${(0.25 + (i % 4) * 0.15) * lit.night * veil}"/>`).join("") : "";
  const cover = Math.min(1, (sky?.cloud ?? 0) / 100), cloudFill = mix(lit.day ? "#e6edf1" : "#4a5563", "#2f3740", (sky?.mm ?? 0) >= 0.1 ? 0.5 : 0);
  const clouds = cover < 0.25 ? "" : Array.from({ length: Math.round((W / 260) * cover) + 1 }, (_, i) => {
    const x = Math.round(((i * 2654435761) % 1000) / 1000 * W), y = 18 + ((i * 97) % 60), w = 70 + ((i * 53) % 60);
    return `<g opacity="${(0.35 + cover * 0.4).toFixed(2)}" fill="${cloudFill}"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="13"/><ellipse cx="${x - w * 0.35}" cy="${y - 9}" rx="${w * 0.4}" ry="12"/><ellipse cx="${x + w * 0.25}" cy="${y - 12}" rx="${w * 0.45}" ry="15"/></g>`;
  }).join("");
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lit.top}"/><stop offset="1" stop-color="${lit.low}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}${body}${clouds}`;
}
