import * as THREE from 'three';
import { FX_LAYER } from '../board/materials.js';

// Current-flow beads: a second, slightly fatter tube over each live wire whose
// shader draws light beads with a dark rim every few millimetres and slides
// them along by `offset`. Direction and speed come from the pin level.

const BEAD_PITCH = 7;
const BEAD_RADIUS = 1;

function beadMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      offset: { value: 0 },
      length: { value: 100 },
      opacity: { value: 0 },
      core: { value: new THREE.Color('#fff6d6') },
      rim: { value: new THREE.Color('#18213d') },
    },
    vertexShader: /* glsl */ `
      varying float vU;
      void main() {
        vU = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float offset;
      uniform float length;
      uniform float opacity;
      uniform vec3 core;
      uniform vec3 rim;
      varying float vU;
      void main() {
        float mm = vU * length;
        if (mm < 2.0 || mm > length - 2.0) discard;
        float d = abs(fract(mm / ${BEAD_PITCH.toFixed(1)} - offset) - 0.5) * ${BEAD_PITCH.toFixed(1)};
        if (d > ${BEAD_RADIUS.toFixed(2)}) discard;
        vec3 col = mix(core, rim, smoothstep(${(BEAD_RADIUS * 0.55).toFixed(2)}, ${(BEAD_RADIUS * 0.8).toFixed(2)}, d));
        gl_FragColor = vec4(col, opacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Turn pin levels into one signal per wire: how much current, which way.
// `wires` are {id, spec, group}; spec.signal = {a, b} pin names at each end.
export function wireSignals(wires, levels, powerPins) {
  const out = [];
  let maxFlow = 0;
  let anyPower = false;
  for (const w of wires) {
    const sig = w.spec.signal ?? {};
    const pin = sig.a ?? sig.b ?? null;
    const dir = sig.a ? 1 : -1; // from the board end toward the other end
    let s;
    if (pin && /^GND/.test(pin)) {
      s = { kind: 'gnd', flow: 0, dir: -dir, level: false };
    } else if (pin && powerPins.has(pin)) {
      s = { kind: 'power', flow: 1, dir, level: true };
      anyPower = true;
    } else if (pin && levels[pin]) {
      const flow = levels[pin].v ?? 0;
      s = { kind: 'signal', flow, dir, level: flow > 0.02 };
      maxFlow = Math.max(maxFlow, flow);
    } else {
      s = { kind: 'low', flow: 0, dir, level: false };
    }
    out.push({ id: w.id, pin, ...s });
  }
  for (const s of out) {
    if (s.kind !== 'gnd') continue;
    s.flow = Math.max(maxFlow, anyPower ? 0.3 : 0);
    s.level = s.flow > 0.02;
  }
  return out;
}

export class Flow {
  constructor(scene) {
    this.scene = scene;
    this.beads = new Map();
  }

  update(signals, wires, dt) {
    const seen = new Set();
    let visible = false;
    for (const sig of signals) {
      const wire = wires.find((w) => w.id === sig.id);
      if (!wire) continue;
      seen.add(sig.id);
      let bead = this.beads.get(sig.id);
      if (!bead || bead.group !== wire.group) {
        if (bead) this.drop(sig.id);
        bead = this.make(wire.group);
        if (!bead) continue;
        this.beads.set(sig.id, bead);
      }
      const u = bead.mesh.material.uniforms;
      const { tube, count } = wire.group.userData.wire;
      const fullyDrawn = tube.geometry.drawRange.count >= count;
      const target = fullyDrawn && sig.flow > 0.02 ? 1 : 0;
      u.opacity.value += (target - u.opacity.value) * Math.min(1, dt / 160);
      const speed = 6 + 34 * sig.flow; // mm per second
      u.offset.value = (u.offset.value + (sig.dir * speed * dt) / 1000 / BEAD_PITCH) % 1;
      bead.mesh.visible = u.opacity.value > 0.01;
      if (bead.mesh.visible) visible = true;
    }
    for (const id of [...this.beads.keys()]) if (!seen.has(id)) this.drop(id);
    return visible;
  }

  make(group) {
    const wire = group.userData.wire;
    if (!wire) return null;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(wire.curve, 96, 0.98, 10, false), beadMaterial());
    mesh.material.uniforms.length.value = wire.curve.getLength();
    mesh.layers.set(FX_LAYER);
    mesh.renderOrder = 2;
    mesh.visible = false;
    wire.tube.add(mesh);
    return { group, mesh };
  }

  drop(id) {
    const bead = this.beads.get(id);
    if (!bead) return;
    bead.mesh.removeFromParent();
    bead.mesh.geometry.dispose();
    bead.mesh.material.dispose();
    this.beads.delete(id);
  }

  clear() {
    for (const id of [...this.beads.keys()]) this.drop(id);
  }
}
