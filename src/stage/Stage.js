import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Outline } from './Outline.js';
import { Controls } from './Controls.js';
import { Tweens, ease } from './Tweens.js';
import { gridMaterial } from './grid.js';
import { buildUno } from '../board/uno.js';
import { FX_LAYER, disposeGroup } from '../board/materials.js';
import { setLight } from '../parts/components.js';
import { Flow, wireSignals } from '../sim/flow.js';

export const FLOOR_Y = -4;
const DEG = Math.PI / 180;
const HOME = { azimuth: 36 * DEG, elevation: 43 * DEG };
const POWER_PINS = new Set(['5V', '3V3', 'VIN']);
const HOT = new THREE.Color('#ffb340');

function setBoardLed(mat, on) {
  if (!mat) return;
  mat.userData.baseEmissive ??= mat.emissive.clone();
  mat.emissive.copy(on ? HOT : mat.userData.baseEmissive);
  mat.emissiveIntensity = on ? 1.6 : 0.35;
}

// TX/RX flicker while a sketch "uploads".
function flicker(leds, duration) {
  const t0 = performance.now();
  return {
    finished: false,
    update(now) {
      if (this.finished) return false;
      const t = now - t0;
      const over = t > duration;
      setBoardLed(leds.TX, !over && Math.sin(t * 0.09) > 0.2);
      setBoardLed(leds.RX, !over && Math.sin(t * 0.13 + 1) > 0.4);
      if (over) this.finished = true;
      return true;
    },
  };
}

export class Stage {
  constructor(canvas, hooks = {}, { board: withBoard = true } = {}) {
    this.canvas = canvas;
    this.hooks = hooks;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);
    this.outline = new Outline(this.renderer, { lineColor: '#141a2c', thickness: 1.3 });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.4;
    pmrem.dispose();

    this.setupLights();
    this.setupGround();

    if (withBoard) {
      const board = buildUno(this.renderer);
      this.board = board.root;
      this.leds = board.leds;
      this.anchors = board.anchors;
      this.scene.add(this.board);
    } else {
      this.board = new THREE.Group();
      this.leds = {};
      this.anchors = {};
    }

    this.tweens = new Tweens();
    this.parts = new Map();
    this.size = { w: 1, h: 1, cx: 0, cy: 0 };
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(0);
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();
    this.hovered = null;
    this.pointer = null;
    this.dirty = true;
    this.shadowDirty = true;
    this.lesson = null;
    this.values = {};
    this.inputs = {};
    this.sim = null;
    this.levels = null;
    this.flicker = null;
    this.flow = new Flow(this.scene);
    this.flowOn = true;
    this.runToken = 0;

    this.controls = new Controls(canvas, {
      tweens: this.tweens,
      getSize: () => this.size,
      onChange: () => this.touch(),
      onClick: (e) => this.click(e),
      onGrab: (e) => this.grab(e),
    });
    this.controls.view.azimuth = HOME.azimuth;
    this.controls.view.elevation = HOME.elevation;
    this.setupSelectionRing();

    canvas.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY, done: false };
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer = null;
      this.setHovered(null);
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight('#fffaf3', '#c2ae90', 0.5));
    const key = new THREE.DirectionalLight('#fff6ea', 1.2);
    key.position.set(-55, 100, 62);
    this.scene.add(key);
    // A nearly invisible light whose only job is to cast the shadow map, so
    // the shadow can fall at a different angle from the highlight.
    const shadow = new THREE.DirectionalLight('#ffffff', 0.001);
    shadow.position.set(70, 104, -34);
    shadow.target.position.set(30, 0, 0);
    shadow.castShadow = true;
    shadow.shadow.mapSize.set(2048, 2048);
    const cam = shadow.shadow.camera;
    cam.left = -120;
    cam.right = 120;
    cam.top = 120;
    cam.bottom = -120;
    cam.near = 20;
    cam.far = 300;
    shadow.shadow.radius = 11;
    shadow.shadow.blurSamples = 20;
    shadow.shadow.bias = -4e-4;
    this.scene.add(shadow);
    this.scene.add(shadow.target);
  }

  setupGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.ShadowMaterial({ color: '#7a5532', opacity: 0.32, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    ground.layers.set(FX_LAYER);
    ground.renderOrder = -1;
    this.scene.add(ground);

    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), gridMaterial());
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = FLOOR_Y - 0.01;
    this.grid.layers.set(FX_LAYER);
    this.grid.renderOrder = -2;
    this.scene.add(this.grid);
  }

  setupSelectionRing() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#1aa3a1', transparent: true, opacity: 0.85, depthWrite: false });
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72), mat);
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.84, 72), mat.clone());
    inner.material.opacity = 0.45;
    for (const r of [outer, inner]) {
      r.rotation.x = -Math.PI / 2;
      r.layers.set(FX_LAYER);
      g.add(r);
    }
    g.visible = false;
    g.renderOrder = -1;
    this.scene.add(g);
    this.ring = g;
    this.selection = null;
  }

  get view() {
    return this.controls.view;
  }

  touch() {
    this.dirty = true;
  }

  // ---- sizing and camera ----------------------------------------------------

  resize(w, h, cx, cy, pixelRatio, avail = { w, h }) {
    const same = this.size.w === w && this.size.h === h && this.renderer.getPixelRatio() === pixelRatio;
    this.size = { w, h, cx, cy };
    this.avail = avail;
    if (!same) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(w, h, false);
      this.outline.setSize(w, h, pixelRatio);
    }
    this.dirty = true;
  }

  placeCamera() {
    const { target, azimuth, elevation, zoom } = this.view;
    const { w, h, cx, cy } = this.size;
    const c = this.camera;
    c.left = -cx / zoom;
    c.right = (w - cx) / zoom;
    c.top = cy / zoom;
    c.bottom = -(h - cy) / zoom;
    c.updateProjectionMatrix();
    c.position.set(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * 320,
      target.y + Math.sin(elevation) * 320,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * 320,
    );
    c.lookAt(target);
    c.updateMatrixWorld();
    const u = this.grid.material.uniforms;
    u.center.value.set(target.x, target.z);
    const k = 8.4 / zoom;
    u.inner.value = 38 * k;
    u.outer.value = 84 * k;
  }

  // The lesson's home view, zoomed so its frame (a rectangle in mm on the
  // screen plane: x/y offset from the target, width, height) fills the space
  // left over by the UI.
  homeView() {
    const v = this.lesson?.view ?? { target: [0, 0, 0], zoom: 8.4 };
    const home = { target: v.target, zoom: v.zoom, azimuth: HOME.azimuth, elevation: HOME.elevation };
    if (!v.frame || !this.avail) return home;
    const [fx, fy, fw, fh] = v.frame;
    const zoom = Math.min(22, Math.max(2.2, Math.min(this.avail.w / fw, this.avail.h / fh)));
    const right = new THREE.Vector3(Math.cos(HOME.azimuth), 0, -Math.sin(HOME.azimuth));
    const away = new THREE.Vector3(-Math.sin(HOME.azimuth), 0, -Math.cos(HOME.azimuth));
    const target = new THREE.Vector3(...v.target)
      .addScaledVector(right, fx)
      .addScaledVector(away, -fy / Math.sin(HOME.elevation));
    return { ...home, target: target.toArray(), zoom };
  }

  resetView(duration = 1100) {
    return this.controls.animateTo(this.homeView(), { duration });
  }

  turn(dir) {
    return this.controls.turn(dir);
  }

  project(obj) {
    obj.getWorldPosition(this.tmp);
    return this.projectPoint(this.tmp);
  }

  projectPoint(p) {
    const v = this.tmp.copy(p).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.size.w, (-v.y * 0.5 + 0.5) * this.size.h];
  }

  // ---- lessons and parts ----------------------------------------------------

  setLesson(lesson, values = {}, { instant = false } = {}) {
    this.stop();
    this.select(null);
    this.setHovered(null);
    this.lesson = lesson;
    this.values = values;
    this.inputs = {};
    const specs = lesson.parts(values);
    const wanted = new Map(specs.map((s) => [s.id, s]));
    const speed = instant ? 0 : 1;

    for (const [id, part] of [...this.parts]) {
      const next = wanted.get(id);
      if (!next || (next.key ?? next.id) !== (part.spec.key ?? part.spec.id)) {
        this.parts.delete(id);
        this.exitPart(part, speed);
      }
    }
    let solids = 0;
    let wires = 0;
    let last = 0;
    for (const spec of specs) {
      const existing = this.parts.get(spec.id);
      if (existing) {
        this.movePart(existing, spec, speed);
        continue;
      }
      const part = this.buildPart(spec);
      const delay = spec.wire ? 650 + wires++ * 140 : 220 + solids++ * 130;
      last = Math.max(last, delay + (spec.wire ? 700 : 750));
      this.enterPart(part, delay * speed, speed);
    }
    this.shadowDirty = true;
    this.dirty = true;
    if (instant) {
      this.controls.jumpTo(this.homeView());
      this.tweens.update(performance.now() + 1e6);
      return Promise.resolve();
    }
    this.controls.animateTo(this.homeView(), { duration: 1300 });
    return this.tweens.wait(Math.max(last, 1300));
  }

  buildPart(spec) {
    const group = spec.build(this.values);
    if (spec.at) group.position.copy(spec.at);
    if (spec.rot) group.rotation.set(...spec.rot);
    group.userData.baseY = group.position.y;
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    spec.apply?.(group, this.values);
    const part = { group, spec };
    this.parts.set(spec.id, part);
    this.scene.add(group);
    return part;
  }

  updateParams(values) {
    this.values = values;
    for (const spec of this.lesson.parts(values)) {
      const part = this.parts.get(spec.id);
      if (!part) continue;
      if ((spec.key ?? spec.id) !== (part.spec.key ?? part.spec.id)) {
        this.exitPart(part, 0.55);
        const fresh = this.buildPart(spec);
        this.enterPart(fresh, 120, 0.7, { drop: 14 });
        if (this.selection?.id === spec.id) this.selection.group = fresh.group;
        continue;
      }
      part.spec = spec;
      spec.apply?.(part.group, values);
    }
    this.shadowDirty = true;
    this.dirty = true;
  }

  applyY(group) {
    const u = group.userData;
    group.position.y = (u.baseY ?? 0) + (u.dropY ?? 0) + (u.hoverY ?? 0);
  }

  enterPart({ group, spec }, delay, speed, { drop } = {}) {
    const wire = group.userData.wire;
    if (wire) {
      const { tube, count, ends } = wire;
      tube.geometry.setDrawRange(0, 0);
      ends.forEach((e) => e.scale.setScalar(0.001));
      this.tweens.add({
        delay,
        duration: 260 * speed + 1,
        easing: ease.outBack,
        onUpdate: (k) => ends[0].scale.setScalar(Math.max(0.001, k)),
      });
      this.tweens.add({
        delay: delay + 120 * speed,
        duration: 620 * speed + 1,
        onUpdate: (k) => {
          tube.geometry.setDrawRange(0, Math.ceil((k * count) / 48) * 48);
          this.shadowDirty = true;
        },
      });
      this.tweens.add({
        delay: delay + 700 * speed,
        duration: 260 * speed + 1,
        easing: ease.outBack,
        onUpdate: (k) => ends[1].scale.setScalar(Math.max(0.001, k)),
      });
      return;
    }
    const height = drop ?? (spec.id === 'breadboard' ? 24 : 46);
    group.userData.dropY = height;
    group.scale.setScalar(0.001);
    this.applyY(group);
    this.tweens.add({
      delay,
      duration: 720 * speed + 1,
      easing: ease.linear,
      onUpdate: (k) => {
        group.userData.dropY = height * (1 - ease.outCubic(k));
        group.scale.setScalar(Math.max(0.001, ease.outBack(Math.min(1, k * 1.15))));
        this.applyY(group);
        this.shadowDirty = true;
      },
    });
  }

  exitPart({ group }, speed) {
    if (this.hovered === group) this.setHovered(null);
    if (this.selection?.group === group) this.select(null);
    const done = () => {
      this.scene.remove(group);
      disposeGroup(group);
      this.shadowDirty = true;
      this.dirty = true;
    };
    const wire = group.userData.wire;
    if (wire) {
      const { tube, count, ends } = wire;
      this.tweens.add({
        duration: 380 * speed + 1,
        easing: ease.inCubic,
        onUpdate: (k) => {
          tube.geometry.setDrawRange(0, Math.floor(((1 - k) * count) / 48) * 48);
          ends.forEach((e) => e.scale.setScalar(Math.max(0.001, 1 - k)));
          this.shadowDirty = true;
        },
        onComplete: done,
      });
      return;
    }
    const scale = group.scale.x;
    this.tweens.add({
      delay: 60 * speed,
      duration: 420 * speed + 1,
      easing: ease.linear,
      onUpdate: (k) => {
        group.scale.setScalar(Math.max(0.001, scale * (1 - ease.inBack(k))));
        group.userData.dropY = 30 * k * k;
        this.applyY(group);
        this.shadowDirty = true;
      },
      onComplete: done,
    });
  }

  movePart(part, spec, speed) {
    part.spec = spec;
    const group = part.group;
    const from = group.position.clone();
    from.y = group.userData.baseY;
    const to = spec.at ? spec.at.clone() : from.clone();
    if (from.distanceTo(to) < 0.01) return;
    this.tweens.add({
      delay: 120 * speed,
      duration: 800 * speed + 1,
      onUpdate: (k, raw) => {
        group.position.lerpVectors(from, to, k);
        group.userData.baseY = group.position.y;
        group.userData.dropY = Math.sin(raw * Math.PI) * 16;
        this.applyY(group);
        this.shadowDirty = true;
      },
    });
  }

  // ---- picking, hover, selection ---------------------------------------------

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = [this.board, ...[...this.parts.values()].map((p) => p.group)];
    for (const hit of this.raycaster.intersectObjects(targets, true)) {
      let o = hit.object;
      let partNode = null;
      let id = null;
      while (o) {
        if (o.userData.part) partNode ??= o;
        const entry = [...this.parts].find(([, p]) => p.group === o);
        if (entry) {
          id = entry[0];
          if (o.userData.part) partNode = o;
          break;
        }
        o = o.parent;
      }
      if (partNode) return { group: partNode, info: partNode.userData.part, point: hit.point, id, object: hit.object };
    }
    return null;
  }

  setHovered(group) {
    if (this.hovered === group) return;
    const prev = this.hovered;
    this.hovered = group;
    const lift = (g, to) => {
      if (!g || g.userData.part?.lift === false || g.userData.wire) return;
      g.userData.baseY ??= g.position.y;
      const from = g.userData.hoverY ?? 0;
      g.userData.hoverAnim?.cancel();
      g.userData.hoverAnim = this.tweens.add({
        duration: 220,
        easing: ease.outCubic,
        onUpdate: (k) => {
          g.userData.hoverY = from + (to - from) * k;
          this.applyY(g);
          this.shadowDirty = true;
        },
      });
    };
    lift(prev, 0);
    lift(group, group?.userData.part?.big ? 2.5 : 1.6);
    this.canvas.classList.toggle('is-pointing', !!group);
    this.hooks.onHover?.(group ? group.userData.part : null, this.pointer);
    this.dirty = true;
  }

  updateHover() {
    if (!this.pointer || this.controls.drag || this.controls.grab) return;
    if (this.pointer.done) return;
    this.pointer.done = true;
    const hit = this.pick(this.pointer.x, this.pointer.y);
    this.setHovered(hit?.group ?? null);
    if (hit) this.hooks.onHover?.(hit.info, this.pointer);
  }

  click(e) {
    const hit = this.pick(e.clientX, e.clientY);
    if (hit && hit.info.lift !== false) this.select(hit.id ?? hit.group);
    else this.select(null);
    this.hooks.onPick?.(hit);
  }

  select(target) {
    if (!target) {
      if (this.selection) {
        this.selection = null;
        this.ring.visible = false;
        this.dirty = true;
        this.hooks.onSelect?.(null);
      }
      return;
    }
    const byId = typeof target === 'string';
    const id = byId ? target : ([...this.parts].find(([, p]) => p.group === target)?.[0] ?? null);
    const group = byId ? this.parts.get(id)?.group : target;
    if (!group) return;
    this.selection = { id, group };
    this.ring.visible = true;
    this.placeRing();
    this.dirty = true;
    this.hooks.onSelect?.({ id, info: group.userData.part, group });
  }

  placeRing() {
    const sel = this.selection;
    if (!sel) return;
    const group = sel.group;
    const scale = group.scale.clone();
    group.scale.set(1, 1, 1);
    group.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3();
    group.traverse((o) => {
      if (o.isMesh && o.layers.isEnabled(0)) bbox.expandByObject(o);
    });
    group.scale.copy(scale);
    if (bbox.isEmpty()) return;
    const centre = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const radius = Math.max(8, Math.hypot(size.x, size.z) / 2 + 3);
    this.ring.position.set(centre.x, Math.max(FLOOR_Y, bbox.min.y) + 0.25, centre.z);
    this.ring.scale.setScalar(radius);
  }

  grab(e) {
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit?.id) return null;
    const part = this.parts.get(hit.id);
    const interact = part?.spec.interact;
    if (!interact) return null;
    this.select(hit.id);
    this.setHovered(null);
    if (interact.type === 'press') {
      const set = (down) => {
        this.inputs[interact.input] = down;
        this.hooks.onInput?.(interact.input, down);
        this.dirty = true;
      };
      set(true);
      return { up: () => set(false) };
    }
    return null;
  }

  // ---- simulation -----------------------------------------------------------

  async run() {
    if (!this.lesson?.sim) return false;
    this.stop();
    const token = ++this.runToken;
    const out = (t) => this.hooks.onOut?.(t);
    this.flicker = flicker(this.leds, 1150 * this.tweens.speed);
    out('Compiling sketch…');
    await this.tweens.wait(600);
    if (token !== this.runToken) return false;
    out('Uploading to Arduino Uno…');
    await this.tweens.wait(600);
    if (token !== this.runToken) return false;
    out('Done uploading.');

    this.levels = {};
    const ctx = {
      params: new Proxy({}, { get: (_, k) => this.values[k] }),
      inputs: this.inputs,
      pin: (name, v, mode = 'out', text) => {
        this.levels[name] = { v, mode, text };
      },
      light: (id, level) => setLight(this.parts.get(id)?.group.userData.light, level),
      boardLed: (name, on) => setBoardLed(this.leds[name], on),
      part: (id) => this.parts.get(id)?.group,
      out,
      trace: (line) => this.hooks.onTrace?.(line),
    };
    this.sim = this.lesson.sim(ctx);
    this.dirty = true;
    return true;
  }

  stop() {
    this.runToken++;
    if (this.sim) {
      this.sim.stop?.();
      this.sim = null;
    }
    this.flicker = null;
    this.levels = null;
    this.flow.clear();
    for (const mat of Object.values(this.leds)) if (mat.userData.baseEmissive) setBoardLed(mat, false);
    this.hooks.onPins?.(null);
    this.hooks.onTrace?.(null);
    this.dirty = true;
  }

  setFlow(on) {
    this.flowOn = on;
    if (!on) this.flow.clear();
    this.dirty = true;
  }

  setGrid(on) {
    this.grid.visible = on;
    this.dirty = true;
  }

  wireParts() {
    const out = [];
    for (const [id, p] of this.parts) if (p.group.userData.wire) out.push({ id, spec: p.spec, group: p.group });
    return out;
  }

  // ---- frame loop -------------------------------------------------------------

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(64, now - (this.lastFrame ?? now));
    this.lastFrame = now;
    let dirty = this.dirty;
    if (this.tweens.active) {
      this.tweens.update(now);
      dirty = true;
    }
    if (this.controls.update(dt)) dirty = true;
    if (this.flicker?.update(now)) dirty = true;
    if (this.sim) {
      if (this.sim.update(now, dt)) dirty = true;
      if (this.levels) {
        const wires = this.wireParts();
        const signals = wireSignals(wires, this.levels, POWER_PINS);
        if (this.flowOn && this.flow.update(signals, wires, dt)) dirty = true;
        this.hooks.onPins?.(this.levels);
      }
    }
    this.updateHover();
    if (dirty) this.render();
  }

  render() {
    this.dirty = false;
    if (this.shadowDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    this.placeCamera();
    if (this.selection) this.placeRing();
    this.outline.setLineScale(Math.min(1, Math.max(0.6, Math.sqrt(this.view.zoom / 6))));
    this.outline.render(this.scene, this.camera);
    this.hooks.onFrame?.(this);
  }
}
