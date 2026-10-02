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
- **5 kg block, μs = 0.5:** a 20 N push is held by 20 N of static friction; breakaway at 24.5 N flat (22.0 N at a 30° pull vs 21.95 N theory); sliding acceleration matches 197609Fsphi - mu_k N)/m 3 decimals.
- **Incline 25°, μs 0.4, μk 0.3:** a = 1.48 m/s² for 2 kg and 8 kg; smooth 30° gives 4.90 m/s²; flicked up a 40° slope it decelerates at 8.551 and returns at 4.047 m/s² (theory 8.551 / 4.047).
- **Atwood 3 kg + 5 kg:** a = 2.45 m/s², T = 36.75 N; table system a = 2.16 m/s²; the string never stretches (both blocks move 3.0546 m).

## Structure

Plain static site, no build step.

| File | Role |
| --- | --- |
| `index.html` | Shell, fonts, matter.js and KaTeX from jsDelivr |
| `css/style.css` | Design: one colour per quantity (blue displacement, green velocity, orange acceleration, purple gravity), light and dark |
| `js/core.js` | SI-unit simulation wrapper, fixed-step clock with slow motion, zoom/pan camera, drawing helpers, graphs, sliders, self-checking experiments, quiz, lab page scaffold |
| `js/labs/*.js` | One file per lab: `line`, `projectile`, `relative` (kinematics); `forces`, `incline`, `pulleys` (laws of motion) |
| `js/home.js` | Landing page with a throw-things-around sandbox |
| `js/app.js` | Hash router (`#/`, `#/kinematics/line`, `…/projectile`, `…/relative`) |

To add a lab, create `js/labs/<name>.js` that calls `K.registerLab({ id, chapter, title, short, lede, tries, mount })`
and include it in `index.html`. Chapters are listed in `CHAPTERS` in `core.js`; navigation, the home page cards and
the pager follow from that. The scaffold gives it the stage, graphs, maths, readouts, experiments,
explanation and quiz regions.

When `css/` or `js/` change, bump the `?v=` numbers in `index.html` so returning visitors
don't mix a new page with cached old files.

## Running locally

Serve the folder with any static server, for example `npx serve .`, and open `http://localhost:3000`.
On `localhost` the simulations are exposed as `window.__sims` for testing.
