import * as THREE from 'three';
import { box, std, anchor } from '../board/materials.js';

// 12 mm tactile push button, the worked example in docs/BUILDING-PARTS.md.
// From the photo: a black square base, four silver corner rivets, a round
// coloured cap on a short stem, four bent legs 2 x 6.5 mm apart.

const P = 2.54;

export function pushButton({ color = '#e8392e', height = 4 } = {}) {
  const g = new THREE.Group();
  const plastic = std('#2c3041', 0.5);
  const silver = std('#d2cfc8', 0.35, 0.6);

  // base: 12 x 12 footprint, 3.5 mm tall, standing on y = 0
  g.add(box(12, 3.5, 12, plastic));
  g.add(box(10.4, 0.4, 10.4, std('#1c1f2b', 0.6), 0, 3.5, 0));

  // corner rivets
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16), silver);
    rivet.position.set(sx * 4.6, 3.9, sz * 4.6);
    g.add(rivet);
  }

  // stem and cap: the cap is what moves when pressed
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2, 32), plastic);
  stem.position.y = 4.5;
  g.add(stem);
  const profile = [[0, 0], [3.5, 0], [3.5, height - 0.8], [3, height], [0, height]].map(([r, y]) => new THREE.Vector2(r, y));
  const cap = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), std(color, 0.4));
  cap.position.y = 5.2;
  g.add(cap);

  // legs: two pairs 6.5 mm apart along z, each pair 2 columns (5.08 mm) apart
  // along x, bent outward like the real part, reaching below y = 0 into holes
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * P;
      const z = sz * 3.25;
      g.add(box(0.5, 1.6, 0.5, silver, x, -0.5, z)); // into the hole
      g.add(box(0.5, 0.5, Math.abs(z) - 2.5 + 0.5, silver, x, 0.6, sz * (2.5 + (Math.abs(z) - 2.5) / 2))); // horizontal run
      g.add(box(0.5, 1.2, 0.5, silver, x, 1.1, z)); // bend up into the base
    }

  // hooks for the stage: a pressable cap, a hover card, a callout anchor
  g.userData.cap = cap;
  g.userData.capY = cap.position.y;
  g.userData.part = { name: 'Push button', desc: 'Connects its two sides while you hold it down.' };
  anchor(g, 0, 5.2 + height + 2, 0);
  return g;
}
