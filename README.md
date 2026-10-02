# Kinetic: JEE physics you can play with

Interactive IIT JEE physics labs built on a real 2D physics engine
([matter.js](https://brm.io/matter-js/)). Students change the numbers, throw things
and switch frames of reference, and watch the textbook formulas come true.

## Catalog

Topics are arranged like a catalog rather than a row of tabs, so the site can grow to the whole syllabus:

- **`#/topics`**: every unit (Mechanics, Oscillations & waves, Heat & thermodynamics, Electricity & magnetism, Optics, Modern physics), each chapter as a card with its labs and your progress, and chapters that are coming soon with the topics planned for them. Search covers lab titles, descriptions and experiments; filters show what's ready or coming; a side list jumps between units.
- **Topics menu** in the header: the same tree in a drop-down, with a search box.
- **Breadcrumbs** on every lab: Topics › unit › chapter.

The syllabus lives in `UNITS` and `CHAPTERS` in `core.js`. A chapter shows as coming soon until a lab registers into it, then it goes live everywhere by itself.

## Chapter 1: Kinematics

| Lab | What you play with | What it teaches |
| --- | --- | --- |
| **Motion in a straight line** | A cart on a 60 m track: start position, initial velocity, acceleration. Ticker tape, a ghost cart every second, live x–t / v–t / a–t graphs. | Slope of x–t is v, slope of v–t is a, area under v–t is displacement. The three equations of motion. Distance vs displacement when the cart turns around. |
| **Projectile motion** | Drag back from the launcher like a slingshot. Change gravity (Moon, Mars, Earth, Jupiter), launch from a tower, knock over a crate stack. | Independence of horizontal and vertical motion (x/y shadows), T, H and R formulas, complementary angles, 45° for maximum range, velocity at the top. |
| **Relative velocity** | Steer a boat across a river. Switch between the bank's and the water's frame of reference. | Vector addition of velocities, shortest time vs shortest path, when landing opposite is impossible. |

## Chapter 2: Laws of motion

| Lab | What you play with | What it teaches |
| --- | --- | --- |
| **Forces & friction** | Push a block: mass, force and its angle, μs and μk. Live free-body diagram; *Ramp F up* shows the breakaway. Camera follows the block. | Newton's second law, normal force with an angled pull, static friction matching the push up to μs·N, the drop to μk·N, Newton's first law. |
| **Inclined plane** | Tilt the ramp, change mass and friction, flick the block up the slope. Gravity split into mg sin θ and mg cos θ. | Components on an incline, angle of repose (tan θ = μs), mass independence, friction flipping between going up and coming down. |
| **Pulleys & tension** | Atwood machine, or a block on a table pulled by a hanging mass. Free-body diagram per block. | Newton's second law per body, adding equations to eliminate T, why T lies between m₁g and m₂g, static friction on the table. |

matter.js handles gravity, contact and normal forces; friction is applied by the lab as exact Coulomb friction (static up to μs·N, then μk·N), because the engine's built-in friction isn't the textbook model.

Every lab has:

- **Live maths:** the JEE equations with the student's own numbers substituted in (KaTeX).
- **Readouts:** the measured value next to the formula value.
- **Try this:** guided experiments that tick themselves off when the student achieves them.
- **The idea:** a short explanation plus the classic JEE trap for that topic.
- **How it connects:** the lab's slice of the concept map, with neighbouring ideas from other labs faded in.
- **Practice:** three JEE-style questions (easy, medium, hard). Hints unlock one at a time, and *Set it up in the lab* loads the question's numbers so the student predicts the answer first and then checks it in the simulation.

## Playground

`#/playground` is a sandbox where students build their own systems from parts: blocks, balls, surfaces they draw (floors, walls, table tops, ramps), fixed and movable pulleys, strings over any number of wheels, springs, fixed points and turntables. It has three views: **side** (gravity down), **table top** (looking down, so friction acts on everything; this is where turntables live) and **space** (no floor, bodies attract with a scaled-up G). Select any body to see its live free-body diagram and readouts (tension, normal force, static or kinetic friction, spring force, the centripetal force a turntable needs). Graphs show its speed and the system's kinetic, potential and total energy. There are ready-made setups (table + hanging mass, two-pulley Atwood, movable pulley, ramp + pulley, loop the loop, spring, turntable, sun + planets, three-body figure eight, collisions) and challenges that ask for a prediction before revealing the physics. Builds autosave in the browser, Undo goes back, and *Copy link* encodes the whole build in the URL.

matter.js only finds contacts and their normal impulses. Everything else is solved in `playground.js` after each engine step, at 4 substeps per frame: inextensible strings (tangent segments and arcs around the wheels, solved jointly so light movable pulleys behave), exact Coulomb friction (static up to μs N, then μk N), springs, mutual gravity and turntables. Checked against the formulas:

- table + hanging mass a = 2.156 m/s², T = 15.29 N, N = 29.40 N; it holds with 1.4 kg (static friction 13.72 N = m₂g)
- two-pulley Atwood a = 2.450 m/s², T = 36.75 N; ramp + pulley a = 1.601 m/s²
- movable pulley: 2 kg balances 4 kg; with 2.5 kg the accelerations are 0.6925 and 1.385 m/s² (theory 0.6925, twice that)
- block on a 30° slope (μs 0.5, μk 0.3) a = 2.354 m/s²; at 27° (just past the 26.6° repose) 1.830; at 25° it holds
- loop the loop at 12.2 m/s: top speed 5.596 m/s (theory 5.589), tension within 0.14 N of mv²/r + mg cos θ; at 11 m/s the string goes slack at 136° (theory 135°)
- turntable blocks leave at ω = 1.983, 1.400, 1.183 rad/s (theory √(μs g/r) = 1.980, 1.400, 1.183)
- spring period 1.99 s (theory 1.987); elastic collision 1 kg at 6 m/s into 3 kg gives −3.00 and 3.00 m/s; projectile range 40.76 m (theory 40.82)

## Concept map

`#/map` draws every idea in the course as one cause → effect graph: weight splits on a slope, the normal force caps friction, friction goes into the free-body diagram, net force sets acceleration, acceleration changes velocity, and so on. Each arrow carries a verb ('sets max of', 'changes', 'if zero'). Tapping a concept lights up the whole chain that causes it (orange) and the chain it leads to (green), says in one line why it matters, and links to the lab that teaches it. Remembering the chain makes the separate facts quicker to recall.

The map is editable, so students can make it their own:

- **Move** ideas by dragging; pan by dragging the background; zoom with the buttons, Ctrl + scroll or a pinch.
- **Connect** two ideas by dragging from the dot on an idea's right edge onto another (or use Connect mode: click the cause, then the effect), then give the arrow a verb. Arrows can be reworded, reversed or deleted.
- **Collapse / expand**: the − / + under an idea folds away everything downstream of it (ideas still reached another way stay visible), with a count of what's hidden. Collapse all leaves only the root causes.
- **Add** ideas with the button or a double-click, and edit any idea's name, 'why it matters', colour and the lab that teaches it.
- Undo, Tidy up (re-layout), Fit, Reset, Copy link, Download and Import (JSON). Edits save in the browser. Ideas added to the course later still appear in a saved map unless the student deleted them.

Each lab's 'How it connects' panel keeps showing the course's original map and links to the editor.

## Physics accuracy

The engine knows nothing about kinematics formulas. It just steps time forward
60 times a second, in SI units:

- Gravity is set so that matter.js's acceleration equals exactly `g` m/s² at the
  chosen pixels-per-metre scale (`gravity.scale = g · ppm / 10⁶`).
- Bodies start half a step behind (`v₀ − ½·a·Δt`). With matter.js's integrator this makes
  every stepped position land *exactly* on `x = x₀ + ut + ½at²`, instead of drifting by
  `½·a·t·Δt`.
- Landing, turnaround and arrival moments are interpolated within the last step.

Checked results (simulated vs formula):

- **Cart braking from 20 m/s at −5 m/s²:** stops at **40.0000 m** at t = 4.000 s, returns to the start at t = 8.00 s (displacement 0, distance 80 m).
- **Projectile at 20 m/s and 30°:** R = 35.35 m, H = 5.10 m, T = 2.04 s, all matching. 60° gives the same 35.35 m range, and a 20 m tower matches too.
- **River 100 m wide, 3 m/s current, 5 m/s boat aimed to land opposite:** crosses in 25.0 s.
- **5 kg block, μs = 0.5:** a 20 N push is held by 20 N of static friction; breakaway at 24.5 N flat (22.0 N at a 30° pull vs 21.95 N theory); sliding acceleration matches (F cos φ − μk N)/m to 3 decimals.
- **Incline 25°, μs 0.4, μk 0.3:** a = 1.48 m/s² for 2 kg and 8 kg; smooth 30° gives 4.90 m/s²; flicked up a 40° slope it decelerates at 8.551 and returns at 4.047 m/s² (theory 8.551 / 4.047).
- **Atwood 3 kg + 5 kg:** a = 2.45 m/s², T = 36.75 N; table system a = 2.16 m/s²; the string never stretches (both blocks move 3.0546 m).

Every hard practice answer was also checked in its lab: 26° and 64° at 25 m/s both land at 50.3 m; the 80 m river with a 5 m/s current and a 3 m/s boat drifts 106.7 m at 37° upstream; the 20 m tower shot lands 56.88 m away; the table system with 2 kg hanging gives T = 15.3 N; the block flicked up a 37° slope at 8 m/s comes back past its start at 5.6 m/s (theory 5.66).

## Structure

Plain static site, no build step.

| File | Role |
| --- | --- |
| `index.html` | Shell, fonts, matter.js and KaTeX from jsDelivr |
| `css/style.css` | Design: one colour per quantity (blue displacement, green velocity, orange acceleration, purple gravity), light and dark |
| `js/core.js` | SI-unit simulation wrapper, fixed-step clock with slow motion, zoom/pan camera, drawing helpers, graphs, sliders, self-checking experiments, practice questions, lab page scaffold |
| `js/labs/*.js` | One file per lab: `line`, `projectile`, `relative` (kinematics); `forces`, `incline`, `pulleys` (laws of motion) |
| `js/catalog.js` | Catalog page and the header Topics menu, built from the syllabus and the registered labs |
| `js/maps.js` | Concept map: nodes, cause → effect edges, layered layout, per-lab and whole-course views |
| `js/mapedit.js` | The editable concept map at `#/map`: move, connect, collapse, add and share |
| `js/playground.js` | Playground: parts, editor, string/friction/spring/gravity/turntable solver, presets, challenges |
| `js/home.js` | Landing page with a throw-things-around sandbox |
| `js/app.js` | Hash router (`#/`, `#/topics`, `#/map`, `#/playground`, `#/<chapter>/<lab>`) |

To add a lab, create `js/labs/<name>.js` that calls `K.registerLab({ id, chapter, title, short, lede, tries, mount })`
and include it in `index.html`. Chapters are listed in `CHAPTERS` (grouped by `UNITS`) in `core.js`; the catalog, the Topics menu, the home page cards and
the pager follow from that. The scaffold gives it the stage, graphs, maths, readouts, experiments,
explanation, concept-map and practice regions. Add the lab's concepts to `LAB_NODES` in `maps.js`.

When `css/` or `js/` change, bump the `?v=` numbers in `index.html` so returning visitors
don't mix a new page with cached old files.

## Running locally

Serve the folder with any static server, for example `npx serve .`, and open `http://localhost:3000`.
On `localhost` the simulations are exposed as `window.__sims`, and the playground as `window.__pg`, for testing.
