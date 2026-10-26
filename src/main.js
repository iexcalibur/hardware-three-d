import { Stage } from './stage/Stage.js';
import { blink } from './lessons/blink.js';

const lesson = blink;
const values = Object.fromEntries(lesson.params.map((p) => [p.key, p.value]));

const $ = (sel) => document.querySelector(sel);
const canvas = $('#stage');
const panel = $('.panel');
const codeEl = $('#code');
const logEl = $('#log');
const pinsEl = $('#pins');
const runBtn = $('#run');
const hotspot = $('#hotspot');

// ---- panel -------------------------------------------------------------------

$('#lede').textContent = lesson.lede;

function renderCode() {
  codeEl.innerHTML = lesson
    .sketch(values)
    .map((line, i) => `<span class="line" data-line="${i}">${line || ' '}</span>`)
    .join('');
}
renderCode();

function setTrace(line) {
  for (const el of codeEl.children) el.classList.toggle('is-active', line !== null && Number(el.dataset.line) === line);
}

const logLines = [];
function out(text) {
  logLines.push(text);
  while (logLines.length > 6) logLines.shift();
  logEl.innerHTML = logLines.map((l) => `<li>${l}</li>`).join('');
}

let lastPins = '';
function showPins(levels) {
  const text = levels
    ? Object.entries(levels)
        .map(([pin, { v }]) => `${pin} <b>${v >= 0.5 ? 'HIGH' : 'LOW'}</b>`)
        .join(' · ')
    : '';
  if (text === lastPins) return;
  lastPins = text;
  pinsEl.innerHTML = text;
}

function renderParams() {
  const root = $('#params');
  root.innerHTML = '';
  for (const p of lesson.params) {
    const wrap = document.createElement('div');
    wrap.className = 'param';
    if (p.type === 'range') {
      const label = document.createElement('label');
      label.innerHTML = `<span>${p.label}</span><b>${values[p.key]} ${p.unit ?? ''}</b>`;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.value = values[p.key];
      input.addEventListener('input', () => {
        values[p.key] = Number(input.value);
        label.querySelector('b').textContent = `${values[p.key]} ${p.unit ?? ''}`;
        onParams();
      });
      wrap.append(label, input);
    } else {
      const label = document.createElement('label');
      label.innerHTML = `<span>${p.label}</span>`;
      const choices = document.createElement('div');
      choices.className = 'choices';
      for (const [value, text] of p.options) {
        const b = document.createElement('button');
        b.textContent = text;
        b.classList.toggle('is-on', values[p.key] === value);
        b.addEventListener('click', () => {
          values[p.key] = value;
          for (const el of choices.children) el.classList.toggle('is-on', el === b);
          onParams();
        });
        choices.append(b);
      }
      wrap.append(label, choices);
    }
    root.append(wrap);
  }
}
renderParams();

$('#pinout').innerHTML = lesson.pinout
  .map(([pin, what, why, color]) => `<li><span class="pin" style="background:${color}">${pin}</span><div>${what}<small>${why}</small></div></li>`)
  .join('');

// ---- stage -------------------------------------------------------------------

const stage = new Stage(canvas, {
  onOut: out,
  onTrace: setTrace,
  onPins: showPins,
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
});

function onParams() {
  renderCode();
  stage.updateParams({ ...values });
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

let running = false;
runBtn.addEventListener('click', async () => {
  if (running) {
    stage.stop();
    running = false;
    runBtn.textContent = 'Run';
    runBtn.classList.remove('is-running');
    out('Stopped.');
    return;
  }
  running = true;
  runBtn.textContent = 'Stop';
  runBtn.classList.add('is-running');
  const ok = await stage.run();
  if (!ok && running) {
    running = false;
    runBtn.textContent = 'Run';
    runBtn.classList.remove('is-running');
  }
});

for (const b of document.querySelectorAll('.viewbar button')) {
  b.addEventListener('click', () => {
    const v = b.dataset.view;
    if (v === 'left') stage.turn(-1);
    else if (v === 'right') stage.turn(1);
    else if (v === 'home') stage.resetView();
    else if (v === 'flow') {
      b.classList.toggle('is-on');
      stage.setFlow(b.classList.contains('is-on'));
    } else if (v === 'grid') {
      b.classList.toggle('is-on');
      stage.setGrid(b.classList.contains('is-on'));
    }
  });
}

stage.setLesson(lesson, { ...values });
out('Ready. Press Run to upload the sketch.');
