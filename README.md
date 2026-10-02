# Kinetic: JEE physics you can play with

Interactive IIT JEE physics labs built on a real 2D physics engine
([matter.js](https://brm.io/matter-js/)). Students change the numbers, throw things
and switch frames of reference, and watch the textbook formulas come true.

## Chapter 1: Kinematics

| Lab | What you play with | What it teaches |
| --- | --- | --- |
| **Motion in a straight line** | A cart on a 60 m track: start position, initial velocity, acceleration. Ticker tape, a ghost cart every second, live x–t / v–t / a–t graphs. | Slope of x–t is v, slope of v–t is a, area under v–t is displacement. The three equations of motion. Distance vs displacement when the cart turns around. |
| **Projectile motion** | Drag back from the launcher like a slingshot. Change gravity (Moon, Mars, Earth, Jupiter), launch from a tower, knock over a crate stack. | Independence of horizontal and vertical motion (x/y shadows), T, H and R formulas, complementary angles, 45° for maximum range, velocity at the top. |
| **Relative velocity** | Steer a boat across a river. Switch between the bank's and the water's frame of reference. | Vector addition of velocities, shortest time vs shortest path, when landing opposite is impossible. |

Every lab has:

- **Live maths:** the JEE equations with the student's own numbers substituted in (KaTeX).
- **Readouts:** the measured value next to the formula value.
- **Try this:** guided experiments that tick themselves off when the student achieves them.
- **The idea:** a short explanation plus the classic JEE trap for that topic.
- **JEE check:** one exam-style question with a worked explanation.

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

## Structure

Plain static site, no build step.

| File | Role |
| --- | --- |
| `index.html` | Shell, fonts, matter.js and KaTeX from jsDelivr |
| `css/style.css` | Design: one colour per quantity (blue displacement, green velocity, orange acceleration, purple gravity), light and dark |
| `js/core.js` | SI-unit simulation wrapper, fixed-step clock with slow motion, zoom/pan camera, drawing helpers, graphs, sliders, self-checking experiments, quiz, lab page scaffold |
| `js/labs/*.js` | One file per lab |
| `js/home.js` | Landing page with a throw-things-around sandbox |
| `js/app.js` | Hash router (`#/`, `#/kinematics/line`, `…/projectile`, `…/relative`) |

To add a lab, create `js/labs/<name>.js` that calls `K.registerLab({ id, chapter, title, short, lede, tries, mount })`
and include it in `index.html`. The scaffold gives it the stage, graphs, maths, readouts, experiments,
explanation and quiz regions.

When `css/` or `js/` change, bump the `?v=` numbers in `index.html` so returning visitors
don't mix a new page with cached old files.

## Running locally

Serve the folder with any static server, for example `npx serve .`, and open `http://localhost:3000`.
On `localhost` the simulations are exposed as `window.__sims` for testing.
