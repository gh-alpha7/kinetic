// Wave optics: Young's double slit and single-slit diffraction / polarisation against the textbook formulas.
T.run(function () {
  ["ydse", "diffraction"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) { /* ignore */ } });
  function triesDone() { return document.querySelectorAll("#app .try.done").length; }
  function tryDone(i) { return document.querySelectorAll("#app .try")[i].classList.contains("done"); }
  function pointer(canvas, sim, type, px, py) {
    var r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, bubbles: true, clientX: r.left + px * sim.scale, clientY: r.top + py * sim.scale }));
  }

  /* ---------------- Young's double slit ---------------- */
  var t = T.mount("ydse"), L = window.__lab_ydse;
  T.ok("ydse mounts", !!L && T.text(".readouts").length > 20);
  var s = L.state();
  T.check("β default (600 nm, 0.5 mm, 1 m) = 1.200 mm", s.beta, 1.2, 0.0005);
  T.check("β measured = λD/d", s.beta, s.betaF, 0.0005);
  T.ok("readout shows β", /1\.200 mm/.test(T.text(".readouts")), T.text(".readouts").slice(0, 60));
  // 4 I0 cos²(φ/2) at a few points (equal slits)
  [0, 0.3, 0.6, 1.05, 2.4].forEach(function (y) {
    var phi = 2 * Math.PI * (y * 0.5 / 1 * 1e-6) / 600e-9;
    T.check("I(y=" + y + " mm) = 4cos²(φ/2)", L.intensity(y), 4 * Math.pow(Math.cos(phi / 2), 2), 0.005);
  });
  L.apply({ lam: 450, d: 0.3, D: 2, t: 0, r: 1 });
  T.check("β (450 nm, 0.3 mm, 2 m) = 3.000 mm", L.state().beta, 3.0, 0.0005);
  L.apply({ lam: 700, d: 0.25, D: 0.8, t: 0, r: 1 });
  T.check("β (700 nm, 0.25 mm, 0.8 m) = 2.240 mm", L.state().beta, 2.24, 0.0005);
  // practice: easy
  L.apply({ lam: 500, d: 0.4, D: 1.2, t: 0, r: 1, y: 1.5 });
  s = L.state();
  T.check("easy: β = 1.5 mm", s.beta, 1.5, 0.0005);
  T.check("easy: Δ at P = 1.00 λ", s.nP, 1.0, 0.005);
  // medium: film
  L.apply({ lam: 600, d: 0.5, D: 1, t: 6, mu: 1.5, r: 1, y: 6 });
  s = L.state();
  T.check("medium: y0 measured = 6.00 mm", s.y0, 6.0, 0.005);
  T.check("medium: y0 formula (μ-1)tD/d = 6.00 mm", s.y0F, 6.0, 1e-9);
  T.check("medium: shift = 5 fringes", s.shiftN, 5, 1e-9);
  T.check("medium: β unchanged by film", s.beta, 1.2, 0.0005);
  T.check("medium: P on central fringe, I = 4 I0", s.IP, 4, 0.005);
  // hard
  L.apply({ lam: 500, d: 0.5, D: 1, t: 1.25, mu: 1.5, r: 0.25, y: 0 });
  s = L.state();
  T.check("hard: I(O)/Imax = 5/9", s.IP / s.Imax, 5 / 9, 0.001);
  T.check("hard: I(O) = 1.25 I0", s.IP, 1.25, 0.001);
  T.check("hard: formula I matches", s.IPF, 1.25, 0.001);
  // tries
  L.apply({ lam: 600, d: 0.5, D: 1, t: 0, r: 1, y: 1.8 });
  var g = L.geom();
  pointer(t.sim.canvas, t.sim, "pointerdown", g.sx, g.cy - 3.6 * g.pxmm);
  pointer(t.sim.canvas, t.sim, "pointerup", g.sx, g.cy - 3.6 * g.pxmm);
  T.check("drag P to y = 3.6 mm", L.P(), 3.6, 0.02);
  T.ok("try order3 by dragging P", tryDone(0), L.state().nP);
  L.apply({ lam: 500, d: 0.5, D: 2, t: 0, r: 1 });
  T.ok("try width2", tryDone(1), L.state().beta);
  L.apply({ lam: 600, d: 0.5, D: 1, t: 4.8, mu: 1.5, r: 1 });
  T.ok("try shift4", tryDone(2), L.state().shiftN);
  L.apply({ lam: 600, d: 0.5, D: 1, t: 0, r: 0.25 });
  T.check("I_max : I_min = 9", L.state().ratio, 9, 1e-6);
  T.ok("try ratio9", tryDone(3));
  T.ok("ydse all 4 tries", triesDone() === 4, triesDone());
  // play the waves
  T.click(/^Play/); t.sim.pause(); T.steps(t.sim, 30);
  T.ok("ydse steps", t.sim.time > 0.4);
  T.ok("ydse 3 practice questions", document.querySelectorAll("#app .qcard").length === 3);


  /* ---------------- Diffraction & polarisation ---------------- */
  t = T.mount("diffraction");
  var Q = window.__lab_diffraction;
  T.ok("diffraction mounts", !!Q && T.text(".readouts").length > 20);
  s = Q.state();
  T.check("slit default first min = λD/a = 4.00 mm", s.y1, 4.0, 0.005);
  T.check("slit default width 2λD/a = 8.00 mm", s.width, s.widthF, 0.005);
  [0.5, 2, 3.3, 6, 9.7].forEach(function (y) {
    T.check("I(y=" + y + ") phasor sum = (sinβ/β)²", Q.slitI(y), Q.slitIF(y), 0.0015);
  });
  Q.apply({ mode: "slit", lam: 450, a: 0.06, D: 1.8 });
  s = Q.state();
  T.check("first min (450 nm, 0.06 mm, 1.8 m) = 13.50 mm", s.y1, 13.5, 0.005);
  T.check("central width = 27.00 mm", s.width, 27.0, 0.01);
  Q.apply({ mode: "slit", lam: 700, a: 0.35, D: 0.6 });
  T.check("first min (700 nm, 0.35 mm, 0.6 m) = 1.20 mm", Q.state().y1, 1.2, 0.005);
  // practice easy
  Q.apply({ mode: "slit", lam: 600, a: 0.2, D: 1.5, y: 4.5 });
  s = Q.state();
  T.check("easy: central width 9.00 mm", s.width, 9.0, 0.005);
  T.check("easy: P on first dark band, I ≈ 0", s.IP, 0, 0.001);
  T.check("easy: a sinθ at P = 1.00 λ", s.nP, 1, 0.005);
  // tries: dark2 by dragging P, width10
  var g2 = Q.geom();
  pointer(t.sim.canvas, t.sim, "pointerdown", g2.sx, g2.cy - 9.0 * g2.pxmm);
  pointer(t.sim.canvas, t.sim, "pointerup", g2.sx, g2.cy - 9.0 * g2.pxmm);
  T.check("drag P to 9.0 mm", Q.P(), 9.0, 0.02);
  T.ok("try dark2 by dragging P", tryDone(0), Q.state().nP);
  Q.apply({ mode: "slit", lam: 500, a: 0.1, D: 1 });
  T.check("width (500 nm, 0.1 mm, 1 m) = 10.00 mm", Q.state().width, 10, 0.005);
  T.ok("try width10", tryDone(1));
  // polarisers
  Q.apply({ mode: "polar", thA: 0, thB: 45, thC: 60, B: false, C: true });
  s = Q.state();
  T.check("Malus: 60° gives I0/8", s.Iout, 0.125, 0.0005);
  T.check("Malus formula", s.IoutF, 0.125, 1e-9);
  T.check("first polariser gives I0/2", s.stages[0], 0.5, 0.0005);
  Q.apply({ mode: "polar", thA: 20, thB: 45, thC: 50, B: false, C: true });
  T.check("Malus: 30° gives 3I0/8", Q.state().Iout, 0.375, 0.0005);
  Q.apply({ mode: "polar", thA: 0, thB: 45, thC: 90, B: false, C: true });
  T.check("crossed: 0", Q.state().Iout, 0, 1e-6);
  T.ok("surprise not yet", !tryDone(2));
  // switch B on by tapping the middle polariser
  var gp = Q.geom();
  pointer(t.sim.canvas, t.sim, "pointerdown", gp.polX[1], gp.cy);
  pointer(t.sim.canvas, t.sim, "pointerup", gp.polX[1], gp.cy);
  s = Q.state();
  T.check("three polarisers at 45°: I0/8", s.Iout, 0.125, 0.0005);
  T.ok("try surprise", tryDone(2), s.Iout);
  // rotate C by dragging: drag its top to the vertical (0°)
  pointer(t.sim.canvas, t.sim, "pointerdown", gp.polX[2] + 30, gp.cy);
  pointer(t.sim.canvas, t.sim, "pointermove", gp.polX[2], gp.cy - 80);
  pointer(t.sim.canvas, t.sim, "pointerup", gp.polX[2], gp.cy - 80);
  T.check("drag C to 0°: I = I0/2·cos²45·cos²45 = I0/8", Q.state().Iout, 0.125, 0.0005);
  // practice hard
  Q.apply({ mode: "polar", thA: 0, thB: 15, thC: 90, B: true, C: true });
  s = Q.state();
  T.check("hard: I out = I0/32", s.Iout, 1 / 32, 0.0002);
  T.check("hard: formula I0/8 sin²30°", s.IoutF, 1 / 32, 1e-9);
  T.ok("hard: readout shows I₀/32", /I₀\/32/.test(T.text(".readouts")), T.text(".readouts"));
  // Brewster
  Q.apply({ mode: "brewster", n: 1.5, i: 40 });
  s = Q.state();
  T.check("θB simulated (Rp minimum) = atan 1.5 = 56.31°", s.thB, 56.31, 0.01);
  T.ok("brewster try not yet", !tryDone(3));
  T.check("Fresnel normal incidence R = ((n-1)/(n+1))²", Q.fresnel(1.5, 0).Rs, 0.04, 1e-9);
  Q.apply({ mode: "brewster", n: 1.5, i: 56.5 });
  s = Q.state();
  T.ok("Rp ~ 0 near θB", s.fr.Rp < 1e-4, s.fr.Rp);
  T.check("reflected ⟂ refracted at θB", 180 - 56.31 - Q.fresnel(1.5, 56.31).r, 90, 0.01);
  T.ok("try brewster", tryDone(3));
  // practice medium
  Q.apply({ mode: "brewster", n: 1.73, i: 60 });
  s = Q.state();
  T.check("medium: r = 30°", s.fr.r, 30, 0.05);
  T.check("medium: θB = 60°", s.thBF, 60, 0.05);
  // drag the incoming ray to 30°
  var o = Q.geom().O, ang = 30 * Math.PI / 180;
  pointer(t.sim.canvas, t.sim, "pointerdown", o.x - Math.sin(ang) * 150, o.y - Math.cos(ang) * 150);
  pointer(t.sim.canvas, t.sim, "pointerup", o.x - Math.sin(ang) * 150, o.y - Math.cos(ang) * 150);
  T.check("drag ray to i = 30°", Q.state().fr.r, Math.asin(Math.sin(ang) / 1.73) * 180 / Math.PI, 0.3);
  T.ok("diffraction all 4 tries", triesDone() === 4, triesDone());
  T.click(/^Play/); t.sim.pause(); T.steps(t.sim, 20);
  ["slit", "polar", "brewster"].forEach(function (m) { Q.apply({ mode: m }); t.sim.draw(); });
  T.ok("diffraction 3 practice questions", document.querySelectorAll("#app .qcard").length === 3);
  T.ok("no NaN in eqs", !/NaN|undefined/.test(T.text(".eqs") + T.text(".readouts")));
});
