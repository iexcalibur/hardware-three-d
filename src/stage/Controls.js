import * as THREE from 'three';
import { ease } from './Tweens.js';

// Orthographic "turntable" controls. The view is a target point on the floor
// plus azimuth, elevation and zoom (pixels per millimetre). Rotation snaps to
// quarter turns so the scene always reads as a clean isometric-ish drawing.

const DEG = Math.PI / 180;
const QUARTER = 90 * DEG;
const BASE_AZIMUTH = 36 * DEG;
const MIN_ZOOM = 3.2;
const MAX_ZOOM = 22;
const RATCHET_PX = 110;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Controls {
  constructor(el, { tweens, getSize, onChange, onClick, onGrab }) {
    this.el = el;
    this.tweens = tweens;
    this.getSize = getSize;
    this.onChange = onChange;
    this.onClick = onClick;
    this.onGrab = onGrab;

    this.view = { target: new THREE.Vector3(), azimuth: BASE_AZIMUTH, elevation: 43 * DEG, zoom: 8.4 };
    this.zoomGoal = this.view.zoom;
    this.zoomAnchor = null;
    this.bounds = { minX: -90, maxX: 150, minZ: -110, maxZ: 90 };
    this.drag = null;
    this.grab = null;
    this.anim = null;

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keydown(e));
  }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  down(e) {
    if (e.button === 0 && !this.grab) {
      const handler = this.onGrab?.(e);
      if (handler) {
        this.stopAnimation();
        this.el.setPointerCapture(e.pointerId);
        this.grab = { id: e.pointerId, handler };
        return;
      }
    }
    this.stopAnimation();
    this.el.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.drag = { mode: e.button === 0 ? 'pan' : 'rotate', last: p, moved: 0, ratchet: 0 };
  }

  move(e) {
    if (this.grab && e.pointerId === this.grab.id) {
      this.grab.handler.move?.(e);
      this.onChange();
      return;
    }
    if (!this.drag) return;
    const p = this.local(e);
    const dx = p.x - this.drag.last.x;
    const dy = p.y - this.drag.last.y;
    this.drag.last = p;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.mode === 'rotate') {
      this.drag.ratchet += dx;
      if (Math.abs(this.drag.ratchet) > RATCHET_PX) {
        this.turn(this.drag.ratchet > 0 ? -1 : 1);
        this.drag.ratchet = 0;
      }
    } else if (this.drag.moved > 4) {
      this.panBy(dx, dy);
      this.onChange();
    }
  }

  up(e) {
    if (this.grab && e.pointerId === this.grab.id) {
      this.grab.handler.up?.(e);
      this.grab = null;
      this.onChange();
      return;
    }
    if (!this.drag) return;
    if (this.drag.moved < 4 && this.drag.mode === 'pan') this.onClick?.(e);
    this.drag = null;
  }

  wheel(e) {
    e.preventDefault();
    this.stopAnimation();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomGoal = clamp(this.zoomGoal * Math.exp(-delta * 0.0018), MIN_ZOOM, MAX_ZOOM);
    this.zoomAnchor = this.local(e);
    this.onChange();
  }

  keydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement?.matches?.('input, textarea, select')) return;
    if (e.code === 'KeyQ') this.turn(-1);
    else if (e.code === 'KeyE') this.turn(1);
    else if (e.key === '+' || e.key === '=') this.zoomBy(1.3);
    else if (e.key === '-' || e.key === '_') this.zoomBy(1 / 1.3);
    else return;
    e.preventDefault();
  }

  // Screen-right and screen-up directions projected onto the floor.
  axes() {
    const a = this.view.azimuth;
    return {
      right: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
      away: new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)),
    };
  }

  panBy(dx, dy) {
    const { right, away } = this.axes();
    const z = this.view.zoom;
    const s = Math.sin(this.view.elevation);
    this.view.target.addScaledVector(right, -dx / z).addScaledVector(away, dy / (z * s));
    this.clampTarget();
  }

  clampTarget() {
    const t = this.view.target;
    const b = this.bounds;
    t.x = clamp(t.x, b.minX, b.maxX);
    t.z = clamp(t.z, b.minZ, b.maxZ);
  }

  // Floor point under a canvas pixel.
  groundAt(px, py) {
    const { cx, cy } = this.getSize();
    const { right, away } = this.axes();
    const z = this.view.zoom;
    const s = Math.sin(this.view.elevation);
    return this.view.target
      .clone()
      .addScaledVector(right, (px - cx) / z)
      .addScaledVector(away, -(py - cy) / (z * s));
  }

  zoomAt(factor, anchor) {
    const v = this.view;
    const from = v.zoom;
    const to = clamp(from * factor, MIN_ZOOM, MAX_ZOOM);
    if (anchor) {
      const { cx, cy } = this.getSize();
      const { right, away } = this.axes();
      const s = Math.sin(v.elevation);
      const k = 1 / from - 1 / to;
      v.target.addScaledVector(right, (anchor.x - cx) * k).addScaledVector(away, -((anchor.y - cy) * k) / s);
      this.clampTarget();
    }
    v.zoom = to;
  }

  zoomBy(factor) {
    this.stopAnimation();
    const { cx, cy } = this.getSize();
    this.zoomGoal = clamp(this.zoomGoal * factor, MIN_ZOOM, MAX_ZOOM);
    this.zoomAnchor = { x: cx, y: cy };
    this.onChange();
  }

  stopAnimation() {
    if (this.anim) {
      this.anim.cancel();
      this.anim = null;
      this.zoomGoal = this.view.zoom;
    }
  }

  jumpTo(view) {
    this.stopAnimation();
    const v = this.view;
    if (view.target) v.target.set(...view.target);
    if (view.azimuth !== undefined) v.azimuth = view.azimuth;
    if (view.elevation !== undefined) v.elevation = view.elevation;
    if (view.zoom !== undefined) v.zoom = view.zoom;
    this.zoomGoal = v.zoom;
    this.onChange();
  }

  animateTo(view, { duration = 1200, easing = ease.inOutCubic } = {}) {
    this.stopAnimation();
    const v = this.view;
    const from = { target: v.target.clone(), azimuth: v.azimuth, elevation: v.elevation, zoom: v.zoom };
    const target = view.target ? new THREE.Vector3(...view.target) : from.target;
    const dAz = view.azimuth === undefined ? 0 : wrap(view.azimuth - from.azimuth);
    const elevation = view.elevation ?? from.elevation;
    const zoom = view.zoom ?? from.zoom;
    return new Promise((resolve) => {
      const tw = this.tweens.add({
        duration,
        easing,
        onUpdate: (k) => {
          v.target.lerpVectors(from.target, target, k);
          v.azimuth = wrap(from.azimuth + dAz * k);
          v.elevation = from.elevation + (elevation - from.elevation) * k;
          v.zoom = Math.exp(Math.log(from.zoom) + (Math.log(zoom) - Math.log(from.zoom)) * k);
          this.zoomGoal = v.zoom;
          this.onChange();
        },
        onComplete: () => {
          if (this.anim === tw) this.anim = null;
          resolve();
        },
      });
      tw.goal = from.azimuth + dAz;
      this.anim = tw;
    });
  }

  turn(dir) {
    const current = this.anim?.goal ?? this.view.azimuth;
    const k = Math.round(wrap(current - BASE_AZIMUTH) / QUARTER) + dir;
    return this.animateTo({ azimuth: wrap(BASE_AZIMUTH + k * QUARTER) }, { duration: 620 });
  }

  update(dt) {
    let changed = false;
    if (!this.anim && Math.abs(Math.log(this.zoomGoal / this.view.zoom)) > 1e-4) {
      const f = (this.zoomGoal / this.view.zoom) ** (1 - Math.exp(-dt / 75));
      this.zoomAt(f, this.zoomAnchor);
      changed = true;
    }
    if (changed) this.onChange();
    return changed;
  }
}
