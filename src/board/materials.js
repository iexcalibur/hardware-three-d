import * as THREE from 'three';

export const FX_LAYER = 1;

export const std = (color, roughness = 0.6, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

// One shared palette for the whole board so parts read as one object.
export function palette() {
  return {
    edge: std('#e0c39c', 0.8),
    header: std('#33374a', 0.5),
    headerHole: std('#0d0f17', 0.9),
    plastic: std('#2c3041', 0.5),
    chip: std('#2a2d38', 0.45),
    metal: std('#efe4d2', 0.42, 0.35),
    metalDark: std('#cdc2b0', 0.5, 0.3),
    pin: std('#e8e2d6', 0.32, 0.55),
    red: std('#ec5a4b', 0.4),
    can: std('#ebebe6', 0.34, 0.45),
    cream: std('#f1e4c8', 0.55),
    tan: std('#d6b98c', 0.5, 0.2),
    resBody: std('#25272f', 0.5),
    amber: std('#f5b444', 0.35, 0, { emissive: '#7a4300', emissiveIntensity: 0.35 }),
    green: std('#8bd67c', 0.35, 0, { emissive: '#1d5a12', emissiveIntensity: 0.35 }),
    ledBase: std('#f3eee4', 0.6),
    darkMetal: std('#8f949c', 0.45, 0.4),
  };
}

// A box standing on y = 0 (y is the bottom, not the centre).
export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Marks a point the UI can project to screen space (callouts, labels).
export function anchor(group, x, y, z) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  group.add(a);
  group.userData.anchor = a;
  return a;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    o.geometry?.dispose();
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.shared) continue;
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  });
}
