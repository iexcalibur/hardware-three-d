import * as THREE from 'three';
import { box, canvasTexture, std, anchor } from '../board/materials.js';

const P = 2.54;

export const BB = {
  cols: 23,
  height: 8.5,
  width: 62,
  depth: 35,
  rows: { a: 13.97, b: 11.43, c: 8.89, d: 6.35, e: 3.81, f: -3.81, g: -6.35, h: -8.89, i: -11.43, j: -13.97 },
};

const widthFor = (cols) => (cols === BB.cols ? BB.width : cols * P + 3.6);

// Local position of a hole (column 1..cols, row a..j), on the top face.
export function holeLocal(col, row, cols = BB.cols) {
  return new THREE.Vector3((col - (cols + 1) / 2) * P, BB.height, BB.rows[row]);
}

// Painted top face of one half: hole squares, row letters, column numbers.
function halfTexture(front, cols) {
  const w = widthFor(cols);
  const mid = (cols + 1) / 2;
  const S = 22; // px per mm
  return canvasTexture(Math.round(w * S), Math.round(15.9 * S), (ctx, cw, ch) => {
    ctx.fillStyle = '#f5efe3';
    ctx.fillRect(0, 0, cw, ch);
    const zOffset = front ? 1.6 : -17.5;
    const rows = front ? ['e', 'd', 'c', 'b', 'a'] : ['j', 'i', 'h', 'g', 'f'];
    for (const r of rows) {
      const y = (BB.rows[r] - zOffset) * S;
      for (let c = 1; c <= cols; c++) {
        const x = (w / 2 + (c - mid) * P) * S;
        ctx.fillStyle = '#e1d7c4';
        ctx.fillRect(x - 0.78 * S, y - 0.78 * S, 1.56 * S, 1.56 * S);
        ctx.fillStyle = '#3b3d47';
        ctx.fillRect(x - 0.52 * S, y - 0.52 * S, 1.04 * S, 1.04 * S);
      }
      ctx.fillStyle = '#a69c8b';
      ctx.font = `600 ${1.5 * S}px "Barlow Semi Condensed", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r, 1.5 * S, y);
      ctx.fillText(r, cw - 1.5 * S, y);
    }
    ctx.font = `600 ${1.3 * S}px "Barlow Semi Condensed", system-ui, sans-serif`;
    const ny = front ? ch - 0.95 * S : 0.95 * S;
    for (let c = 1; c <= cols; c++) {
      if (c === 1 || c % 5 === 0) ctx.fillText(String(c), (w / 2 + (c - mid) * P) * S, ny);
    }
  });
}

export function breadboard({ cols = BB.cols } = {}) {
  const g = new THREE.Group();
  const w = widthFor(cols);
  const h = BB.height;
  const side = std('#ebe3d2', 0.75);
  for (const front of [true, false]) {
    const top = std('#ffffff', 0.7, 0, { map: halfTexture(front, cols) });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 15.9), [side, side, top, side, side, side]);
    slab.position.set(0, h / 2, (front ? 1 : -1) * 9.55);
    g.add(slab);
  }
  g.add(box(w, h - 2.4, 3.2, side)); // centre trough
  g.add(box(w - 2, 0.6, BB.depth - 2, std('#d9cfbb', 0.8), 0, -0.6, 0)); // base plate
  g.userData.part = { name: 'Breadboard', desc: 'The five holes in each short row are joined underneath.' };
  anchor(g, -w / 2 + 6, h, 0);
  return g;
}
