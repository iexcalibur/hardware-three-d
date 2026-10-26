// Arduino Uno R3 layout in millimetres. x runs left to right, y from the
// bottom edge up (the way a PCB drawing is usually dimensioned).

export const W = 68.58;
export const H = 53.34;
export const PCB_THICKNESS = 1.6;
export const PITCH = 2.54;
export const HEADER_HEIGHT = 8.5;

export const outline = [
  [0, 0],
  [66.04, 0],
  [68.58, 2.54],
  [68.58, 37.85],
  [66.04, 40.39],
  [66.04, 51.82],
  [64.52, 53.34],
  [0, 53.34],
];

export const mountingHoles = [
  [13.97, 2.54],
  [15.24, 50.8],
  [66.04, 7.62],
  [66.04, 35.56],
];

// Female header strips: n pins centred on x, along y.
export const headers = [
  { id: 'digitalA', n: 10, x: 30.23, y: 50.8 },
  { id: 'digitalB', n: 8, x: 54.61, y: 50.8 },
  { id: 'power', n: 8, x: 36.83, y: 2.54 },
  { id: 'analog', n: 6, x: 57.15, y: 2.54 },
];

// x position of every header pin, by the name used in sketches.
export const digitalPins = {
  SCL: 18.8, SDA: 21.34, AREF: 23.88, GND: 26.42,
  D13: 28.96, D12: 31.5, D11: 34.04, D10: 36.58, D9: 39.12, D8: 41.66,
  D7: 45.72, D6: 48.26, D5: 50.8, D4: 53.34, D3: 55.88, D2: 58.42, D1: 60.96, D0: 63.5,
};
export const powerPins = { IOREF: 30.48, RESET: 33.02, '3V3': 35.56, '5V': 38.1, GND1: 40.64, GND2: 43.18, VIN: 45.72 };

export const digitalLabels = ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8', '7', '~6', '~5', '4', '~3', '2', 'TX 1', 'RX 0'];
export const powerLabels = ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'];

// Everything soldered to the board: type, centre, rotation.
export const parts = [
  { type: 'usb', x: 1.8, y: 38.1 },
  { type: 'jack', x: 5.3, y: 7.85 },
  { type: 'reset', x: 6.9, y: 49 },
  { type: 'dip', x: 47, y: 19 },
  { type: 'maleHeader', cols: 2, rows: 3, x: 64.9, y: 29.6, id: 'icsp' },
  { type: 'maleHeader', cols: 3, rows: 2, x: 20.2, y: 45.4, id: 'icsp2' },
  { type: 'ecap', x: 17.7, y: 9.4 },
  { type: 'ecap', x: 24.6, y: 8.2 },
  { type: 'crystal', x: 17.4, y: 30.4 },
  { type: 'qfn', x: 22.6, y: 37.4, rot: 45 },
  { type: 'polyfuse', x: 13.4, y: 41, rot: 90 },
  { type: 'sot223', x: 5.6, y: 18.8, rot: 180 },
  { type: 'soic8', x: 29.6, y: 43.6, rot: 90 },
  { type: 'sma', x: 9.6, y: 24.6 },
  { type: 'sot23', x: 21.4, y: 15 },
  { type: 'sot23', x: 12.6, y: 25.6, rot: 90 },
  { type: 'sot23', x: 35.2, y: 39.2 },
  { type: 'resonator', x: 41.2, y: 26.4 },
  { type: 'ferrite', x: 9.6, y: 29.4, rot: 90 },
  { type: 'led', x: 27.3, y: 40.2, color: 'amber', name: 'L' },
  { type: 'led', x: 27.3, y: 36.9, color: 'amber', name: 'TX' },
  { type: 'led', x: 27.3, y: 35, color: 'amber', name: 'RX' },
  { type: 'led', x: 58.6, y: 28, color: 'green', name: 'ON' },
  { type: 'c0603', x: 19.3, y: 39.6, rot: 45 },
  { type: 'c0603', x: 19.6, y: 35, rot: -45 },
  { type: 'r0603', x: 25.6, y: 39.4, rot: -45 },
  { type: 'r0603', x: 24.9, y: 34.4, rot: 45 },
  { type: 'c0603', x: 22.6, y: 32.8 },
  { type: 'r0603', x: 12.6, y: 35.4 },
  { type: 'r0603', x: 12.6, y: 33.6 },
  { type: 'c0603', x: 16, y: 37.6, rot: 90 },
  { type: 'c0603', x: 11.4, y: 50.6 },
  { type: 'r0603', x: 11.4, y: 48.6 },
  { type: 'r0603', x: 29.4, y: 40.2 },
  { type: 'r0603', x: 29.4, y: 36.9 },
  { type: 'r0603', x: 29.4, y: 35 },
  { type: 'c0603', x: 33.2, y: 44.6, rot: 90 },
  { type: 'r0603', x: 34.9, y: 44.6, rot: 90 },
  { type: 'rarray', x: 38.6, y: 44.2, rot: 90 },
  { type: 'r0603', x: 39.4, y: 36.6 },
  { type: 'c0603', x: 38.2, y: 26.4, rot: 90 },
  { type: 'c0603', x: 44.4, y: 26.4, rot: 90 },
  { type: 'r0603', x: 46.2, y: 26.4, rot: 90 },
  { type: 'c0603', x: 33.6, y: 26.8 },
  { type: 'c0603', x: 52, y: 26.5 },
  { type: 'r0603', x: 60.6, y: 28, rot: 90 },
  { type: 'c0603', x: 61, y: 33.6 },
  { type: 'c0603', x: 10.2, y: 17.6, rot: 90 },
  { type: 'c0603', x: 2.6, y: 23.6, rot: 90 },
  { type: 'r0603', x: 13.2, y: 16.6 },
  { type: 'r0603', x: 13.2, y: 14.9 },
  { type: 'c0603', x: 25.6, y: 17, rot: 90 },
  { type: 'r0603', x: 18.6, y: 18.8 },
  { type: 'c0603', x: 16.8, y: 23.8 },
  { type: 'r0603', x: 26.4, y: 27.6, rot: 90 },
];

// Footprint sizes (w along x, d along y, h height) used for the painted
// drop shadow and the silkscreen outline.
export const footprints = {
  usb: { w: 9.2, d: 11.6, h: 10.4, dx: 2.8 },
  jack: { w: 12.4, d: 9, h: 11, dx: 0.9 },
  reset: { w: 6, d: 6, h: 3.6 },
  dip: { w: 36.6, d: 10.2, h: 6 },
  ecap: { w: 6.6, d: 6.6, h: 6.9 },
  crystal: { w: 11.2, d: 4.9, h: 3.6 },
  qfn: { w: 5, d: 5, h: 0.9, silk: true },
  polyfuse: { w: 4.5, d: 3.2, h: 1.1, silk: true },
  sot223: { w: 6.6, d: 7, h: 1.7, silk: true },
  soic8: { w: 4.9, d: 6, h: 1.5, silk: true },
  sma: { w: 4.4, d: 2.7, h: 2.1, silk: true },
  sot23: { w: 2.9, d: 2.5, h: 1.1, silk: true },
  resonator: { w: 3.4, d: 1.4, h: 1.2, silk: true },
  ferrite: { w: 3.2, d: 1.6, h: 1.1 },
  led: { w: 2, d: 1.25, h: 0.8 },
  r0603: { w: 1.6, d: 0.8, h: 0.45 },
  c0603: { w: 1.6, d: 0.8, h: 0.8 },
  rarray: { w: 3.2, d: 1.6, h: 0.5 },
};

// Copper pads per part type, relative to the part centre before rotation.
export function padsFor(part) {
  const out = [];
  const rot = ((part.rot ?? 0) * Math.PI) / 180;
  const pad = (dx, dy, w, d) =>
    out.push({
      x: part.x + dx * Math.cos(rot) - dy * Math.sin(rot),
      y: part.y + dx * Math.sin(rot) + dy * Math.cos(rot),
      w,
      d,
      rot: part.rot ?? 0,
    });
  switch (part.type) {
    case 'r0603':
    case 'c0603':
      pad(-0.8, 0, 0.75, 0.95);
      pad(0.8, 0, 0.75, 0.95);
      break;
    case 'led':
      pad(-1, 0, 0.8, 1.35);
      pad(1, 0, 0.8, 1.35);
      break;
    case 'ferrite':
      pad(-1.55, 0, 0.9, 1.8);
      pad(1.55, 0, 0.9, 1.8);
      break;
    case 'sma':
      pad(-2.3, 0, 1.4, 1.8);
      pad(2.3, 0, 1.4, 1.8);
      break;
    case 'sot23':
      pad(-0.95, -1.15, 0.6, 0.8);
      pad(0.95, -1.15, 0.6, 0.8);
      pad(0, 1.15, 0.6, 0.8);
      break;
    case 'soic8':
      for (let i = 0; i < 4; i++) {
        pad(-1.905 + i * 1.27, -2.7, 0.55, 1.1);
        pad(-1.905 + i * 1.27, 2.7, 0.55, 1.1);
      }
      break;
    case 'sot223':
      pad(-2.3, -3.1, 1, 1.6);
      pad(0, -3.1, 1, 1.6);
      pad(2.3, -3.1, 1, 1.6);
      pad(0, 3.1, 3.4, 1.6);
      break;
    case 'qfn':
      for (let i = 0; i < 8; i++) {
        const t = -2.1 + i * 0.6;
        pad(t, -2.7, 0.3, 0.6);
        pad(t, 2.7, 0.3, 0.6);
        pad(-2.7, t, 0.6, 0.3);
        pad(2.7, t, 0.6, 0.3);
      }
      break;
    case 'polyfuse':
      pad(-2.3, 0, 1.1, 3.4);
      pad(2.3, 0, 1.1, 3.4);
      break;
    case 'resonator':
      pad(-1.2, 0, 0.6, 1.5);
      pad(0, 0, 0.6, 1.5);
      pad(1.2, 0, 0.6, 1.5);
      break;
    case 'rarray':
      for (let i = 0; i < 4; i++) {
        pad(-1.2 + i * 0.8, -0.95, 0.45, 0.6);
        pad(-1.2 + i * 0.8, 0.95, 0.45, 0.6);
      }
      break;
  }
  return out;
}

export const silkLabels = [
  { t: 'RESET', x: 6.9, y: 45, s: 1.15, w: 700 },
  { t: 'ICSP', x: 61.1, y: 31.4, s: 1.25, rot: 90, w: 700 },
  { t: 'ICSP', x: 20.2, y: 42, s: 1.1, w: 700 },
  { t: 'L', x: 25.5, y: 40.2, s: 1.2, w: 700 },
  { t: 'TX', x: 25.2, y: 36.9, s: 1.1, w: 700 },
  { t: 'RX', x: 25.2, y: 35, s: 1.1, w: 700 },
  { t: 'ON', x: 58.6, y: 29.7, s: 1.2, w: 700 },
  { t: 'AREF', x: 23.9, y: 45.4, s: 0.9 },
  { t: 'C4', x: 21.3, y: 12.6, s: 0.95 },
  { t: 'R2', x: 16, y: 16, s: 0.95 },
  { t: 'C7', x: 33.6, y: 28.2, s: 0.95 },
  { t: 'Y1', x: 17.4, y: 33.4, s: 1 },
  { t: 'U3', x: 22.6, y: 30.9, s: 0.95 },
  { t: 'F1', x: 15.3, y: 41, s: 0.95 },
  { t: 'X1', x: 11.6, y: 6, s: 1 },
  { t: 'D1', x: 9.6, y: 22.2, s: 0.95 },
  { t: '+', x: 20.9, y: 7, s: 1.4 },
  { t: '+', x: 27.8, y: 5.9, s: 1.4 },
];

export const logoAt = { x: 40.6, y: 37.6 };
export const unoAt = { x: 53, y: 34 };

// World position of a header pin (board centred at the origin, top at y = 0).
export function pinPosition(name) {
  let x;
  let y;
  if (name in digitalPins) {
    x = digitalPins[name];
    y = 50.8;
  } else if (name in powerPins) {
    x = powerPins[name];
    y = 2.54;
  } else if (/^A[0-5]$/.test(name)) {
    x = 50.8 + Number(name[1]) * PITCH;
    y = 2.54;
  } else {
    throw new Error(`Unknown pin ${name}`);
  }
  return [x - W / 2, HEADER_HEIGHT, H / 2 - y];
}
