# Building a part from a reference image

This is the method behind every 3D part in this project. Follow it and a new
component will look like it belongs with the others and will work in the
stage, the preview page and the lessons.

Start from `src/parts/_template.js`. The worked example at the end builds the
push button in `src/parts/button.js` from a photo.

## 1. The rules

| rule | why |
|---|---|
| Units are **millimetres**. | The Uno, the breadboard and the 2.54 mm pin grid are real sizes. |
| **y is up.** A part stands on **y = 0** at its own origin. | The stage drops parts onto breadboard holes, whose top is the part's y = 0. |
| Legs and pins sit on the **2.54 mm grid** (`P`), centred on the origin, and reach down to about **y = -0.5**. | So they visibly go into breadboard holes. |
| A part is **one function that returns a `THREE.Group`**. | The stage positions, animates, lifts and disposes groups. |
| Geometry is **primitives only**: `BoxGeometry`, `CylinderGeometry`, `LatheGeometry`, `ExtrudeGeometry`, `TubeGeometry`. No model files. | Keeps the repo self-contained and the outline pass clean. |
| Use the **shared palette** (`palette()`, `std()`) and the `box()` helper from `src/board/materials.js`. | One colour language across all parts. |
| **Labels are painted** onto a canvas with `canvasTexture()` and mapped onto a face. | No image assets; text stays crisp at any zoom. |
| Mark textures/materials reused across instances with `userData.shared = true`. | So `disposeGroup()` does not free them. |
| Set **`group.userData.part = { name, desc }`**. | That is the hover card. |
| Call **`anchor(group, x, y, z)`** above the part. | Callouts and the selection ring use it. |
| Keep faces **flat-coloured and few**. | The outline shader draws the edges; fine detail becomes noise. |

The `box(w, h, d, material, x, yBottom, z)` helper places a box by its
*bottom*, not its centre, which is what you want when stacking parts on a
surface.

## 2. Hooks the stage understands

Add these to `group.userData` only when the part needs them.

| hook | meaning | used by |
|---|---|---|
| `light = { lens, glow }` | `lens` is an emissive material, `glow` a sprite. `setLight(light, 0..1)` drives both. | LEDs, lamps, displays |
| `cap`, `capY` | A mesh that moves down 1.3 mm when pressed, and its rest height. | buttons, keys |
| `horn`, `wheel`, `prop` | A node the sim rotates. Name it after the real thing. | servo, stepper, fan |
| `tick(now) → bool` | Self-animation each frame; return true when something changed. | sensors with pulses |
| `wire = { tube, count, ends, curve }` | Only for wires; lets the stage grow them in and draw current beads. | `jumperWire` |
| `part.lift = false` | Do not lift on hover. | the Uno PCB itself |

## 3. From image to builder, step by step

1. **Name the part and find its datasheet.** Most hobby parts have one. Take
   the footprint, body size and pin pitch from it, not from the photo. The
   photo tells you the look: colours, which faces have text, what sticks up.
2. **List the volumes, biggest first.** A sensor module is "a PCB, two
   cylinders, a crystal can, a 4-pin header". Write that list before coding.
3. **Pick the origin.** The point that goes into the breadboard. For a part
   with legs it is the centre of the leg pattern at the surface of the board.
   For a module with a header, it is the header's first pin or its centre.
4. **Build the body** with `box()` and cylinders, bottom at y = 0.
5. **Add legs on the grid.** Two legs: `x = ±P/2`. Four in a square: `x = ±P`,
   `z = ±(pitch/2)`. Check against the datasheet pitch.
6. **Paint labels** with `canvasTexture()`. Text through
   `"Barlow Semi Condensed"` matches the rest of the stage.
7. **Add hooks** from section 2 if the part lights, moves or is pressed.
8. **Set `userData.part` and the anchor.**
9. **Register it** in `src/parts/catalog.js` and look at it in
   `parts.html`. Turn it with Q and E. Check it from all four sides.
10. **Use it in a lesson** by adding a spec to the lesson's `parts()` list
    (see `src/lessons/blink.js`) and, if it does something, drive it from the
    lesson's `sim()`.

## 4. Worked example: the push button

Reference: a 12 mm tactile switch. Black square base with four silver rivets,
a round red cap on a stem, four bent legs.

Datasheet facts: base 12 × 12 × 3.5 mm, cap 7 mm diameter, legs in two pairs
6.5 mm apart along one axis and 5.08 mm (two grid columns) along the other.

Volumes, biggest first: base box, thin dark top plate, four rivet cylinders,
stem cylinder, cap (a lathe so the top edge is rounded), four legs each made of
three small boxes (down into the hole, horizontal run, up into the base).

Decisions:
- Origin at the centre of the base, on the breadboard surface.
- The cap is stored as `userData.cap` with `capY` so the stage can press it.
- The cap colour is a parameter so the piano lesson can make eight of them.
- No label needed; the part is recognisable from shape alone.

The result is `src/parts/button.js`, about forty lines. Open
`parts.html`, choose "Push button", and compare it to the photo.

## 5. Checklist before you call it done

- [ ] Stands on y = 0; nothing pokes below y = -0.6 except legs.
- [ ] Legs on the 2.54 mm grid, centred on the origin.
- [ ] Uses `std()` / `palette()` materials only.
- [ ] Any text is a canvas texture, not geometry.
- [ ] `userData.part` has a name and a one-sentence description.
- [ ] `anchor()` called above the part.
- [ ] Hooks set if the part lights, moves or is pressed.
- [ ] Listed in `src/parts/catalog.js` and checked from four sides in `parts.html`.
- [ ] Mesh count is modest (under ~60 meshes; merge repeated legs with
      `mergeGeometries` if there are many, as the Uno's chip does).

## 6. Giving the job to an agent

The same instructions are packaged as a Claude Code skill in
`.claude/skills/build-part/`. In a Claude Code session on this repo you can
say "build a part from this image" and attach the photo; the skill walks the
agent through sections 3 and 5.
