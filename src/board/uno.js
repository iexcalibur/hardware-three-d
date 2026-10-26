import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as D from './unoData.js';
import { pcbTexture } from './pcbTexture.js';
import { palette, box, canvasTexture, std } from './materials.js';

const DEG = Math.PI / 180;
const P = D.PITCH;

// Shape helpers -------------------------------------------------------------

function roundedPolygon(points, radius) {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[(i - 1 + n) % n];
    const [bx, by] = points[i];
    const [cx, cy] = points[(i + 1) % n];
    const d1 = Math.hypot(bx - ax, by - ay);
    const d2 = Math.hypot(cx - bx, cy - by);
    const r1 = Math.min(radius, d1 / 2);
    const r2 = Math.min(radius, d2 / 2);
    const inX = bx + ((ax - bx) / d1) * r1;
    const inY = by + ((ay - by) / d1) * r1;
    const outX = bx + ((cx - bx) / d2) * r2;
    const outY = by + ((cy - by) / d2) * r2;
    if (i === 0) shape.moveTo(inX, inY);
    else shape.lineTo(inX, inY);
    shape.quadraticCurveTo(bx, by, outX, outY);
  }
  shape.closePath();
  return shape;
}

// Extrude a shape upward: shape (x, y) ends up at world (x, 0..depth, -y).
function extrudeUp(shape, depth, options = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24, ...options });
  g.rotateX(-Math.PI / 2);
  return g;
}

function rectShape(w, d, x = 0, y = 0) {
  const s = new THREE.Shape();
  s.moveTo(x - w / 2, y - d / 2);
  s.lineTo(x + w / 2, y - d / 2);
  s.lineTo(x + w / 2, y + d / 2);
  s.lineTo(x - w / 2, y + d / 2);
  s.closePath();
  return s;
}

function rectHole(w, d, x, y) {
  const p = new THREE.Path();
  p.moveTo(x - w / 2, y - d / 2);
  p.lineTo(x - w / 2, y + d / 2);
  p.lineTo(x + w / 2, y + d / 2);
  p.lineTo(x + w / 2, y - d / 2);
  p.closePath();
  return p;
}

function pill(w, h) {
  const r = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -r);
  s.lineTo(w / 2 - r, -r);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, r);
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return s;
}

// Component builders ----------------------------------------------------------

function femaleHeader(n, m) {
  const g = new THREE.Group();
  const w = n * P;
  g.add(box(w - 0.06, 7.4, 2.48, m.header));
  const plate = rectShape(w - 0.06, 2.48);
  for (let i = 0; i < n; i++) plate.holes.push(rectHole(1.05, 1.05, -w / 2 + P / 2 + i * P, 0));
  const top = new THREE.Mesh(extrudeUp(plate, 1.1), m.header);
  top.position.y = 7.4;
  g.add(top);
  for (let i = 0; i < n; i++) {
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), m.headerHole);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(-w / 2 + P / 2 + i * P, 7.41, 0);
    g.add(hole);
  }
  for (let i = 1; i < n; i++) g.add(box(0.12, 0.9, 0.08, m.headerHole, -w / 2 + i * P, 7.5, P / 2 - 0.02));
  return g;
}

function maleHeader(cols, rows, m) {
  const g = new THREE.Group();
  g.add(box(cols * P - 0.06, 2.5, rows * P - 0.06, m.plastic));
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
  g.add(new THREE.Mesh(mergeGeometries(pins.map((p) => (p.index ? p.toNonIndexed() : p))), m.pin));
  return g;
}

function dipChip(m) {
  const g = new THREE.Group();
  const bodyW = 35.4;
  for (const side of [-1, 1]) g.add(box(36.6, 2.6, 2.4, m.plastic, 0, 0, side * 4.01));
  g.add(box(1.6, 2, 7.62, m.plastic, -17.5, 0, 0));
  g.add(box(1.6, 2, 7.62, m.plastic, 17.5, 0, 0));
  g.add(box(bodyW, 3.1, 6.9, m.chip, 0, 2.95, 0));
  const label = canvasTexture(1024, 200, (ctx, w, h) => {
    ctx.fillStyle = '#2a2c36';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1b22';
    ctx.beginPath();
    ctx.arc(0, h / 2, 26, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, h - 44, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(205, 205, 215, 0.42)';
    ctx.font = '600 44px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('ATMEGA328P-PU', 300, h / 2 - 22);
    ctx.font = '500 30px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.fillText('AU 1952   ◆ ATMEL', 300, h / 2 + 30);
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(bodyW, 6.9), std('#ffffff', 0.45, 0, { map: label }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 6.055;
  g.add(top);
  const legs = [];
  for (let i = 0; i < 14; i++) {
    const x = -16.51 + i * P;
    for (const side of [-1, 1]) {
      const a = new THREE.BoxGeometry(1.3, 0.32, 0.8);
      a.translate(x, 4.05, side * 3.85);
      const b = new THREE.BoxGeometry(1.4, 1, 0.32);
      b.translate(x, 3.57, side * 4.35);
      const c = new THREE.BoxGeometry(0.55, 3.25, 0.32);
      c.translate(x, 3.25 / 2, side * 4.35);
      legs.push(a, b, c);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(legs), m.pin));
  return g;
}

function usbB(m) {
  const g = new THREE.Group();
  const w = 14.8;
  const d = 11.6;
  const h = 10.4;
  g.add(box(w, h, d, m.metal));
  g.add(box(10.4, 0.18, 8.2, m.metal, 1.3, h, 0));
  g.add(box(5.6, 5, 0.22, m.metal, 3.3, 2.5, d / 2));
  g.add(box(0.24, 6, 7, m.metal, w / 2, 2.4, 0.8));
  g.add(box(0.2, 7.4, 8.2, m.plastic, -w / 2 - 0.01, 1.7, 0));
  g.add(box(0.3, 2.6, 5.2, m.cream, -w / 2 - 0.1, 3.2, 0));
  return g;
}

function powerJack(m) {
  const g = new THREE.Group();
  g.add(box(3.4, 11, 9, m.plastic, -5.4, 0, 0));
  g.add(box(10.8, 6, 9, m.plastic, 1.7, 0, 0));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 10.8, 40, 1), m.plastic);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(1.7, 6, 0);
  g.add(barrel);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.3, 32), m.headerHole);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(-7.12, 6, 0);
  g.add(mouth);
  const centrePin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.2, 20), m.tan);
  centrePin.rotation.z = Math.PI / 2;
  centrePin.position.set(-7.4, 6, 0);
  g.add(centrePin);
  return g;
}

function resetButton(m) {
  const g = new THREE.Group();
  g.add(box(6, 2.4, 6, m.plastic));
  g.add(box(5.2, 0.35, 5.2, m.chip, 0, 2.4, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16), m.pin);
    rivet.position.set(sx * 2.15, 2.85, sz * 2.15);
    g.add(rivet);
    g.add(box(0.7, 0.9, 0.5, m.pin, sx * 2, 0, sz * 3.2));
  }
  const cap = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [1.85, 0], [1.85, 1], [1.7, 1.35], [1.3, 1.5], [0, 1.55]].map(([r, y]) => new THREE.Vector2(r, y)), 40),
    m.red,
  );
  cap.position.y = 2.75;
  g.add(cap);
  return g;
}

let capLabel;
function electrolyticCap(m) {
  const g = new THREE.Group();
  g.add(box(6.6, 1.3, 6.6, m.plastic));
  const can = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.15, 5.4, 48), m.can);
  can.position.y = 4;
  g.add(can);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.22, 10, 48), m.can);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 6.62;
  g.add(rim);
  capLabel ??= canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dcdcd7';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b2d36';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, Math.PI * 0.62, Math.PI * 1.38);
    ctx.fill();
    ctx.fillStyle = '#d8d8d2';
    ctx.beginPath();
    ctx.arc(w / 2 + 6, h / 2, w / 2 - 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3c44';
    ctx.font = '700 54px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('47', w / 2 + 14, h / 2 - 30);
    ctx.fillText('25V', w / 2 + 14, h / 2 + 32);
  });
  capLabel.userData.shared = true;
  const top = new THREE.Mesh(new THREE.CircleGeometry(2.8, 48), std('#ffffff', 0.4, 0.35, { map: capLabel }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = Math.PI / 2;
  top.position.y = 6.71;
  g.add(top);
  return g;
}

function crystal(m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(extrudeUp(pill(11.2, 4.9), 0.5), m.metalDark));
  const body = new THREE.Mesh(
    extrudeUp(pill(10.4, 4.1), 2.7, { bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 4 }),
    m.metal,
  );
  body.position.y = 0.85;
  g.add(body);
  return g;
}

function soic(m, pins = 8, w = 4.9, d = 3.9, h = 1.45) {
  const g = new THREE.Group();
  g.add(box(w, h, d, m.chip, 0, 0.12, 0));
  const legs = [];
  const perSide = pins / 2;
  for (let i = 0; i < perSide; i++) {
    const x = (i - (perSide - 1) / 2) * 1.27;
    for (const side of [-1, 1]) {
      const a = new THREE.BoxGeometry(0.42, 0.2, 0.7);
      a.translate(x, 0.75, side * (d / 2 + 0.3));
      const b = new THREE.BoxGeometry(0.42, 0.75, 0.2);
      b.translate(x, 0.45, side * (d / 2 + 0.6));
      const c = new THREE.BoxGeometry(0.42, 0.18, 0.55);
      c.translate(x, 0.09, side * (d / 2 + 0.85));
      legs.push(a, b, c);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(legs), m.pin));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), m.headerHole);
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(-w / 2 + 0.8, h + 0.13, d / 2 - 0.8);
  g.add(dot);
  return g;
}

function sot223(m) {
  const g = new THREE.Group();
  g.add(box(6.5, 1.6, 3.5, m.chip, 0, 0.1, 0));
  g.add(box(3, 0.25, 1.7, m.pin, 0, 0, -2.6));
  for (const x of [-2.3, 0, 2.3]) {
    g.add(box(0.7, 0.25, 1.8, m.pin, x, 0, 2.5));
    g.add(box(0.7, 0.6, 0.25, m.pin, x, 0.2, 1.75));
  }
  return g;
}

function sot23(m) {
  const g = new THREE.Group();
  g.add(box(2.9, 1, 1.4, m.chip, 0, 0.12, 0));
  for (const [x, z] of [[-0.95, 1], [0.95, 1], [0, -1]]) g.add(box(0.42, 0.18, 0.7, m.pin, x, 0, z));
  return g;
}

function qfn(m) {
  const g = new THREE.Group();
  g.add(box(5, 0.9, 5, m.chip));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), m.headerHole);
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(-1.7, 0.91, 1.7);
  g.add(dot);
  return g;
}

function smd0603(m, type) {
  const g = new THREE.Group();
  if (type === 'r0603') {
    g.add(box(1, 0.45, 0.8, m.resBody));
    g.add(box(0.32, 0.47, 0.82, m.pin, -0.66, 0, 0));
    g.add(box(0.32, 0.47, 0.82, m.pin, 0.66, 0, 0));
  } else {
    g.add(box(1, 0.8, 0.8, m.tan));
    g.add(box(0.32, 0.82, 0.82, m.pin, -0.66, 0, 0));
    g.add(box(0.32, 0.82, 0.82, m.pin, 0.66, 0, 0));
  }
  return g;
}

function smdLed(m, color) {
  const g = new THREE.Group();
  g.add(box(2, 0.35, 1.25, m.ledBase));
  const lens = (color === 'green' ? m.green : m.amber).clone();
  g.add(box(1.5, 0.45, 1.1, lens, 0, 0.35, 0));
  g.userData.lens = lens;
  return g;
}

function buildPart(part, m) {
  switch (part.type) {
    case 'usb': return usbB(m);
    case 'jack': return powerJack(m);
    case 'reset': return resetButton(m);
    case 'dip': return dipChip(m);
    case 'maleHeader': return maleHeader(part.cols, part.rows, m);
    case 'ecap': return electrolyticCap(m);
    case 'crystal': return crystal(m);
    case 'qfn': return qfn(m);
    case 'soic8': return soic(m);
    case 'sot223': return sot223(m);
    case 'sot23': return sot23(m);
    case 'led': return smdLed(m, part.color);
    case 'r0603':
    case 'c0603': return smd0603(m, part.type);
    case 'polyfuse': {
      const g = new THREE.Group();
      g.add(box(3.4, 1.05, 3.2, m.cream));
      g.add(box(0.6, 1.1, 3.25, m.pin, -2, 0, 0));
      g.add(box(0.6, 1.1, 3.25, m.pin, 2, 0, 0));
      return g;
    }
    case 'sma': {
      const g = new THREE.Group();
      g.add(box(3.6, 2, 2.6, m.chip));
      g.add(box(0.5, 0.02, 2.62, m.metalDark, -1.25, 2, 0));
      g.add(box(0.9, 0.25, 1.5, m.pin, -2.1, 0, 0));
      g.add(box(0.9, 0.25, 1.5, m.pin, 2.1, 0, 0));
      return g;
    }
    case 'resonator': {
      const g = new THREE.Group();
      g.add(box(3.2, 1.2, 1.3, m.cream));
      return g;
    }
    case 'ferrite': {
      const g = new THREE.Group();
      g.add(box(2.2, 1.1, 1.6, m.darkMetal));
      g.add(box(0.5, 1.12, 1.62, m.pin, -1.35, 0, 0));
      g.add(box(0.5, 1.12, 1.62, m.pin, 1.35, 0, 0));
      return g;
    }
    case 'rarray': {
      const g = new THREE.Group();
      g.add(box(3.2, 0.5, 1.6, m.resBody));
      return g;
    }
    default:
      return null;
  }
}

// Human readable names for hover/select.
const INFO = {
  board: ['Arduino Uno', 'The brain of every lesson: an ATmega328P with 14 digital and 6 analog pins.'],
  digitalA: ['Digital pins 8 to 13', 'Outputs and inputs. The ~ pins can also fade with PWM.'],
  digitalB: ['Digital pins 0 to 7', 'Pins 0 and 1 double as the serial port.'],
  power: ['Power header', '5 V, 3.3 V and ground for your circuits.'],
  analog: ['Analog in', 'Six 10-bit inputs, 0 to 1023 for 0 to 5 V.'],
  usb: ['USB-B', 'Power and programming from your computer.'],
  jack: ['Barrel jack', '7 to 12 V in when the board runs on its own.'],
  reset: ['Reset button', 'Restarts the sketch from setup().'],
  dip: ['ATmega328P', 'The microcontroller: 32 KB of flash, 2 KB of RAM, 16 MHz.'],
  L: ['L LED', 'Wired to pin 13. The classic first blink.'],
  TX: ['TX LED', 'Flickers while the board sends serial data.'],
  RX: ['RX LED', 'Flickers while the board receives.'],
  ON: ['Power LED', 'On whenever the board has power.'],
  ecap: ['Capacitor', 'Smooths the supply voltage.'],
  crystal: ['16 MHz crystal', 'The heartbeat the chip counts time by.'],
};

export function buildUno(renderer) {
  const m = palette();
  const tex = pcbTexture(renderer);
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.set(-D.W / 2, 0, D.H / 2);
  root.add(inner);

  const place = (obj, x, y, rot = 0) => {
    obj.position.set(x, 0, -y);
    obj.rotation.y = rot * DEG;
    inner.add(obj);
    return obj;
  };
  const info = (key) => {
    const [name, desc] = INFO[key] ?? [];
    return name ? { name, desc, key } : null;
  };

  // the PCB itself
  const shape = roundedPolygon(D.outline, 1.1);
  for (const [x, y] of D.mountingHoles) {
    const hole = new THREE.Path();
    hole.absarc(x, y, 1.6, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const slabGeo = extrudeUp(shape, D.PCB_THICKNESS, { curveSegments: 32 });
  slabGeo.translate(0, -D.PCB_THICKNESS, 0);
  const slab = new THREE.Mesh(slabGeo, [std('#ffffff', 0.78, 0, { map: tex }), m.edge]);
  slab.userData.part = { ...info('board'), lift: false };
  inner.add(slab);

  for (const h of D.headers) {
    const header = place(femaleHeader(h.n, m), h.x, h.y);
    header.userData.part = info(h.id);
  }

  const leds = {};
  for (const p of D.parts) {
    const obj = buildPart(p, m);
    if (!obj) continue;
    place(obj, p.x, p.y, p.rot ?? 0);
    obj.userData.part = info(p.name ?? p.id ?? p.type);
    if (p.name && obj.userData.lens) leds[p.name] = obj.userData.lens;
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  const anchorAt = (x, y, h) => {
    const a = new THREE.Object3D();
    place(a, x, y);
    a.position.y = h;
    return a;
  };

  return {
    root,
    leds,
    anchors: {
      usb: anchorAt(-3, 32.3, 7.8),
      mcu: anchorAt(44, 19, 6.1),
      digital: anchorAt(42.9, 50.8, 8.5),
      jack: anchorAt(-0.4, 3.35, 7.4),
      power: anchorAt(32, 2.54, 8.5),
      analog: anchorAt(57.1, 2.54, 8.5),
      ledL: anchorAt(27.3, 40.2, 0.9),
    },
  };
}
