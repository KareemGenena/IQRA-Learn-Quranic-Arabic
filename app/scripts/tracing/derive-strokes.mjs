/**
 * Derives each letter's tracing strokes from the FONT'S OWN GLYPH.
 *
 *   node scripts/tracing/render-glyphs.mjs <workdir>      renders the letters
 *   node scripts/tracing/derive-strokes.mjs <workdir>     this script
 *
 * The letter is rendered large in KFGQPC Uthmanic Hafs (render-glyphs.mjs,
 * headless Chrome), thinned to its centerline (Zhang–Suen), and the writing
 * path is the shortest walk along that centerline through the waypoints of
 * `waypoints.json`, in their order — so the geometry is the font's and only
 * the ORDER is authored. Dots (and the kāf's small sign) are the glyph's
 * small separate pieces, tapped lower-first and right-first. Output:
 * `strokes.json`, each stroke a polyline of 48 points in the frame of the
 * glyph's ink box (0–1 across, 0–1 down; a one-point stroke is a tap), and
 * `<workdir>/proof.png`, every letter with its strokes numbered and arrowed,
 * to be READ before the result is trusted.
 *
 * The font is never modified or parsed: a raster of the letter as the app
 * draws it is all this reads.
 */
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const work = process.argv[2];
if (!work) throw new Error('usage: node scripts/tracing/derive-strokes.mjs <workdir with sheet.png + letters.json>');

const letters = JSON.parse(readFileSync(join(work, 'letters.json'), 'utf8'));
const spec = JSON.parse(readFileSync(join(here, 'waypoints.json'), 'utf8'));
const CELL = 600, COLS = 6, POINTS = 48;
/** A separate piece is a dot (a tap) when it is compact: well under the box
 *  in both directions and a minor share of the ink. The share is generous
 *  because a dot is a quarter of a thin letter like ذ. */
const SMALL_AREA = 0.3, SMALL_SIDE = 0.45;

const { data, info } = await sharp(join(work, 'sheet.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const inkAt = (x, y) => { const i = (y * W + x) * 3; return data[i] + data[i + 1] + data[i + 2] < 384; };

const out = {};
const tiles = [];
const report = [];

for (let n = 0; n < letters.length; n++) {
  const letter = letters[n];
  const cx = (n % COLS) * CELL, cy = Math.floor(n / COLS) * CELL;
  // binary cell
  const img = new Uint8Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) img[y * CELL + x] = inkAt(cx + x, cy + y) ? 1 : 0;

  // connected components (8-neighbors)
  const comp = new Int32Array(CELL * CELL).fill(-1);
  const comps = [];
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const i = y * CELL + x;
    if (!img[i] || comp[i] >= 0) continue;
    const id = comps.length;
    const c = { id, area: 0, x0: x, x1: x, y0: y, y1: y, sx: 0, sy: 0 };
    const stack = [i]; comp[i] = id;
    while (stack.length) {
      const j = stack.pop(); const jx = j % CELL, jy = (j - jx) / CELL;
      c.area++; c.sx += jx; c.sy += jy;
      if (jx < c.x0) c.x0 = jx; if (jx > c.x1) c.x1 = jx; if (jy < c.y0) c.y0 = jy; if (jy > c.y1) c.y1 = jy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = jx + dx, ny = jy + dy; if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
        const k = ny * CELL + nx; if (img[k] && comp[k] < 0) { comp[k] = id; stack.push(k); }
      }
    }
    comps.push(c);
  }
  const total = comps.reduce((a, c) => a + c.area, 0);
  const box = { x0: Math.min(...comps.map((c) => c.x0)), x1: Math.max(...comps.map((c) => c.x1)), y0: Math.min(...comps.map((c) => c.y0)), y1: Math.max(...comps.map((c) => c.y1)) };
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  // A letter in `strokeAll` has no dots: its small piece is a stroke (the
  // sign inside ك is a small hamza, traced from its top).
  const strokeAll = (spec.strokeAll ?? []).includes(letter);
  const small = (c) => !strokeAll && comps.length > 1 && c.area < SMALL_AREA * total && (c.y1 - c.y0 + 1) < SMALL_SIDE * bh && (c.x1 - c.x0 + 1) < SMALL_SIDE * bw;
  const dots = comps.filter(small);
  const norm = ([x, y]) => [(x - box.x0) / bw, (y - box.y0) / bh];

  // thin the body (Zhang–Suen) on a copy holding only body pixels
  const sk = new Uint8Array(CELL * CELL);
  for (let i = 0; i < sk.length; i++) sk[i] = img[i] && !small(comps[comp[i]]) ? 1 : 0;
  // The glyph's thickest stroke, by a chamfer distance transform over the
  // body: the card paints with a brush this wide, so the color fills the
  // thick base of د and the bowl of ل as well as a thin ر.
  const body = new Uint8Array(CELL * CELL);
  for (let i = 0; i < body.length; i++) body[i] = img[i] && !small(comps[comp[i]]) ? 1 : 0;
  const thickness = (2 * maxInscribed(body, CELL, CELL)) / Math.max(bw, bh);
  zhangSuen(sk, CELL, CELL);
  const skel = [];
  for (let i = 0; i < sk.length; i++) if (sk[i]) skel.push(i);
  if (!skel.length) { report.push(`${letter}: no skeleton`); continue; }
  const degree = (i) => { const x = i % CELL, y = (i - x) / CELL; let d = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < CELL && ny < CELL && sk[ny * CELL + nx]) d++; } return d; };

  const strokes = [];
  const wps = letter === "taps" ? undefined : spec[letter];
  if (!wps) { report.push(`${letter}: no waypoints in waypoints.json`); }
  else {
    for (const stroke of wps) {
      const snapped = stroke.map(([fx, fy]) => snap(skel, box.x0 + fx * (bw - 1), box.y0 + fy * (bh - 1)));
      // A stroke's first and last waypoints are meant for the tips: where the
      // snapped pixel lies on a line (not at a junction) and the skeleton ends
      // within a tenth of the box, the stroke starts or ends at that end — the
      // tail of ت and the left tip of ش were left untraced before (the
      // author, 2026-10-25).
      const reach = 0.1 * Math.max(bw, bh);
      if (snapped.length > 1) {
        snapped[0] = toEnd(sk, CELL, snapped[0], snapped[1], reach, degree);
        snapped[snapped.length - 1] = toEnd(sk, CELL, snapped[snapped.length - 1], snapped[snapped.length - 2], reach, degree);
      }
      let path = [snapped[0]];
      for (let k = 0; k + 1 < snapped.length; k++) {
        const seg = shortest(sk, CELL, snapped[k], snapped[k + 1]);
        if (!seg) { report.push(`${letter}: no path between waypoints ${k} and ${k + 1}`); break; }
        path.push(...seg.slice(1));
      }
      // Thinning retracts a stroke's ends by about half the stroke's width,
      // so each end is pushed on along its own direction to the edge of the
      // ink: the pen reaches the tip of ب and the top of ا.
      const isBody = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi >= 0 && yi >= 0 && xi < CELL && yi < CELL && img[yi * CELL + xi] && !small(comps[comp[yi * CELL + xi]]); };
      path = extend(smooth(path.map((i) => [i % CELL, (i - (i % CELL)) / CELL]), 9), isBody, 30);
      path = resample(path, POINTS);
      strokes.push(path.map(norm).map(([x, y]) => [round(x), round(y)]));
    }
  }
  // Dots. At 400 px two dots side by side touch and render as ONE piece,
  // and the three of ث as one or two — so the pieces are split to the count
  // the letter is known to carry (`taps` in waypoints.json): a wide piece
  // into two, a piece holding three into the Mushaf's triangle (two below,
  // one above). Then lower first (bigger y), right first (bigger x).
  const want = spec.taps?.[letter] ?? dots.length;
  let pieces = dots.map((c) => ({ x: c.sx / c.area, y: c.sy / c.area, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1, x0: c.x0, y0: c.y0 }));
  while (pieces.length < want && pieces.length) {
    pieces.sort((a, b) => b.w - a.w);
    const p = pieces.shift();
    if (want - pieces.length >= 3) {
      pieces.push({ ...p, x: p.x0 + p.w * 0.27, y: p.y0 + p.h * 0.72, w: p.w / 2 }, { ...p, x: p.x0 + p.w * 0.73, y: p.y0 + p.h * 0.72, w: p.w / 2 }, { ...p, x: p.x0 + p.w * 0.5, y: p.y0 + p.h * 0.25, w: p.w / 2 });
    } else {
      pieces.push({ ...p, x: p.x0 + p.w * 0.27, w: p.w / 2 }, { ...p, x: p.x0 + p.w * 0.73, w: p.w / 2 });
    }
  }
  if (pieces.length !== want) report.push(`${letter}: expected ${want} dot(s), found ${pieces.length}`);
  const taps = pieces
    .sort((a, b) => (Math.abs(a.y - b.y) > 0.12 * bh ? b.y - a.y : b.x - a.x))
    .map((p) => [norm([p.x, p.y]).map(round)]);
  out[letter] = { strokes: [...strokes, ...taps], brush: round(thickness) };
  report.push(`${letter}: ${strokes.length} stroke(s) + ${taps.length} tap(s), box ${bw}×${bh}, brush ${thickness.toFixed(3)}`);

  // proof tile: the glyph light, the strokes colored, numbered, arrowed
  const T = 300, s = T / Math.max(bw, bh), tw = Math.round(bw * s), th = Math.round(bh * s);
  const glyph = await sharp(join(work, 'sheet.png')).extract({ left: cx + box.x0, top: cy + box.y0, width: bw, height: bh }).resize(tw, th).linear(0.25, 190).png().toBuffer();
  const colors = ['#d9534f', '#2f6fbf', '#1f8a8a', '#7a4fbf'];
  let svg = `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">`;
  out[letter].strokes.forEach((st, si) => {
    const col = colors[si % colors.length];
    const pts = st.map(([x, y]) => [x * tw, y * th]);
    if (pts.length === 1) {
      svg += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="9" fill="none" stroke="${col}" stroke-width="3"/><text x="${pts[0][0] + 10}" y="${pts[0][1] - 8}" font-size="14" fill="${col}">${si + 1}</text>`;
      return;
    }
    svg += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="3"/>`;
    svg += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="7" fill="${col}"/><text x="${pts[0][0] + 9}" y="${pts[0][1] - 6}" font-size="16" font-weight="bold" fill="${col}">${si + 1}</text>`;
    // an arrow every third point, so a pass back along the same line shows
    for (let k = 2; k < pts.length - 1; k += 3) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k + 1]; const ang = Math.atan2(by - ay, bx - ax);
      const [px, py] = pts[k];
      const l = 8;
      svg += `<polygon points="${px + l * Math.cos(ang)},${py + l * Math.sin(ang)} ${px + l * Math.cos(ang + 2.5)},${py + l * Math.sin(ang + 2.5)} ${px + l * Math.cos(ang - 2.5)},${py + l * Math.sin(ang - 2.5)}" fill="${col}"/>`;
    }
    svg += `<circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="4" fill="#000"/>`;
  });
  svg += `</svg>`;
  const tile = await sharp({ create: { width: T + 20, height: T + 20, channels: 3, background: '#fff' } })
    .composite([{ input: glyph, left: 10, top: 10 }, { input: Buffer.from(svg), left: 10, top: 10 }]).png().toBuffer();
  tiles.push({ input: tile, left: (n % 6) * (T + 26), top: Math.floor(n / 6) * (T + 26) });
}

await sharp({ create: { width: 6 * (T_(326)), height: 5 * 326, channels: 3, background: '#666' } }).composite(tiles).png().toFile(join(work, 'proof.png'));
// The teacher's own templates (pull-cloud.mjs → authored.json) win over the
// font-derived defaults, letter by letter.
const authoredPath = join(here, 'authored.json');
if (existsSync(authoredPath)) {
  const authored = JSON.parse(readFileSync(authoredPath, 'utf8'));
  for (const [letter, t] of Object.entries(authored)) if (t?.strokes?.length) { out[letter] = { ...(out[letter] ?? {}), strokes: t.strokes }; report.push(`${letter}: the teacher's own ${t.strokes.length} stroke(s), from the cloud`); }
}
writeFileSync(join(here, 'strokes.json'), JSON.stringify(out), 'utf8');
console.log(report.join('\n'));
console.log(`\nwritten: scripts/tracing/strokes.json (${Object.keys(out).length} letters), proof: ${join(work, 'proof.png')}`);

function T_(v) { return v; }
function round(v) { return Math.round(v * 1000) / 1000; }

/**
 * From a pixel on the skeleton, the end of its line if there is one within
 * `reach` px of walking without crossing a junction and without heading
 * toward `other` (the next waypoint); else the pixel itself.
 */
function toEnd(sk, w, from, other, reach, degree) {
  if (degree(from) !== 2) return from;
  const ox = other % w, oy = (other - ox) / w;
  const fx = from % w, fy = (from - fx) / w;
  const dOther = Math.hypot(fx - ox, fy - oy);
  const seen = new Set([from]);
  let frontier = [from];
  let steps = 0;
  while (frontier.length && steps < reach) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny * w >= sk.length) continue;
        const k = ny * w + nx;
        if (!sk[k] || seen.has(k)) continue;
        // never toward the next waypoint: the end we want is away from it
        if (Math.hypot(nx - ox, ny - oy) < dOther - reach * 0.5) continue;
        seen.add(k);
        const d = degree(k);
        if (d === 1) return k;
        if (d === 2) next.push(k);
        // a junction stops the walk on that branch
      }
    }
    frontier = next;
    steps += 1;
  }
  return from;
}

/** The radius of the largest disc inside the ink: half the thickest stroke,
 *  by a two-pass (3,4) chamfer distance transform. */
function maxInscribed(img, w, h) {
  const INF = 1 << 28;
  const d = new Int32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = img[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); }
    d[i] = v;
  }
  let max = 0;
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); }
    d[i] = v;
    if (v > max) max = v;
  }
  return max / 3;
}

/** Nearest skeleton pixel to (x, y). */
function snap(skel, x, y) {
  let best = skel[0], bd = Infinity;
  for (const i of skel) { const ix = i % CELL, iy = (i - ix) / CELL; const d = (ix - x) ** 2 + (iy - y) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

/** Breadth-first shortest walk along skeleton pixels (8-connected). */
function shortest(sk, w, from, to) {
  if (from === to) return [from];
  const prev = new Int32Array(sk.length).fill(-1);
  const q = [from]; prev[from] = from; let head = 0;
  while (head < q.length) {
    const i = q[head++]; const ix = i % w, iy = (i - ix) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= w || ny * w >= sk.length) continue;
      const k = ny * w + nx; if (!sk[k] || prev[k] >= 0) continue;
      prev[k] = i; if (k === to) { const path = [to]; let c = to; while (c !== from) { c = prev[c]; path.push(c); } return path.reverse(); }
      q.push(k);
    }
  }
  return null;
}

/** Pushes each end of the path on, along the direction of its last few
 *  points, while the pixels are ink — at most `max` px. */
function extend(pts, isInk, max) {
  if (pts.length < 4) return pts;
  const push = (from, toward) => {
    const dx = from[0] - toward[0], dy = from[1] - toward[1];
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    let last = from;
    for (let s = 1; s <= max; s++) {
      const q = [from[0] + ux * s, from[1] + uy * s];
      if (!isInk(q[0], q[1])) break;
      last = q;
    }
    return last;
  };
  const head = push(pts[0], pts[3]);
  const tail = push(pts[pts.length - 1], pts[pts.length - 4]);
  return [head, ...pts, tail];
}

function smooth(pts, win) {
  const h = Math.floor(win / 2);
  return pts.map((_, i) => {
    let sx = 0, sy = 0, c = 0;
    for (let k = i - h; k <= i + h; k++) if (k >= 0 && k < pts.length) { sx += pts[k][0]; sy += pts[k][1]; c++; }
    return [sx / c, sy / c];
  });
}

function resample(pts, count) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1];
  if (L === 0) return [pts[0]];
  const res = [];
  for (let k = 0; k < count; k++) {
    const t = (L * k) / (count - 1);
    let i = 1; while (i < d.length - 1 && d[i] < t) i++;
    const u = d[i] === d[i - 1] ? 0 : (t - d[i - 1]) / (d[i] - d[i - 1]);
    res.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
  }
  return res;
}

/** Zhang–Suen thinning, in place, on a 0/1 image. */
function zhangSuen(img, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const del = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0; for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
        if (a !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
        del.push(y * w + x);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
}
