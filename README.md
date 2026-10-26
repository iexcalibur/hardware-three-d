# Hardware 3D

An interactive 3D Arduino stage in the browser: a procedurally built Uno,
a breadboard, jumper wires and components, with a small per-lesson simulator
that drives pin levels, LED glow and current-flow beads.

Built with Vite, vanilla JavaScript and three.js. No models are loaded; every
part is generated from primitives and canvas-painted textures.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Drag to pan, scroll to zoom, Q/E or the
corner buttons to turn, hover parts for a label, Run to upload the sketch.

http://localhost:5173/parts.html shows one part at a time on a turntable.

## Adding a part

Read [docs/BUILDING-PARTS.md](docs/BUILDING-PARTS.md): the conventions, a
step-by-step from reference image to builder, and a worked example
(`src/parts/button.js`). Start from `src/parts/_template.js`, list the part in
`src/parts/catalog.js`, check it in `parts.html`. The same method is packaged
as a Claude Code skill in `.claude/skills/build-part/`.

## Layout

- `src/stage/` renderer, orthographic camera controls, outline post-pass, tweens
- `src/board/` Uno layout data, painted PCB texture, 3D component builders
- `src/parts/` breadboard, jumper wires, LED, resistor
- `src/sim/` current-flow beads and per-wire signal derivation
- `src/lessons/` lesson definitions: parts layout, sketch text, parameters, sim
- `docs/` how to build parts

## Licence

MIT. See [LICENSE](LICENSE). The Arduino Uno layout data is open-source hardware; Arduino is a trademark of Arduino AG and this project is not affiliated with it.
