---
name: build-part
description: Build a new 3D electronic component for this project's three.js stage from a reference image, part name or datasheet. Use when the user shares a photo of a sensor, module, switch, motor, display or other hobby-electronics part and wants it modelled, or asks to add a component to a lesson.
---

# Build a part from a reference

You are adding a component to a procedural three.js stage. Every part is a
function that returns a `THREE.Group` built from primitives, in millimetres,
standing on y = 0. Read `docs/BUILDING-PARTS.md` once; it holds the full rules.
Copy `src/parts/_template.js` as the starting point.

## Procedure

1. **Identify the part.** From the image, the user's words, or both. If it is a
   standard hobby part (HC-SR04, SG90, 28BYJ-48, TMP36, SSD1306 OLED, 12 mm
   tactile switch, 10 kΩ pot, piezo buzzer...), use its datasheet dimensions
   from your own knowledge. Ask the user only when the size or pinout is
   unknowable and matters.
2. **List the volumes**, biggest first, and which faces carry text.
3. **Choose the origin**: the point that goes into the breadboard (centre of
   the leg pattern on the board surface, or the header).
4. **Write `src/parts/<name>.js`** following the template. Body with
   `box()`/cylinders/lathes, legs on the 2.54 mm grid down to y ≈ -0.5,
   labels via `canvasTexture()`, shared materials via `std()`.
5. **Add hooks** when the part does something: `userData.light` if it lights,
   `userData.cap`/`capY` if pressed, a named node such as `userData.horn` if
   the sim rotates it, `userData.tick(now)` if it self-animates.
6. **Set `userData.part = { name, desc }`** and call `anchor()` above it.
7. **Register** it in `src/parts/catalog.js` with a rough `size` in mm and any
   options.
8. **Verify** in the browser: open `/parts.html`, select the part, take a
   screenshot, turn it with the Q/E buttons, screenshot again. Fix anything
   floating, sunken, off-grid or mis-scaled. Check the console for errors.
9. If asked to use it in a lesson, add a spec to that lesson's `parts()` and
   drive it from `sim()` (see `src/lessons/blink.js` and `helpers.js`).

## Style constraints

- Primitives only, no model loaders, no image assets.
- Flat colours, few meshes; the outline pass draws the edges.
- Merge many identical small pieces with `mergeGeometries` (see the DIP chip
  in `src/board/uno.js`).
- Don't copy text, artwork or lesson copy from the reference site in
  `reference/`; dimensions and pin names are facts and are fine.

## Done when

The checklist in section 5 of `docs/BUILDING-PARTS.md` passes and the part
renders in `parts.html` from all four sides with no console errors.
