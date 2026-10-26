import * as THREE from 'three';
import * as D from './unoData.js';

// Paints the top of the PCB onto a canvas: traces, vias, pads, silkscreen,
// labels and logo. One texture, no image files.

const K = 20; // pixels per millimetre
const COLORS = {
  base: '#4a5d99',
  trace: 'rgba(116, 136, 186, 0.42)',
  traceEdge: 'rgba(38, 48, 86, 0.28)',
  via: '#8090b8',
  viaHole: '#273055',
  silk: '#eef0f3',
  pad: '#cdb07a',
  padShade: '#a88e5f',
};

const px = (x) => x * K;
const py = (y) => (D.H - y) * K; // canvas y grows downwards

// Small deterministic PRNG so the decorative traces are the same every load.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectAt(ctx, x, y, w, d, rotDeg, fn) {
  ctx.save();
  ctx.translate(px(x), py(y));
  ctx.rotate((-rotDeg * Math.PI) / 180);
  fn(-(w * K) / 2, -(d * K) / 2, w * K, d * K);
  ctx.restore();
}

function text(ctx, str, x, y, sizeMm, { rot = 0, align = 'center', weight = 600, base = 'middle', spacing = 0 } = {}) {
  ctx.save();
  ctx.translate(px(x), py(y));
  ctx.rotate((-rot * Math.PI) / 180);
  ctx.font = `${weight} ${sizeMm * K}px "Barlow Semi Condensed", "Barlow", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (spacing) ctx.letterSpacing = `${spacing * K}px`;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

function polyline(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
  ctx.stroke();
}

// Route from a to b with one 45-degree bend, PCB style.
function bend45(a, b, diagonalLast) {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const diag = Math.min(Math.abs(dx), Math.abs(dy));
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (Math.abs(dx) > Math.abs(dy)) {
    const straight = Math.abs(dx) - diag;
    return diagonalLast ? [a, [x0 + sx * straight, y0], b] : [a, [x0 + sx * diag, y0 + sy * diag], b];
  }
  const straight = Math.abs(dy) - diag;
  return diagonalLast ? [a, [x0, y0 + sy * straight], b] : [a, [x0 + sx * diag, y0 + sy * diag], b];
}

export function pcbTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(D.W * K);
  canvas.height = Math.round(D.H * K);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(7);

  // base colour with a soft gradient so it is not dead flat
  ctx.fillStyle = COLORS.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createRadialGradient(px(40), py(30), 8 * K, px(34), py(26), 48 * K);
  grad.addColorStop(0, 'rgba(255,255,255,0.035)');
  grad.addColorStop(1, 'rgba(20,28,60,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // traces: chip pins fan out to the headers
  const traces = [];
  const chip = D.parts.find((p) => p.type === 'dip');
  for (let i = 0; i < 14; i++) {
    const x = chip.x - 16.51 + i * D.PITCH;
    const top = chip.y + 3.81;
    const bottom = chip.y - 3.81;
    if (i < 12) {
      const hx = i < 6 ? 28.96 + i * D.PITCH : 45.72 + (i - 6) * D.PITCH;
      const rise = top + 4 + i * 0.75;
      traces.push([[x, top + 0.5], [x, rise], ...bend45([x, rise], [hx, 46.2], i % 2 === 0).slice(1), [hx, 49.6]]);
    }
    if (i > 2) {
      const hx = i < 9 ? 27.94 + (i - 3) * D.PITCH : 50.8 + (i - 9) * D.PITCH;
      const drop = bottom - 1.6 - (i % 4) * 0.55;
      traces.push([[x, bottom - 0.5], [x, drop], [hx, Math.max(drop - Math.abs(hx - x), 4.4)], [hx, 3.6]]);
    }
  }
  // decorative traces
  for (let i = 0; i < 70; i++) {
    const a = [2 + rnd() * 62, 2 + rnd() * 49];
    const len = 3 + rnd() * 12;
    const ang = Math.floor(rnd() * 8) * (Math.PI / 4);
    const b = [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
    const c = [b[0] + (rnd() - 0.5) * 10, b[1] + (rnd() - 0.5) * 10];
    traces.push(bend45(a, b, rnd() > 0.5).concat(bend45(b, c, rnd() > 0.5).slice(1)));
  }
  for (const t of traces) {
    const pts = t.map(([x, y]) => [Math.min(Math.max(x, 1), D.W - 1.5), Math.min(Math.max(y, 1), D.H - 1)]);
    ctx.strokeStyle = COLORS.traceEdge;
    ctx.lineWidth = 0.62 * K;
    polyline(ctx, pts);
    ctx.strokeStyle = COLORS.trace;
    ctx.lineWidth = 0.36 * K;
    polyline(ctx, pts);
  }

  // vias
  for (let i = 0; i < 110; i++) {
    const x = 2 + rnd() * 64;
    const y = 2 + rnd() * 49;
    ctx.fillStyle = COLORS.via;
    ctx.beginPath();
    ctx.arc(px(x), py(y), 0.42 * K, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.viaHole;
    ctx.beginPath();
    ctx.arc(px(x), py(y), 0.18 * K, 0, Math.PI * 2);
    ctx.fill();
  }

  // painted drop shadows under every part (shadowBlur works in every browser)
  const prints = [];
  for (const p of D.parts) {
    let fp = D.footprints[p.type];
    if (p.type === 'maleHeader') fp = { w: p.cols * D.PITCH, d: p.rows * D.PITCH, h: 2.5 };
    if (!fp) continue;
    const rot = ((p.rot ?? 0) * Math.PI) / 180;
    const dx = fp.dx ?? 0;
    prints.push({ x: p.x + dx * Math.cos(rot), y: p.y + dx * Math.sin(rot), w: fp.w, d: fp.d, h: fp.h, rot: p.rot ?? 0, silk: fp.silk });
  }
  for (const h of D.headers) prints.push({ x: h.x, y: h.y, w: h.n * D.PITCH, d: D.PITCH, h: D.HEADER_HEIGHT });
  for (const f of prints) {
    const h = f.h ?? 1;
    const blur = Math.min(0.35 + Math.sqrt(h) * 0.42, 1.8);
    const grow = Math.min(0.1 + h * 0.07, 0.8);
    const shift = Math.min(h * 0.09, 0.9);
    ctx.save();
    ctx.shadowColor = `rgba(14, 18, 44, ${Math.min(0.28 + h * 0.03, 0.55)})`;
    ctx.shadowBlur = blur * K;
    ctx.fillStyle = `rgba(14, 18, 44, ${Math.min(0.2 + h * 0.02, 0.4)})`;
    rectAt(ctx, f.x - shift * 0.6, f.y - shift, f.w + grow, f.d + grow, f.rot, (x, y, w, d) => ctx.fillRect(x, y, w, d));
    ctx.restore();
  }

  // copper pads
  const pads = D.parts.flatMap(D.padsFor);
  for (const [x, y, rot] of [[31, 26, 0], [36, 30.5, 90], [57.5, 36, 0], [63, 20.4, 90], [8.4, 33, 90], [6, 27.8, 0]]) {
    const [ox, oy] = rot ? [0, 0.8] : [0.8, 0];
    pads.push({ x: x - ox, y: y - oy, w: 0.75, d: 0.95, rot }, { x: x + ox, y: y + oy, w: 0.75, d: 0.95, rot });
  }
  for (const p of pads) {
    rectAt(ctx, p.x, p.y, p.w, p.d, p.rot, (x, y, w, d) => {
      ctx.fillStyle = COLORS.padShade;
      ctx.fillRect(x - 0.06 * K, y - 0.06 * K, w + 0.12 * K, d + 0.12 * K);
      ctx.fillStyle = COLORS.pad;
      ctx.fillRect(x, y, w, d);
    });
  }

  // silkscreen
  ctx.fillStyle = COLORS.silk;
  ctx.strokeStyle = COLORS.silk;
  for (const f of prints) {
    if (!f.silk) continue;
    rectAt(ctx, f.x, f.y, f.w + 0.9, f.d + 0.9, f.rot, (x, y, w, d) => {
      ctx.lineWidth = 0.17 * K;
      ctx.strokeRect(x, y, w, d);
    });
  }
  for (const h of D.headers) {
    ctx.lineWidth = 0.22 * K;
    rectAt(ctx, h.x, h.y, h.n * D.PITCH + 0.5, 3.1, 0, (x, y, w, d) => ctx.strokeRect(x, y, w, d));
  }

  // header labels
  const digitalX = Object.values(D.digitalPins);
  D.digitalLabels.forEach((label, i) => {
    if (label.length > 2) text(ctx, label, digitalX[i], 47.6, 1.3, { rot: 90, align: 'right' });
    else text(ctx, label, digitalX[i], 47.3, 1.45, { weight: 700 });
  });
  text(ctx, 'DIGITAL (PWM~)', 55.6, 43.4, 1.9, { weight: 700, spacing: 0.12 });
  ctx.lineWidth = 0.24 * K;
  polyline(ctx, [[44.6, 44.9], [47.6, 44.9]]);
  polyline(ctx, [[63.6, 44.9], [65, 44.9], [65, 45.8]]);
  D.powerLabels.forEach((label, i) => {
    if (label) text(ctx, label, 27.94 + i * D.PITCH, 4.6, 1.15, { rot: 90, align: 'left' });
  });
  for (let i = 0; i < 6; i++) text(ctx, `A${i}`, 50.8 + i * D.PITCH, 5.1, 1.25, { weight: 700 });
  text(ctx, 'POWER', 37.4, 11.6, 1.9, { weight: 700, spacing: 0.12 });
  text(ctx, 'ANALOG IN', 57.2, 11.6, 1.9, { weight: 700, spacing: 0.12 });
  polyline(ctx, [[27.2, 10.6], [27.2, 11.6], [33, 11.6]]);
  polyline(ctx, [[41.8, 11.6], [46.8, 11.6]]);
  polyline(ctx, [[49.6, 11.6], [51.6, 11.6]]);
  polyline(ctx, [[62.8, 11.6], [65, 11.6], [65, 10.6]]);

  // logo: two linked loops, the universal "infinity" badge, drawn by hand
  const L = D.logoAt;
  ctx.lineWidth = 0.5 * K;
  ctx.beginPath();
  ctx.arc(px(L.x - 3.2), py(L.y), 2.6 * K, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(L.x + 3.2), py(L.y), 2.6 * K, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 0.3 * K;
  polyline(ctx, [[L.x - 4.4, L.y], [L.x - 2, L.y]]);
  polyline(ctx, [[L.x + 2, L.y], [L.x + 4.4, L.y]]);
  polyline(ctx, [[L.x + 3.2, L.y - 1.2], [L.x + 3.2, L.y + 1.2]]);
  text(ctx, 'ARDUINO', L.x, L.y - 5.4, 2.6, { weight: 700, spacing: 0.18 });

  const U = D.unoAt;
  ctx.lineWidth = 0.32 * K;
  ctx.beginPath();
  ctx.roundRect(px(U.x - 5.1), py(U.y + 2.4), 10.2 * K, 4.8 * K, 2.4 * K);
  ctx.stroke();
  text(ctx, 'UNO', U.x, U.y - 0.05, 3.5, { weight: 500, spacing: 0.3 });

  for (const l of D.silkLabels) text(ctx, l.t, l.x, l.y, l.s ?? 1.05, { rot: l.rot ?? 0, weight: l.w ?? 600 });

  // mounting hole rings
  for (const [x, y] of D.mountingHoles) {
    ctx.fillStyle = '#d9d2c2';
    ctx.beginPath();
    ctx.arc(px(x), py(y), 2.75 * K, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9ad94';
    ctx.beginPath();
    ctx.arc(px(x), py(y), 2 * K, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.repeat.set(1 / D.W, 1 / D.H); // ExtrudeGeometry UVs are in shape units (mm)
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
