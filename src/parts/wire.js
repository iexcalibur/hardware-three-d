import * as THREE from 'three';
import { box, std, anchor } from '../board/materials.js';

const PLUG_HEIGHT = 8.5;
const plugDark = std('#24272f', 0.5);
const plugPin = std('#d9d4ca', 0.3, 0.7);
plugDark.userData.shared = true;
plugPin.userData.shared = true;

// A jumper wire: a cubic Bezier tube from a to b that rises by `arch`, with a
// plug on each end. The tube's draw range lets the stage "grow" it in.
export function jumperWire(a, b, color, { arch = 14, lean = 0.18, leanB = lean, endA = true, endB = true } = {}) {
  const g = new THREE.Group();
  const start = a.clone();
  const end = b.clone();
  if (endA) start.y += PLUG_HEIGHT;
  if (endB) end.y += PLUG_HEIGHT;
  const top = Math.max(start.y, end.y) + arch;
  const c1 = new THREE.Vector3(start.x, top, start.z).lerp(end, lean);
  c1.y = top;
  const c2 = new THREE.Vector3(end.x, top, end.z).lerp(start, leanB);
  c2.y = top;
  const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
  const geo = new THREE.TubeGeometry(curve, 96, 0.72, 8, false);
  const tube = new THREE.Mesh(geo, std(color, 0.42));
  g.add(tube);

  const ends = [];
  for (const [has, at] of [[endA, a], [endB, b]]) {
    const plug = new THREE.Group();
    plug.position.copy(at);
    if (has) {
      plug.add(box(2.45, PLUG_HEIGHT, 2.45, plugDark));
      plug.add(box(2.6, 1.6, 2.6, std(color, 0.42), 0, 6.9, 0));
      plug.add(box(0.6, 1.2, 0.6, plugPin, 0, -1, 0));
    }
    g.add(plug);
    ends.push(plug);
  }
  g.userData.wire = { tube, count: geo.index.count, ends, curve };
  g.userData.part = { name: 'Jumper wire', desc: 'Carries a signal or power between two points.' };
  const mid = curve.getPoint(0.5);
  anchor(g, mid.x, mid.y, mid.z);
  return g;
}
