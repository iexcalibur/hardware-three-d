// TEMPLATE for a new part. Copy this file, rename the function, fill in the
// shapes. Read docs/BUILDING-PARTS.md first; it explains every convention.
//
// Rules in one breath: millimetres, y is up, the part stands on y = 0 at its
// own origin, legs on the 2.54 mm grid, one shared palette, labels painted on
// a canvas, userData.part for the hover card, an anchor for callouts.

import * as THREE from 'three';
import { box, std, canvasTexture, anchor } from '../board/materials.js';

const P = 2.54; // breadboard pitch

export function myPart({ color = '#3d6fc4' } = {}) {
  const g = new THREE.Group();

  // 1. Body: start with the biggest shape, placed so its bottom is at y = 0.
  //    box(w, h, d, material, x, yBottom, z)
  const body = std(color, 0.5);
  g.add(box(10, 6, 8, body, 0, 2, 0));

  // 2. Details: cylinders, lathes, extrusions. Keep counts low; the outline
  //    pass draws the edges, so flat colours read better than fine geometry.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.5, 32), std('#e8392e', 0.4));
  cap.position.set(0, 8, 0);
  g.add(cap);

  // 3. Labels: paint onto a canvas, map it onto a plane or a face.
  const label = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 40px "Barlow Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PART', w / 2, h / 2);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), std('#ffffff', 0.6, 0, { map: label }));
  face.position.set(0, 5, 4.01);
  g.add(face);

  // 4. Legs: on the 2.54 mm grid, from y = 2 (under the body) down to y = -0.5
  //    so they disappear into breadboard holes. Use the shared pin material.
  const legMat = std('#d2cfc8', 0.35, 0.6);
  for (const x of [-P / 2, P / 2]) g.add(box(0.55, 2.5, 0.55, legMat, x, -0.5, 0));

  // 5. Hooks the stage understands (all optional):
  //    g.userData.light = { lens, glow }   -> it can light up (see led())
  //    g.userData.cap = cap; g.userData.capY = cap.position.y -> it can be pressed
  //    g.userData.horn = mesh              -> something the sim rotates
  //    g.userData.tick = (now) => bool     -> self-animating part

  // 6. Hover card and callout anchor.
  g.userData.part = { name: 'My part', desc: 'One sentence about what it does.' };
  anchor(g, 0, 9, 0);

  return g;
}
