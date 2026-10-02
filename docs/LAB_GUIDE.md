# Writing a Kinetic lab

Kinetic is a static site (no build step). Each lab is one JavaScript file that registers itself
with `K.registerLab(...)` and builds its page from the shared scaffold in `js/core.js`. Read
`js/core.js` (the `K` namespace) and at least two existing labs before writing one:

- `js/labs/pulleys.js`: matter.js bodies, exact textbook friction applied by hand, modes, graphs, practice.
- `js/labs/projectile.js`: drag-to-aim interaction, planets, camera zoom.
- `js/labs/line.js`: a lab whose physics is mostly analytic, drawn on the Sim canvas.

## File layout for a new chapter

```
js/labs/<chapter>/<lab>.js      one file per lab (2 or 3 per chapter)
js/labs/<chapter>/map.js        the chapter's concept-map ideas: one Maps.add({...}) call
tests/<chapter>.test.js         numeric checks for every lab in the chapter
```

Only create files in those places. Do not edit `index.html`, `js/core.js`, `js/maps.js`, the CSS or
any other shared file: they are wired up centrally afterwards. If you need something the shared
code doesn't offer, write it inside your own lab file. If you think a shared change is really
needed, say so in your final report instead of making it.

## The lab object

```js
(function () {
  "use strict";
  var lab = {
    id: "orbits",                 // globally unique, lowercase; used for progress and the concept map
    chapter: "gravitation",       // must match an id in CHAPTERS in core.js
    title: "Orbits & Kepler's laws",
    short: "ellipses, equal areas, T² ∝ r³",   // a few words for menus and cards
    lede: "One or two sentences that make a student want to try it. $LaTeX$ is fine.",
    tries: [ { id, title, text, why }, ... ],  // 3–4 self-checking experiments (see below)
    mount: mount
  };
  K.registerLab(lab);
  function mount(root) { var P = K.scaffold(root, lab); ...; return function destroy() { ... }; }
})();
```

`K.scaffold(root, lab)` returns the regions of the page: `P.canvas` (stage canvas), `P.hud`,
`P.note` (use `K.flash(P.note, text)`), `P.controls`, `P.graphs`, `P.eqs`, `P.readouts`, `P.tries`,
`P.triesCount`, `P.concept`, `P.quiz`, `P.playBtn`, `P.resetBtn`, `P.time`, `P.speedSlot`, `P.root`.
The scaffold also adds the lab's slice of the concept map automatically.

Every lab must fill all of them:

1. **Stage**: a `K.Sim` on `P.canvas`, with play / pause / reset wired by
   `K.transport(P, sim, { playLabel, onPlay, onReset })`. The thing on screen must actually move
   or respond: students learn by poking it. Give it direct manipulation where it makes sense
   (drag a charge, aim a ray, pull a spring), not only sliders.
2. **Controls** (`P.controls`): `K.slider`, `K.seg`, `K.check`, `<h3>` group titles, and a
   `.legend` for colours. Sensible ranges and defaults that show something interesting at once.
3. **Live graphs** (`P.graphs`): 2–3 `K.Graph`s in `<div class="graph"><canvas></canvas><p class="graph-cap">…</p></div>`.
   Solid = simulated, dashed = formula, where both exist.
4. **The maths, live** (`P.eqs`): 3–4 labelled equations, each `<div class="eq"><p class="eq-label">…</p><div class="eq-tex"></div></div>`,
   rendered with `K.tex`, with the student's own numbers substituted in and the result in bold. Bracket negative numbers.
5. **Readouts** (`P.readouts`): `K.readout(...)`, the measured value next to the formula value.
6. **Try this** (`P.tries`): `var tries = K.Tries(P.tries, lab.id, lab.tries, onChange)`; call
   `tries.mark(id)` when the student really achieves the experiment (detect it from the state, don't
   just tick it on a button press). Each `why` explains the physics in 1–3 sentences.
7. **The idea** (`P.concept`): a short explanation (`K.md`) plus a highlighted classic JEE trap
   (`<div class="trap"><b>JEE trap: …</b> …</div>`, as in the existing labs).
8. **Practice** (`P.quiz`): `K.practice(P.quiz, [easy, medium, hard], apply, P)`, with exactly 3
   questions: `{ level: "easy"|"medium"|"hard", tag, q, options: [4], answer: index, explain,
   hints: [2 for medium/hard], setup: {...}, watch: "what to look for" }`. `apply(setup)` loads the
   question's numbers into the controls and resets, so the student predicts, then tests it in the
   lab. The hard one should be a genuine JEE Advanced–style problem with a numerical answer that the
   lab can show. Every option a plausible mistake. Work every answer out, then check it in the sim.
9. **destroy**: stop the sim and graphs (`sim.destroy()`, `graph.destroy()`), remove any
   document-level listeners.

## The simulation (`K.Sim`)

World coordinates are **metres, y up**. `new K.Sim(canvas, { W, H, ppm, origin: {x, y}, g, gridStep, gridMajor, labels, yLabels, grid })`.
`sim.px(x, y)` → world px, `sim.m(px, py)` → metres, `sim.posM(body)`. Fixed 1/60 s steps:
`sim.on("before" | "step" | "under" | "over", fn)`; `sim.play()`, `sim.pause()`, `sim.stepOnce()`,
`sim.resetClock()`, `sim.time`, `sim.steps`. Drawing: `under` / `over` hooks get the canvas context
in world px; `sim.u(n)` gives a screen-constant size; `sim.force(ctx, x, y, fx, fy, color, label, pxPerN)`,
`K.arrow`, `K.label`, `sim.drawGround(ctx)`, `sim.pointer({ down, drag, up, hover })` (pointer in world px and metres).
`sim.zoom` and `sim.panX` move the camera (bottom-anchored).

**Use matter.js when the lab is about bodies moving and touching** (blocks, balls, collisions,
pulleys). Units: `sim.setG(g)`, `sim.setVel(body, vx, vy, ax, ay)` (starts half a step behind so
positions match `x0 + ut + ½at²` exactly), `sim.getVel(body, ax, ay)`, `sim.push(body, ax, ay)` for a
steady acceleration. matter's own friction is not the textbook model: set `friction: 0` and apply
Coulomb friction yourself, as `pulleys.js` and `forces.js` do.

**For everything else** (fields, circuits, rays, waves, gases on a PV diagram, decay), don't force
matter.js: step your own model in a `before`/`step` hook with `K.DT` and draw it on the Sim canvas.
Use an exact solution where one exists; otherwise a small enough step (substeps are fine) that the
sim matches the formula to the precision you display.

The colours are a language. Use the CSS variables through `K.theme`: `disp` displacement (blue),
`vel` velocity (green), `acc` acceleration (orange), `grav` gravity / weight (purple), `normal`
(cyan), `fric` (red), `app` applied or spring force (magenta), `ten` tension (yellow), plus `ink`,
`muted`, `body`, `ground`, `canvas-bg`, `line`, `surface`. Pick a consistent meaning for new
quantities (e.g. electric field, current, light) and put it in the legend.

## Concept map (`js/labs/<chapter>/map.js`)

```js
Maps.add({
  nodes: {                               // ids: prefix with the chapter, e.g. "grav_orbit"
    grav_law: { label: "Newton's law of gravitation", lab: "orbits", why: "One line: why it matters." }
  },
  edges: [["grav_law", "grav_orbit", "bends into"], ["n2", "grav_orbit", "sets the shape of"]],
  labs: { orbits: ["grav_law", "grav_orbit", ...] }   // which ideas each lab is about (6–8)
});
```

Every edge reads **cause → effect** with a short verb. Link to ideas from earlier chapters where
the physics really flows that way, so the whole course is one connected map. Existing ids:
kinematics `pos vel acc graphs suvat dist gconst indep proj frames vecadd river`, laws
`weight normal fric tension fbd force n2 n1 comp repose system`. Other chapters are being written in
parallel; only link to ids that already exist, or to your own.

## Testing (required)

Write `tests/<chapter>.test.js` and run it in headless Edge against the dev server (already running
on http://localhost:5400):

```
bash tests/run.sh <chapter> "js/labs/<chapter>/map.js,js/labs/<chapter>/a.js,js/labs/<chapter>/b.js" tests/<chapter>.test.js
```

It prints one `RESULT {...}` line with pass/fail counts, each check, and any JavaScript errors.
In the test: `T.run(function () { var t = T.mount("labid"); ... })`; `t.sim` is the lab's Sim;
`T.steps(sim, n)`; `T.click(/^Play/)` presses a button; `T.text(selector)`; `T.check(name, got, want, tol)`;
`T.ok(name, condition, info)`. See `tests/pulleys.test.js`. You can also reach a lab's internals by
exposing a small hook on `window` inside `mount` **only when `location.hostname === "localhost"`**
(as `window.__sims` does), e.g. `window.__lab_orbits = { apply: apply, state: function () {...} }`.

For every lab, test at least: it mounts with no errors; the simulated result matches the formula
for 2–3 different settings (including each practice question's answer, using its `setup`); and each
`tries` experiment can actually be triggered. Fix until everything passes. If the `RESULT` line is
missing, the page failed to load: rerun with a bigger `BUDGET=40000` or look for a syntax error.
You can also view a lab in a browser at `http://localhost:5400/tests/harness.html?labs=...` (no
`test=`), then mount it from the console.

## Writing style

Plain, warm and exact, like the existing labs: short sentences, second person, no filler, and no
em dashes in prose (use a colon, comma or full stop). Units always (`m/s²`, `N`, `J`). g = 9.8 m/s²
unless the lab says otherwise. Match the code style around you: `var`, ES5 functions, 2-space
indent, the same comment density.
