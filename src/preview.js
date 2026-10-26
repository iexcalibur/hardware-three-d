import * as THREE from 'three';
import { Stage, FLOOR_Y } from './stage/Stage.js';
import { catalog } from './parts/catalog.js';
import { setLight } from './parts/components.js';

// A turntable for one part at a time, so a new builder can be checked
// without wiring it into a lesson. Parts stand on the floor at the origin.

const $ = (sel) => document.querySelector(sel);
const canvas = $('#stage');
const panel = $('.panel');
const select = $('#part');
const optionsEl = $('#options');
const metaEl = $('#meta');
const hotspot = $('#hotspot');
const lightRow = $('#light-row');
const lightInput = $('#light');

const stage = new Stage(
  canvas,
  {
    onHover: (info, pointer) => {
      if (!info || !pointer) {
        hotspot.hidden = true;
        return;
      }
      hotspot.hidden = false;
      hotspot.innerHTML = `<b>${info.name}</b>${info.desc ?? ''}`;
      hotspot.style.left = `${pointer.x}px`;
      hotspot.style.top = `${pointer.y}px`;
    },
  },
  { board: false },
);

const params = new URLSearchParams(location.search);
let current = params.get('part') in catalog ? params.get('part') : 'led';
const options = {};

for (const [key, entry] of Object.entries(catalog)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = entry.name;
  select.append(o);
}
select.value = current;

function renderOptions() {
  optionsEl.innerHTML = '';
  const entry = catalog[current];
  for (const [key, values] of Object.entries(entry.options ?? {})) {
    options[key] ??= values[0];
    const wrap = document.createElement('div');
    wrap.className = 'param';
    wrap.innerHTML = `<label><span>${key}</span></label>`;
    const choices = document.createElement('div');
    choices.className = 'choices';
    for (const v of values) {
      const b = document.createElement('button');
      b.textContent = String(v);
      b.classList.toggle('is-on', options[key] === v);
      b.addEventListener('click', () => {
        options[key] = v;
        for (const el of choices.children) el.classList.toggle('is-on', el === b);
        show();
      });
      choices.append(b);
    }
    wrap.append(choices);
    optionsEl.append(wrap);
  }
}

function lessonFor(key) {
  const entry = catalog[key];
  const size = entry.size ?? 30;
  return {
    id: `preview-${key}`,
    view: { target: [0, size * 0.15, 0], zoom: 8, frame: [0, -size * 0.1, size * 1.6, size * 1.2] },
    parts: () => [
      {
        id: 'part',
        key: `${key}|${JSON.stringify(options)}`,
        build: () => entry.build({ renderer: stage.renderer }, options),
        at: new THREE.Vector3(0, FLOOR_Y, 0),
      },
    ],
  };
}

function describe(group) {
  let meshes = 0;
  let triangles = 0;
  // measure solid meshes only; glow sprites would inflate the box
  const bbox = new THREE.Box3();
  group.updateWorldMatrix(true, true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.layers.isEnabled(0)) bbox.expandByObject(o);
    meshes++;
    const idx = o.geometry.index;
    triangles += (idx ? idx.count : o.geometry.attributes.position.count) / 3;
  });
  const size = bbox.getSize(new THREE.Vector3());
  const hooks = ['light', 'cap', 'horn', 'wheel', 'prop', 'tick', 'wire'].filter((h) => group.userData[h]);
  metaEl.textContent =
    `size  ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm\n` +
    `base  y = ${(bbox.min.y - FLOOR_Y).toFixed(2)} (legs may dip below 0)\n` +
    `meshes ${meshes}   triangles ${Math.round(triangles)}\n` +
    `hooks ${hooks.length ? hooks.join(', ') : 'none'}`;
}

function show() {
  stage.setLesson(lessonFor(current), {}, { instant: false }).then(() => {
    const group = stage.parts.get('part')?.group;
    if (!group) return;
    describe(group);
    lightRow.hidden = !group.userData.light;
    lightInput.value = 0;
  });
  history.replaceState(null, '', `?part=${current}`);
}

select.addEventListener('change', () => {
  current = select.value;
  renderOptions();
  show();
});

lightInput.addEventListener('input', () => {
  const group = stage.parts.get('part')?.group;
  setLight(group?.userData.light, Number(lightInput.value) / 100);
  stage.touch();
});

for (const b of document.querySelectorAll('.viewbar button')) {
  b.addEventListener('click', () => {
    const v = b.dataset.view;
    if (v === 'left') stage.turn(-1);
    else if (v === 'right') stage.turn(1);
    else if (v === 'home') stage.resetView();
    else if (v === 'grid') {
      b.classList.toggle('is-on');
      stage.setGrid(b.classList.contains('is-on'));
    }
  });
}

function layout() {
  const w = innerWidth;
  const h = innerHeight;
  const wide = w > 900;
  const panelW = wide ? panel.offsetWidth + 32 : 0;
  const panelH = wide ? 0 : panel.offsetHeight;
  const margin = 40;
  stage.resize(w, h, (panelW + w) / 2, (h - panelH) / 2, Math.min(2, devicePixelRatio || 1), {
    w: Math.max(200, w - panelW - margin * 2),
    h: Math.max(160, h - panelH - margin * 2),
  });
  if (stage.lesson && !stage.controls.anim) stage.controls.jumpTo(stage.homeView());
}
addEventListener('resize', layout);
layout();

renderOptions();
show();
