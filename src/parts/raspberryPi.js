import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, std, canvasTexture, anchor } from '../board/materials.js';

// Raspberry Pi 4 Model B, built from the official mechanical drawing (85 x 56
// mm, holes on a 58 x 49 mm grid) and a reference photo for the look. Same
// recipe as the Uno: an extruded PCB with a canvas-painted top, and every
// connector and chip assembled from primitives. Layout coordinates are in mm
// from the board's bottom-left corner, GPIO header along the top edge.

const W = 85;
const H = 56;
const T = 1.4;
const P = 2.54;
const DEG = Math.PI / 180;
const HOLES = [[3.5, 3.5], [3.5, 52.5], [61.5, 3.5], [61.5, 52.5]];

// --- layout --------------------------------------------------------------------

const GPIO = { x: 8.37 + (19 * P) / 2, y: 50.5, cols: 20, rows: 2 };
const POE = { x: 58.5, y: 46.6, cols: 2, rows: 2 };

const PORTS = [
  { type: 'ethernet', x: 77, y: 45.75 },
  { type: 'usb', x: 77.5, y: 27, blue: true },
  { type: 'usb', x: 77.5, y: 9, blue: false },
  { type: 'usbc', x: 11.2, y: 2.5 },
  { type: 'hdmi', x: 26, y: 2.8 },
  { type: 'hdmi', x: 39.5, y: 2.8 },
  { type: 'audio', x: 53.5, y: 3.75 },
  { type: 'fpc', x: 45, y: 18.5, label: 'CAMERA' },
  { type: 'fpc', x: 4, y: 26, label: 'DISPLAY' },
];

const CHIPS = [
  { type: 'soc', x: 29.5, y: 31.5 },
  { type: 'chip', x: 43, y: 34.5, w: 12, d: 10, text: 'LPDDR4' },
  { type: 'chip', x: 50, y: 44.5, w: 6, d: 6, text: 'BCM54213' },
  { type: 'chip', x: 57, y: 36.5, w: 6, d: 6, text: 'VL805' },
  { type: 'chip', x: 10, y: 15, w: 5, d: 5, text: 'PMIC' },
  { type: 'can', x: 12.5, y: 31, w: 12, d: 10 },
];

const SMALL = [
  [20, 36], [20, 27, 90], [36, 23], [40, 27, 90], [48, 29], [52, 33, 90], [60, 30], [63, 41, 90],
  [15, 10], [18, 12, 90], [22, 14], [30, 12, 90], [34, 15], [47, 9], [50, 12, 90], [62, 20],
  [66, 36, 90], [25, 38], [37, 40, 90], [57, 27],
];

const LEDS = [
  { x: 2.2, y: 10.5, color: '#e8392e', name: 'PWR' },
  { x: 2.2, y: 13, color: '#3fbf6a', name: 'ACT' },
];

// --- painted top -----------------------------------------------------------------

const K = 16; // px per mm
const C = {
  base: '#2b8a57',
  shade: 'rgba(10, 50, 30, 0.14)',
  trace: 'rgba(120, 210, 150, 0.35)',
  traceEdge: 'rgba(10, 60, 35, 0.35)',
  via: '#c9b36a',
  viaHole: '#1f4d33',
  pad: '#d4b86a',
  padShade: '#a88e4a',
  silk: '#f2f4f0',
  ring: '#e9d98a',
};

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function topTexture() {
  const px = (x) => x * K;
  const py = (y) => (H - y) * K;
  const rectAt = (ctx, x, y, w, d, rot, fn) => {
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate((-rot * Math.PI) / 180);
    fn(-(w * K) / 2, -(d * K) / 2, w * K, d * K);
    ctx.restore();
  };
  const text = (ctx, str, x, y, mm, { rot = 0, align = 'center', weight = 600 } = {}) => {
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate((-rot * Math.PI) / 180);
    ctx.font = `${weight} ${mm * K}px "Barlow Semi Condensed", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };

  return canvasTexture(Math.round(W * K), Math.round(H * K), (ctx, cw, ch) => {
    const rnd = mulberry32(4);
    ctx.fillStyle = C.base;
    ctx.fillRect(0, 0, cw, ch);
    const grad = ctx.createRadialGradient(px(40), py(30), 6 * K, px(40), py(28), 60 * K);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,30,15,0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // traces: fan out from the SoC, plus decorative ones
    const traces = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = 8.5;
      const r1 = 14 + rnd() * 10;
      const sx = 29.5 + Math.cos(a) * r0;
      const sy = 31.5 + Math.sin(a) * r0;
      const q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      traces.push([[sx, sy], [sx + Math.cos(q) * r1 * 0.5, sy + Math.sin(q) * r1 * 0.5], [sx + Math.cos(q) * r1, sy + Math.sin(q) * r1]]);
    }
    for (let i = 0; i < 60; i++) {
      const a = [3 + rnd() * 78, 3 + rnd() * 50];
      const len = 3 + rnd() * 10;
      const ang = Math.floor(rnd() * 8) * (Math.PI / 4);
      const b = [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
      const ang2 = ang + (rnd() > 0.5 ? 1 : -1) * (Math.PI / 4);
      const c = [b[0] + Math.cos(ang2) * len * 0.6, b[1] + Math.sin(ang2) * len * 0.6];
      traces.push([a, b, c]);
    }
    for (const t of traces) {
      const pts = t.map(([x, y]) => [Math.min(Math.max(x, 1), W - 1), Math.min(Math.max(y, 1), H - 1)]);
      for (const [style, width] of [[C.traceEdge, 0.5], [C.trace, 0.28]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width * K;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
        ctx.stroke();
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = 2 + rnd() * 81;
      const y = 2 + rnd() * 52;
      ctx.fillStyle = C.via;
      ctx.beginPath();
      ctx.arc(px(x), py(y), 0.4 * K, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.viaHole;
      ctx.beginPath();
      ctx.arc(px(x), py(y), 0.17 * K, 0, Math.PI * 2);
      ctx.fill();
    }

    // soft shadows under the tall parts
    const prints = [
      ...PORTS.map((p) => ({ ...p, ...PORT_SIZE[p.type] })),
      ...CHIPS.map((c) => ({ x: c.x, y: c.y, w: c.w ?? 15, d: c.d ?? 15, h: 1.5 })),
      { x: GPIO.x, y: GPIO.y, w: GPIO.cols * P, d: GPIO.rows * P, h: 8.5 },
      { x: POE.x, y: POE.y, w: 2 * P, d: 2 * P, h: 8.5 },
    ];
    for (const f of prints) {
      const h = f.h ?? 2;
      ctx.save();
      ctx.shadowColor = `rgba(5, 30, 15, ${Math.min(0.3 + h * 0.03, 0.6)})`;
      ctx.shadowBlur = Math.min(0.4 + Math.sqrt(h) * 0.4, 1.8) * K;
      ctx.fillStyle = 'rgba(5, 30, 15, 0.25)';
      rectAt(ctx, f.x - 0.3, f.y - 0.5, f.w + 0.4, f.d + 0.4, 0, (x, y, w, d) => ctx.fillRect(x, y, w, d));
      ctx.restore();
    }

    // pads for the small parts, the chips' outlines, the GPIO silkscreen box
    for (const [x, y, rot = 0] of SMALL) {
      for (const s of [-1, 1]) {
        rectAt(ctx, x + (rot ? 0 : s * 0.8), y + (rot ? s * 0.8 : 0), 0.7, 0.9, rot, (a, b, w, d) => {
          ctx.fillStyle = C.padShade;
          ctx.fillRect(a - 1, b - 1, w + 2, d + 2);
          ctx.fillStyle = C.pad;
          ctx.fillRect(a, b, w, d);
        });
      }
    }
    ctx.strokeStyle = C.silk;
    ctx.fillStyle = C.silk;
    ctx.lineWidth = 0.18 * K;
    for (const c of CHIPS) rectAt(ctx, c.x, c.y, (c.w ?? 15) + 0.8, (c.d ?? 15) + 0.8, 0, (x, y, w, d) => ctx.strokeRect(x, y, w, d));
    ctx.lineWidth = 0.22 * K;
    rectAt(ctx, GPIO.x, GPIO.y, GPIO.cols * P + 0.6, GPIO.rows * P + 0.6, 0, (x, y, w, d) => ctx.strokeRect(x, y, w, d));
    ctx.strokeRect(px(2.4), py(48.2), 4.6 * K, 2.2 * K);
    text(ctx, 'GPIO', 4.7, 47.1, 1.2, { weight: 700 });

    // labels
    text(ctx, 'Raspberry Pi 4 Model B', 22, 43.6, 1.7, { align: 'left', weight: 700 });
    text(ctx, '© Raspberry Pi 2018', 22, 41.4, 1.25, { align: 'left', weight: 500 });
    text(ctx, 'PWR IN', 11.2, 8.4, 1.1);
    text(ctx, 'HDMI0', 26, 8.4, 1.1);
    text(ctx, 'HDMI1', 39.5, 8.4, 1.1);
    text(ctx, 'AUDIO', 53.5, 12.2, 1.1);
    text(ctx, 'CAMERA', 49.2, 18.5, 1.1, { rot: 90 });
    text(ctx, 'DISPLAY', 8.2, 26, 1.1, { rot: 90 });
    text(ctx, 'PoE', 58.5, 42.8, 1.1);
    text(ctx, 'PWR', 5, 10.5, 1, { align: 'left' });
    text(ctx, 'ACT', 5, 13, 1, { align: 'left' });
    text(ctx, 'RUN', 18, 17.6, 1);
    text(ctx, 'USB 3', 70.5, 20.5, 1.1, { rot: 90 });
    text(ctx, 'USB 2', 70.5, 2.6, 1.1, { rot: 90 });
    text(ctx, 'Made in the UK', 28, 25.2, 1.1, { align: 'left', weight: 500 });
    for (const [x, y] of [[17, 18.8], [19, 18.8]]) {
      ctx.fillStyle = C.pad;
      ctx.beginPath();
      ctx.arc(px(x), py(y), 0.55 * K, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = C.silk;

    // a raspberry: seven berries and two leaves, drawn with circles
    const lx = 12.5;
    const ly = 21.5;
    ctx.lineWidth = 0.22 * K;
    for (const [dx, dy, r] of [[-1.5, 0.6, 1.25], [1.5, 0.6, 1.25], [0, 0.2, 1.25], [-1.4, -1.4, 1.2], [1.4, -1.4, 1.2], [0, -2.4, 1.15], [0, -1.1, 1.1]]) {
      ctx.beginPath();
      ctx.arc(px(lx + dx), py(ly + dy), r * K, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(px(lx + s * 1.3), py(ly + 2.6), 1.5 * K, 0.7 * K, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // mounting hole rings
    for (const [x, y] of HOLES) {
      ctx.fillStyle = C.ring;
      ctx.beginPath();
      ctx.arc(px(x), py(y), 3.1 * K, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7c470';
      ctx.beginPath();
      ctx.arc(px(x), py(y), 2.2 * K, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

const PORT_SIZE = {
  ethernet: { w: 21, d: 16, h: 13.5 },
  usb: { w: 17.5, d: 13.1, h: 15.5 },
  usbc: { w: 9, d: 7.5, h: 3.2 },
  hdmi: { w: 6.5, d: 7.5, h: 3 },
  audio: { w: 7, d: 12.5, h: 6 },
  fpc: { w: 4, d: 22, h: 5.5 },
};

// --- 3D builders -------------------------------------------------------------------

const M = {
  metal: std('#e9e4d6', 0.38, 0.45),
  metalDark: std('#b9b3a4', 0.5, 0.35),
  dark: std('#1b1e27', 0.7),
  plastic: std('#2c3041', 0.5),
  chip: std('#2a2d38', 0.45),
  pin: std('#e8e2d6', 0.32, 0.55),
  cream: std('#efe7d6', 0.55),
  blue: std('#2f6fd6', 0.45),
  gold: std('#d8b85c', 0.4, 0.3),
};
for (const m of Object.values(M)) m.userData.shared = true;

function chipLabel(textStr, w, h, sub) {
  return canvasTexture(512, 256, (ctx, cw, ch) => {
    ctx.fillStyle = '#2a2d38';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(210, 215, 225, 0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 46px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.fillText(textStr, cw / 2, ch / 2 - (sub ? 22 : 0));
    if (sub) {
      ctx.font = '500 30px "Barlow Semi Condensed", system-ui, sans-serif';
      ctx.fillText(sub, cw / 2, ch / 2 + 30);
    }
    ctx.fillStyle = 'rgba(210, 215, 225, 0.5)';
    ctx.beginPath();
    ctx.arc(34, ch - 34, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

function chip(w, d, h, textStr, sub) {
  const g = new THREE.Group();
  g.add(box(w, h, d, M.chip));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3), std('#ffffff', 0.45, 0, { map: chipLabel(textStr, w, d, sub) }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = h + 0.01;
  g.add(top);
  return g;
}

function soc() {
  const g = new THREE.Group();
  g.add(box(15, 0.6, 15, M.dark));
  g.add(box(13.6, 1, 13.6, M.metal, 0, 0.6, 0));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 12.5), std('#ffffff', 0.4, 0.4, { map: canvasTexture(512, 512, (ctx, cw, ch) => {
    ctx.fillStyle = '#e4dfd2';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(60, 60, 70, 0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 54px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.fillText('BCM2711', cw / 2, ch / 2 - 10);
    ctx.font = '500 34px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.fillText('Broadcom', cw / 2, ch / 2 + 44);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(60, 60, 70, 0.3)';
    ctx.strokeRect(40, 40, cw - 80, ch - 80);
  }) }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 1.61;
  g.add(top);
  return g;
}

function metalCan(w, d, h = 1.6) {
  const g = new THREE.Group();
  g.add(box(w, h, d, M.metal));
  g.add(box(w - 1.2, 0.08, d - 1.2, M.metalDark, 0, h, 0));
  return g;
}

function pinHeader(cols, rows) {
  const g = new THREE.Group();
  g.add(box(cols * P - 0.06, 2.5, rows * P - 0.06, M.plastic));
  const pins = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = (c - (cols - 1) / 2) * P;
      const z = -(r - (rows - 1) / 2) * P;
      const shaft = new THREE.BoxGeometry(0.64, 6, 0.64);
      shaft.translate(x, 5.5, z);
      pins.push(shaft);
      const tip = new THREE.ConeGeometry(0.45, 0.5, 4, 1);
      tip.rotateY(Math.PI / 4);
      tip.translate(x, 8.75, z);
      pins.push(tip.toNonIndexed());
    }
  g.add(new THREE.Mesh(mergeGeometries(pins.map((p) => (p.index ? p.toNonIndexed() : p))), M.pin));
  return g;
}

// Ports face +x (the right edge) or +z (the bottom edge, toward the viewer).
function ethernet() {
  const { w, d, h } = PORT_SIZE.ethernet;
  const g = new THREE.Group();
  g.add(box(w, h, d, M.metal));
  g.add(box(0.3, 11, 11.5, M.dark, w / 2, 1.6, 0)); // the socket opening
  g.add(box(0.5, 2, 6, M.dark, w / 2 + 0.05, 10.2, 0)); // latch slot
  g.add(box(0.3, 1, 1.6, std('#3fbf6a', 0.4, 0, { emissive: '#1d5a12', emissiveIntensity: 0.4 }), w / 2 + 0.02, 0.6, -6));
  g.add(box(0.3, 1, 1.6, std('#f0a53a', 0.4, 0, { emissive: '#7a4300', emissiveIntensity: 0.4 }), w / 2 + 0.02, 0.6, 6));
  g.add(box(w - 2, 0.1, d - 2, M.metalDark, 0, h, 0));
  return g;
}

function usbStack(blue) {
  const { w, d, h } = PORT_SIZE.usb;
  const g = new THREE.Group();
  g.add(box(w, h, d, M.metal));
  g.add(box(w - 2, 0.1, d - 2, M.metalDark, 0, h, 0));
  for (const y of [1.2, 8.4]) {
    g.add(box(0.3, 5.5, 11.6, M.dark, w / 2, y, 0)); // opening
    g.add(box(0.5, 1.6, 9.6, blue ? M.blue : M.cream, w / 2 - 0.1, y + 3.2, 0)); // the tongue
  }
  return g;
}

function usbC() {
  const { w, d, h } = PORT_SIZE.usbc;
  const g = new THREE.Group();
  g.add(box(w, h, d, M.metal));
  const opening = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6.2, 24), M.dark);
  opening.rotation.z = Math.PI / 2;
  opening.position.set(0, h / 2, d / 2);
  g.add(opening);
  g.add(box(6.2, 2.4, 0.3, M.dark, 0, h / 2 - 1.2, d / 2));
  return g;
}

function microHdmi() {
  const { w, d, h } = PORT_SIZE.hdmi;
  const g = new THREE.Group();
  g.add(box(w, h, d, M.metal));
  g.add(box(5.4, 1.6, 0.3, M.dark, 0, 0.7, d / 2));
  g.add(box(4.4, 0.4, 0.3, M.gold, 0, 1.3, d / 2 + 0.02));
  return g;
}

function audioJack() {
  const { w, d, h } = PORT_SIZE.audio;
  const g = new THREE.Group();
  g.add(box(w, h, d - 2.5, M.plastic, 0, 0, -1.25));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 32), M.plastic);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, h / 2, d / 2 - 1.5);
  g.add(barrel);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 24), M.dark);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, h / 2, d / 2 + 0.05);
  g.add(hole);
  return g;
}

function fpcConnector() {
  const { w, d, h } = PORT_SIZE.fpc;
  const g = new THREE.Group();
  g.add(box(w, h - 1.5, d, M.cream));
  g.add(box(w - 1, 1.5, d - 2, M.dark, 0, h - 1.5, 0));
  g.add(box(w - 0.6, 0.6, d - 1, std('#d9d2c0', 0.5), 0, h - 0.6, 0));
  return g;
}

function smallPart(rot) {
  const g = new THREE.Group();
  g.add(box(1, 0.55, 0.8, Math.random() > 0.5 ? M.dark : std('#c9ad7a', 0.5), 0, 0, 0));
  g.add(box(0.32, 0.57, 0.82, M.pin, -0.66, 0, 0));
  g.add(box(0.32, 0.57, 0.82, M.pin, 0.66, 0, 0));
  g.rotation.y = (rot ?? 0) * DEG;
  return g;
}

function statusLed(color) {
  const g = new THREE.Group();
  g.add(box(1.6, 0.35, 0.8, M.cream));
  const lens = std(color, 0.35, 0, { emissive: color, emissiveIntensity: 0.35 });
  g.add(box(1.2, 0.45, 0.6, lens, 0, 0.35, 0));
  g.userData.lens = lens;
  g.rotation.y = Math.PI / 2;
  return g;
}

function buildPort(p) {
  switch (p.type) {
    case 'ethernet': return ethernet();
    case 'usb': return usbStack(p.blue);
    case 'usbc': return usbC();
    case 'hdmi': return microHdmi();
    case 'audio': return audioJack();
    case 'fpc': return fpcConnector();
    default: return null;
  }
}

const INFO = {
  board: ['Raspberry Pi 4 Model B', 'A full Linux computer: quad-core ARM, up to 8 GB of RAM, on a credit-card PCB.'],
  gpio: ['40-pin GPIO header', '26 programmable pins plus power, ground, I²C, SPI and UART.'],
  poe: ['PoE header', 'For the Power-over-Ethernet HAT.'],
  ethernet: ['Gigabit Ethernet', 'Wired network, with link and activity LEDs.'],
  usb3: ['USB 3.0 ports', 'The blue pair: 5 Gbit/s for fast storage.'],
  usb2: ['USB 2.0 ports', 'Keyboard, mouse and slower devices.'],
  usbc: ['USB-C power', '5 V at 3 A in.'],
  hdmi: ['micro HDMI', 'Two displays, up to 4K each.'],
  audio: ['Audio and composite', 'Headphones out and analogue video on one jack.'],
  CAMERA: ['Camera connector', 'Ribbon cable to the Pi camera (CSI).'],
  DISPLAY: ['Display connector', 'Ribbon cable to the official touchscreen (DSI).'],
  soc: ['BCM2711', 'The system-on-chip: four Cortex-A72 cores at 1.5 GHz, under a metal lid.'],
  LPDDR4: ['LPDDR4 RAM', '2, 4 or 8 GB of memory.'],
  BCM54213: ['Ethernet PHY', 'Drives the gigabit port.'],
  VL805: ['USB 3.0 controller', 'Connected to the SoC over PCIe.'],
  PMIC: ['Power management IC', 'Turns 5 V into the rails the chips need.'],
  can: ['Wireless module', 'Wi-Fi 5 and Bluetooth 5 under a shielding can.'],
  PWR: ['PWR LED', 'Red: the board has power.'],
  ACT: ['ACT LED', 'Green: flickers with SD card activity.'],
};
const info = (key) => {
  const [name, desc] = INFO[key] ?? [];
  return name ? { name, desc, key } : null;
};

export function raspberryPi4({ renderer } = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.set(-W / 2, 0, H / 2);
  root.add(inner);
  const place = (obj, x, y, rot = 0) => {
    obj.position.set(x, 0, -y);
    obj.rotation.y = rot * DEG;
    inner.add(obj);
    return obj;
  };

  // PCB: rounded rectangle with four holes, painted top
  const shape = new THREE.Shape();
  const r = 3;
  shape.moveTo(r, 0);
  shape.lineTo(W - r, 0);
  shape.absarc(W - r, r, r, -Math.PI / 2, 0, false);
  shape.lineTo(W, H - r);
  shape.absarc(W - r, H - r, r, 0, Math.PI / 2, false);
  shape.lineTo(r, H);
  shape.absarc(r, H - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(0, r);
  shape.absarc(r, r, r, Math.PI, (Math.PI * 3) / 2, false);
  for (const [x, y] of HOLES) {
    const hole = new THREE.Path();
    hole.absarc(x, y, 1.375, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -T, 0);
  const tex = topTexture();
  tex.repeat.set(1 / W, 1 / H);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const pcb = new THREE.Mesh(geo, [std('#ffffff', 0.75, 0, { map: tex }), std('#2b7a4b', 0.8)]);
  pcb.userData.part = { ...info('board'), lift: false };
  inner.add(pcb);

  place(pinHeader(GPIO.cols, GPIO.rows), GPIO.x, GPIO.y).userData.part = info('gpio');
  place(pinHeader(POE.cols, POE.rows), POE.x, POE.y).userData.part = info('poe');

  for (const p of PORTS) {
    const obj = buildPort(p);
    if (!obj) continue;
    place(obj, p.x, p.y);
    const key = p.type === 'usb' ? (p.blue ? 'usb3' : 'usb2') : (p.label ?? p.type);
    obj.userData.part = info(key);
  }

  for (const c of CHIPS) {
    let obj;
    if (c.type === 'soc') obj = soc();
    else if (c.type === 'can') obj = metalCan(c.w, c.d);
    else obj = chip(c.w, c.d, 1, c.text, c.text === 'LPDDR4' ? 'Micron' : undefined);
    place(obj, c.x, c.y);
    obj.userData.part = info(c.type === 'chip' ? c.text : c.type);
  }

  for (const [x, y, rot] of SMALL) place(smallPart(rot), x, y);

  const leds = {};
  for (const l of LEDS) {
    const obj = place(statusLed(l.color), l.x, l.y);
    obj.userData.part = info(l.name);
    leds[l.name] = obj.userData.lens;
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  root.userData.leds = leds;
  root.userData.part = { ...info('board'), lift: false, big: true };
  anchor(root, 0, 16, 0);
  return root;
}
