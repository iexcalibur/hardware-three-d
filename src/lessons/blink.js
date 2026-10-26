import { breadboardSpec, hole, wire, COLORS } from './helpers.js';
import { resistor, led, ledBrightness } from '../parts/components.js';

const TRACE_DELAY = 170;

export const blink = {
  id: 'blink',
  title: 'Blink an LED',
  lede: 'Your first circuit: an LED and a resistor on the breadboard, driven by pin 13. Switching the pin on and off with a pause in between makes it blink.',
  view: { target: [30, 0, -24], zoom: 6, frame: [0, -4, 150, 78] },

  params: [
    { key: 'on', label: 'On for', type: 'range', min: 50, max: 2000, step: 50, value: 500, unit: 'ms' },
    { key: 'off', label: 'Off for', type: 'range', min: 50, max: 2000, step: 50, value: 500, unit: 'ms' },
    { key: 'ohms', label: 'Resistor', type: 'choice', value: 220, options: [[220, '220 Ω'], [1000, '1 kΩ'], [10000, '10 kΩ']] },
    { key: 'color', label: 'LED colour', type: 'choice', value: 'red', options: [['red', 'Red'], ['yellow', 'Yellow'], ['green', 'Green'], ['blue', 'Blue']] },
  ],

  sketch: (v) => [
    'const int LED_PIN = 13;',
    '',
    'void setup() {',
    '  pinMode(LED_PIN, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(LED_PIN, HIGH);',
    `  delay(${v.on});`,
    '  digitalWrite(LED_PIN, LOW);',
    `  delay(${v.off});`,
    '}',
  ],

  pinout: [
    ['D13', 'Resistor → LED (+)', 'The sketch switches this pin HIGH and LOW.', COLORS.orange],
    ['GND', 'LED (−)', 'The short leg returns current to the board.', COLORS.navy],
  ],

  parts: (v) => [
    breadboardSpec,
    { id: 'resistor', key: `resistor|${v.ohms}`, build: () => resistor(v.ohms), at: hole(12, 'b') },
    { id: 'led', key: `led|${v.color}`, build: () => led(v.color), at: hole(14.5, 'c') },
    wire('w-d13', 'D13', hole(10, 'a'), COLORS.orange, { arch: 12 }),
    wire('w-gnd', 'GND', hole(15, 'a'), COLORS.navy, { arch: 16 }),
  ],

  sim(ctx) {
    const p = ctx.params;
    let acc = 0;
    let on = null;
    let traceAt = 0;
    ctx.trace(3);
    return {
      update(now, dt) {
        acc = (acc + dt) % (p.on + p.off);
        const isOn = acc < p.on;
        ctx.pin('D13', isOn ? 1 : 0, 'out');
        ctx.light('led', isOn ? ledBrightness(p.ohms, p.color) : 0);
        if (isOn !== on) {
          on = isOn;
          ctx.boardLed('L', isOn);
          ctx.out(`D13 → ${isOn ? 'HIGH' : 'LOW'}`);
          ctx.trace(isOn ? 7 : 9);
          traceAt = now + Math.min(TRACE_DELAY, (isOn ? p.on : p.off) * 0.4);
        }
        if (traceAt && now >= traceAt) {
          ctx.trace(on ? 8 : 10);
          traceAt = 0;
        }
        return true;
      },
      stop() {
        ctx.light('led', 0);
        ctx.boardLed('L', false);
      },
    };
  },
};
