import * as THREE from 'three';
import { box, canvasTexture, std, anchor, FX_LAYER } from '../board/materials.js';

const P = 2.54;

export const LED_COLORS = {
  red: '#e8392e',
  yellow: '#f2c23a',
  green: '#3fbf6a',
  blue: '#3d7be0',
  white: '#f2efe6',
};

// Forward voltage per colour, used for the brightness estimate.
export const LED_VF = { red: 1.8, yellow: 2.0, green: 2.2, blue: 3.0, white: 3.2 };

const BAND_COLORS = {
  black: '#2b2b2b',
  brown: '#7a4a2a',
  red: '#d0412f',
  orange: '#e8892f',
  yellow: '#efc540',
  green: '#3fae6a',
  blue: '#3d6fc4',
  gold: '#c9a54a',
};

// Standard 4-band code for the values the lessons use.
export function bandsFor(ohms) {
  const digits = String(Math.round(ohms));
  const names = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue'];
  const a = names[Number(digits[0])];
  const b = names[Number(digits[1] ?? 0)];
  const mult = names[digits.length - 2] ?? 'black';
  return [a, b, mult, 'gold'];
}

export function resistor(ohms = 220, span = 4 * P, { lift = 3.4 } = {}) {
  const g = new THREE.Group();
  const bodyLen = 6.4;
  const profile = [
    [0, -bodyLen / 2 - 0.4], [0.75, -bodyLen / 2 - 0.35], [1.25, -bodyLen / 2], [1.3, -2.1],
    [1.08, -bodyLen / 2 + 1.7], [1.08, bodyLen / 2 - 1.7], [1.3, bodyLen / 2 - 1.1], [1.25, bodyLen / 2],
    [0.75, 3.55], [0, 3.6],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), std('#e6cfa4', 0.55));
  body.rotation.z = Math.PI / 2;
  body.position.y = lift;
  g.add(body);

  const bandX = [-2, -1, 0, 1.9];
  bandsFor(ohms).forEach((name, i) => {
    const r = Math.abs(bandX[i]) > 1.6 ? 1.33 : 1.12;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 32, 1, true), std(BAND_COLORS[name], 0.5));
    band.rotation.z = Math.PI / 2;
    band.position.set(bandX[i], lift, 0);
    g.add(band);
  });

  const leadMat = std('#d4d0c8', 0.3, 0.65);
  for (const s of [-1, 1]) {
    const path = new THREE.CurvePath();
    const p0 = new THREE.Vector3((s * bodyLen) / 2, lift, 0);
    const p1 = new THREE.Vector3((s * span) / 2 - s * 0.6, lift, 0);
    const corner = new THREE.Vector3((s * span) / 2, lift, 0);
    const p2 = new THREE.Vector3((s * span) / 2, lift - 0.6, 0);
    const p3 = new THREE.Vector3((s * span) / 2, -0.5, 0);
    path.add(new THREE.LineCurve3(p0, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, corner, p2));
    path.add(new THREE.LineCurve3(p2, p3));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.3, 6, false), leadMat));
  }
  const label = ohms >= 1000 ? `${ohms / 1000} kΩ` : `${ohms} Ω`;
  g.userData.part = { name: `${label} resistor`, desc: 'Limits the current flowing through the circuit.' };
  anchor(g, 0, lift + 1.3, 0);
  return g;
}

let glowTexture;
function glowSprite(color, size) {
  glowTexture ??= canvasTexture(128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  });
  glowTexture.userData.shared = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0, depthWrite: false }),
  );
  sprite.scale.set(size, size, 1);
  sprite.layers.set(FX_LAYER);
  return sprite;
}

// A 5 mm LED standing in two breadboard holes (legs 2.54 mm apart).
export function led(colorName = 'red', { height = 9 } = {}) {
  const color = LED_COLORS[colorName] ?? LED_COLORS.red;
  const g = new THREE.Group();
  const lens = std(color, 0.22, 0, { emissive: color, emissiveIntensity: 0.05 });
  const profile = [[0, 0], [2.95, 0], [2.95, 1.1], [2.5, 1.1], [2.5, 5.6]].map(([r, y]) => new THREE.Vector2(r, y));
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    profile.push(new THREE.Vector2(Math.cos(a) * 2.5, 5.6 + Math.sin(a) * 2.5));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), lens);
  body.position.y = height;
  g.add(body);
  const legMat = std('#d2cfc8', 0.35, 0.6);
  for (const x of [-1.27, 1.27]) g.add(box(0.55, height, 0.55, legMat, x, 0, 0));
  const glow = glowSprite(color, 26);
  glow.position.y = height + 4.5;
  g.add(glow);
  g.userData.light = { lens, glow };
  g.userData.part = { name: '5 mm LED', desc: 'Lights when current flows from the long leg (anode) to the short leg.' };
  anchor(g, 0, height + 8.2, 0);
  return g;
}

// Drive an LED's lens and glow from a 0..1 level.
export function setLight(light, level) {
  if (!light) return;
  light.lens.emissiveIntensity = 0.05 + level * 1.4;
  light.glow.material.opacity = level * 0.85;
}

// Rough brightness for a 5 V supply through `ohms` into an LED of `color`.
export function ledBrightness(ohms, color = 'red') {
  const mA = ((5 - (LED_VF[color] ?? 2)) / ohms) * 1000;
  return Math.min(1, (mA / 13.6) ** 0.55);
}
