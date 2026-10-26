import * as THREE from 'three';
import { pinPosition } from '../board/unoData.js';
import { holeLocal, breadboard } from '../parts/breadboard.js';
import { jumperWire } from '../parts/wire.js';
import { FLOOR_Y } from '../stage/Stage.js';

// Where the breadboard sits on the floor, to the right and in front of the board.
export const BREADBOARD_AT = new THREE.Vector3(64, FLOOR_Y, -50);

export const COLORS = {
  red: '#d64a3a',
  navy: '#2f3547',
  orange: '#f0a53a',
  yellow: '#f0b53a',
  green: '#3fae6a',
  blue: '#3d6fc4',
  coral: '#ee7f62',
  purple: '#8a63c9',
  brown: '#7a5034',
};

// World position of a breadboard hole. Fractional columns sit between holes.
export const hole = (col, row) => holeLocal(col, row).add(BREADBOARD_AT);

// World position of a header pin on the Uno.
export const pin = (name) => new THREE.Vector3(...pinPosition(name));

export const breadboardSpec = { id: 'breadboard', build: () => breadboard(), at: BREADBOARD_AT };

// A wire spec. Endpoints are pin names or world positions.
export function wire(id, a, b, color, options = {}) {
  const pa = typeof a === 'string' ? pin(a) : a;
  const pb = typeof b === 'string' ? pin(b) : b;
  return {
    id,
    key: [id, ...pa.toArray(), ...pb.toArray(), color].join('|'),
    wire: true,
    signal: { a: typeof a === 'string' ? a : null, b: typeof b === 'string' ? b : null },
    build: () => jumperWire(pa, pb, color, options),
  };
}
