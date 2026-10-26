// A tiny tween list. Everything on the stage that moves over time goes
// through here so one speed knob (reduced motion) slows it all down.

export const ease = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inCubic: (t) => t * t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
};

export class Tweens {
  constructor() {
    this.list = new Set();
    this.speed = 1;
  }

  add({ duration = 600, delay = 0, easing = ease.inOutCubic, onUpdate, onComplete, onStart }) {
    const tw = {
      start: performance.now() + delay * this.speed,
      duration: Math.max(1, duration * this.speed),
      easing,
      onUpdate,
      onComplete,
      onStart,
      started: false,
      done: false,
      cancel: () => {
        tw.done = true;
        this.list.delete(tw);
      },
    };
    this.list.add(tw);
    return tw;
  }

  wait(ms) {
    return new Promise((resolve) => this.add({ duration: 1, delay: ms, onComplete: resolve }));
  }

  get active() {
    return this.list.size > 0;
  }

  update(now = performance.now()) {
    for (const tw of [...this.list]) {
      if (now < tw.start) continue;
      if (!tw.started) {
        tw.started = true;
        tw.onStart?.();
      }
      const k = Math.min(1, (now - tw.start) / tw.duration);
      tw.onUpdate?.(tw.easing(k), k);
      if (k >= 1) {
        this.list.delete(tw);
        tw.done = true;
        tw.onComplete?.();
      }
    }
  }
}
