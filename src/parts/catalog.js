import * as THREE from 'three';
import { breadboard } from './breadboard.js';
import { led, resistor } from './components.js';
import { jumperWire } from './wire.js';
import { pushButton } from './button.js';
import { buildUno } from '../board/uno.js';
import { raspberryPi4 } from './raspberryPi.js';

// Every part the preview page (parts.html) can show. `size` is the rough
// extent in mm, used to frame the camera. `build` gets { renderer }.
// Add a line here when you add a part.

export const catalog = {
  uno: { name: 'Arduino Uno', size: 80, build: ({ renderer }) => buildUno(renderer).root },
  rpi4: { name: 'Raspberry Pi 4 B', size: 95, build: ({ renderer }) => raspberryPi4({ renderer }) },
  breadboard: { name: 'Breadboard', size: 70, build: () => breadboard() },
  led: {
    name: '5 mm LED',
    size: 28,
    options: { color: ['red', 'yellow', 'green', 'blue', 'white'] },
    build: (_, o) => led(o.color ?? 'red'),
  },
  resistor: {
    name: 'Resistor',
    size: 20,
    options: { ohms: [220, 1000, 4700, 10000] },
    build: (_, o) => resistor(Number(o.ohms ?? 220)),
  },
  button: {
    name: 'Push button',
    size: 24,
    options: { color: ['#e8392e', '#f2c23a', '#3fbf6a', '#3d7be0'] },
    build: (_, o) => pushButton({ color: o.color ?? '#e8392e' }),
  },
  wire: {
    name: 'Jumper wire',
    size: 50,
    build: () => jumperWire(new THREE.Vector3(-15, 0, 0), new THREE.Vector3(15, 0, 0), '#f0a53a', { arch: 12 }),
  },
};
