// Rotational motion: torque & equilibrium, moment of inertia, rolling without slipping.
T.run(function () {
  var G = 9.8;
  ["torque", "inertia", "rolling"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) { /* private mode */ } });
  function release(t) { T.click(/^(Release|Spin)/); t.sim.pause(); }
  function runUntil(t, done, max) { for (var i = 0; i < (max || 2000) && !done(); i++) t.sim.stepOnce(); }
  function doneTries() { return [].slice.call(document.querySelectorAll("#app .try.done")).length; }
  function tried(id, lab) { return !!(JSON.parse(localStorage.getItem("kinetic:tries:" + lab) || "{}")[id]); }

  /* ---------- torque ---------- */
  var t = T.mount("torque"), L = window.__lab_torque;
  T.ok("torque: mounts with a sim", !!t.sim);
  T.ok("torque: four equations rendered", document.querySelectorAll("#app .eq .katex").length >= 4);
  T.ok("torque: three graphs", document.querySelectorAll("#app .graph canvas").length === 3);
  T.ok("torque: three practice questions", document.querySelectorAll("#app .qcard").length === 3);
  var s = L.state().s;
  T.check("torque: default net torque Σmg(xp − x)", s.tau, 9.8 * (4 * 1.2 - 3 * 1.4), 1e-9);
  T.check("torque: default centre of gravity", s.xcg, (2 * 2 + 4 * 0.8 + 3 * 3.4) / 9, 1e-9);
  release(t); T.steps(t.sim, 1);
  T.check("torque: measured Iα equals the net torque (5.88 N·m)", L.state().alphaMeas * s.I, 5.88, 0.005);

  // easy: 6 kg at 1 m left, 4 kg at 1.5 m right balances
  L.apply({ xp: 2, M: 0, ms: [6, 4, 0], xs: [1, 3.5, 2] });
  T.check("torque easy: balanced at d = 1.5 m", L.state().s.tau, 0, 1e-6);
  release(t); T.steps(t.sim, 130);
  T.check("torque easy: beam stays level", L.state().th, 0, 1e-12);
  T.ok("torque try 'balance' triggered", tried("balance", "torque"));

  // medium: pivot at 0.8 m, R = 98 N
  L.apply({ xp: 0.8, M: 4, ms: [6, 0, 0], xs: [0, 2, 2] });
  s = L.state().s;
  T.check("torque medium: balanced with pivot at 0.8 m", s.tau, 0, 1e-6);
  T.check("torque medium: centre of gravity 0.8 m", s.xcg, 0.8, 1e-9);
  release(t); T.steps(t.sim, 130);
  T.check("torque medium: pivot force 98 N", L.state().R, 98, 0.05);
  T.ok("torque medium: readout shows 98.0 N", /98\.0 N/.test(T.text(".readouts")), T.text(".readouts"));
  T.ok("torque try 'cg' triggered", tried("cg", "torque"));

  // hard: 8 kg, 4 m beam pivoted 1 m from an end: α = 4.2 rad/s², R = 44.8 N
  L.apply({ xp: 1, M: 8, ms: [0, 0, 0], xs: [0, 2, 4] });
  release(t); T.steps(t.sim, 1);
  var st = L.state();
  T.check("torque hard: α just after release (sim)", Math.abs(st.alphaMeas), 4.2, 0.005);
  T.check("torque hard: α formula", Math.abs(st.s.alpha), 12 * G / 28, 1e-9);
  T.check("torque hard: pivot force just after release (formula)", st.s.R0, 4 * 8 * G / 7, 1e-9);
  T.check("torque hard: pivot force from the sim, first step", st.R, 44.8, 0.05);
  T.ok("torque try 'reaction' triggered", tried("reaction", "torque"));
  runUntil(t, function () { return L.state().landed; });
  st = L.state();
  T.ok("torque hard: right end lands", st.landed === "right", st.landed);
  T.check("torque hard: landing tilt asin(0.45/3)", st.th, -Math.asin(0.45 / 3), 1e-9);
  T.check("torque hard: pivot force once resting, Mg(1 − d/(L − xp))", st.R, 78.4 * 2 / 3, 1e-6);
  T.check("torque hard: floor force N", st.N, 78.4 / 3, 1e-6);

  // lighter side down: 2 kg at 2 m beats 6 kg at 0.5 m
  L.apply({ xp: 2, M: 0, ms: [6, 2, 0], xs: [1.5, 4, 2] });
  release(t); runUntil(t, function () { return L.state().landed; });
  T.ok("torque: lighter (right) side lands", L.state().landed === "right");
  T.ok("torque try 'lighter' triggered", tried("lighter", "torque"));
  T.ok("torque: all 4 tries done", doneTries() === 4, doneTries());

  /* ---------- inertia ---------- */
  t = T.mount("inertia"); var I = window.__lab_inertia;
  T.ok("inertia: mounts with a sim", !!t.sim);
  function fall() { release(t); runUntil(t, function () { return I.state().done; }); return I.state(); }
  // easy: disc 4 kg, 0.4 m: I = 0.32
  I.apply({ mode: "wheel", shape: "disc", M: 4, R: 0.4, r: 0.2, m: 0.5 });
  T.check("inertia easy: I = ½MR²", I.state().s.I, 0.32, 1e-9);
  st = fall();
  var aF = G * 0.5 / (0.5 + 0.32 / 0.04);
  T.check("inertia easy: measured a = gm/(m + I/r²)", st.aMeas, aF, 1e-9);
  T.check("inertia easy: fall time √(2h/a)", t.sim.time, Math.sqrt(4 / aF), 1 / 60 + 1e-9);
  T.check("inertia: energy mgh = ½mv² + ½Iω²", 0.5 * 0.5 * st.v * st.v + 0.5 * 0.32 * Math.pow(st.v / 0.2, 2), 0.5 * G * st.y, 1e-9);
  // medium: ring 2 kg, R 0.5, spool 0.25, 1 kg: a = 1.09, T = 8.71
  I.apply({ mode: "wheel", shape: "ring", M: 2, R: 0.5, r: 0.25, m: 1 });
  st = fall();
  T.check("inertia medium: a = 1.09 m/s²", st.aMeas, 1.09, 0.005);
  T.check("inertia medium: T = m(g − a) = 8.71 N", 1 * (G - st.aMeas), 8.71, 0.005);
  T.check("inertia medium: τ = Iα (T r vs I a/r)", (G - st.aMeas) * 0.25, 0.5 * st.aMeas / 0.25, 1e-9);
  I.apply({ mode: "wheel", shape: "disc", M: 2, R: 0.5, r: 0.25, m: 1 });
  st = fall();
  T.check("inertia: disc a = 1.96 m/s²", st.aMeas, 1.96, 1e-9);
  T.ok("inertia try 'shape' triggered", tried("shape", "inertia"));
  // rod with collars, parallel axis
  I.apply({ mode: "wheel", shape: "rod", M: 1, R: 0.5, r: 0.2, m: 0.5, mc: 1, d: 0.15 });
  T.check("inertia: rod + collars I", I.state().s.I, 1 * 0.25 / 3 + 2 * (0.5 * 0.0025 + 0.0225), 1e-12);
  fall();
  I.apply({ mode: "wheel", shape: "rod", M: 1, R: 0.5, r: 0.2, m: 0.5, mc: 1, d: 0.4 });
  T.check("inertia: collars at 0.4 m", I.state().s.I, 1 * 0.25 / 3 + 2 * (0.5 * 0.0025 + 0.16), 1e-12);
  fall();
  T.ok("inertia try 'collars' triggered", tried("collars", "inertia"));
  I.apply({ mode: "wheel", shape: "disc", M: 0.5, R: 0.3, r: 0.3, m: 5 });
  st = fall();
  T.check("inertia: light wheel a", st.aMeas, 5 * G / 5.25, 1e-9);
  T.ok("inertia try 'light' triggered", tried("light", "inertia"));
  // hard: platform 4 kg, two 1 kg masses 0.8 -> 0.2 m, ω0 = 2
  I.apply({ mode: "spin", Mp: 4, pm: 1, r1: 0.8, r2: 0.2, w0: 2 });
  T.ok("inertia: play button says Spin", /Spin/.test(t.root.querySelector('[data-act="play"]').textContent));
  st = fall();
  T.check("inertia hard: final ω (sim) = I1ω0/I2", st.w, 3.28 * 2 / 2.08, 1e-5);
  T.check("inertia hard: L conserved (sim)", I.Ip(st.p, st.r) * st.w, 6.56, 1e-5);
  T.check("inertia hard: work = ΔKE = 3.78 J", 0.5 * I.Ip(st.p, st.r) * st.w * st.w - st.KE0, 3.78, 0.005);
  I.apply({ mode: "spin", Mp: 1, pm: 1, r1: 0.8, r2: 0.2, w0: 2 });
  st = fall();
  T.check("inertia: skater ω ratio I1/I2", st.w / 2, 1.78 / 0.58, 1e-5);
  T.ok("inertia try 'skater' triggered", tried("skater", "inertia"));
  T.ok("inertia: all 4 tries done", doneTries() === 4, doneTries());

  /* ---------- rolling ---------- */
  t = T.mount("rolling"); var R = window.__lab_rolling;
  T.ok("rolling: mounts with a sim", !!t.sim);
  function roll() { release(t); runUntil(t, function () { return R.state().done; }); return R.state().main; }
  R.apply({ body: "solid", th: 30, mu: 0.5, m: 2, r: 0.25 });
  var M = roll();
  T.check("rolling easy: solid sphere a = 3.50", M.aMeas, 3.5, 1e-9);
  T.check("rolling easy: v at bottom √(10gh/7)", M.vEnd, Math.sqrt(10 * G * 2.5 / 7), 1e-9);
  T.check("rolling easy: time √(2L/a)", M.t, Math.sqrt(10 / 3.5), 1e-9);
  T.check("rolling: rolls without slipping, v = ωr", M.w * 0.25, M.v, 1e-9);
  var order = R.state().order.join(",");
  T.ok("rolling: race order block, sphere, disc, shell, ring", order === "block,solid,disc,hollow,ring", order);
  T.ok("rolling try 'race' triggered", tried("race", "rolling"));
  R.apply({ body: "solid", th: 30, mu: 0.5, m: 6, r: 0.4 });
  var M2 = roll();
  T.check("rolling: same time with other m and r", M2.t, M.t, 1e-9);
  T.ok("rolling try 'mass' triggered", tried("mass", "rolling"));
  // medium: disc at 30°, v = 5.72, rotational share 1/3
  R.apply({ body: "disc", th: 30, mu: 0.5, m: 2, r: 0.25 });
  M = roll();
  T.check("rolling medium: disc v at bottom 5.72", M.vEnd, 5.72, 0.005);
  var KEt = 0.5 * 2 * M.v * M.v, KEr = 0.5 * 0.5 * 2 * 0.0625 * M.w * M.w;
  T.check("rolling medium: rotational share 1/3", KEr / (KEt + KEr), 1 / 3, 1e-9);
  T.check("rolling medium: mgh = KE", KEt + KEr, 2 * G * 2.5, 1e-6);
  // hard: disc at 45°, μ = 0.2 slips
  R.apply({ body: "disc", th: 45, mu: 0.2, m: 2, r: 0.25 });
  T.check("rolling hard: μmin = ⅓ tan45°", R.state().main.sol.muMin, 1 / 3, 1e-9);
  M = roll();
  T.ok("rolling hard: it slips", M.sol.slip);
  T.check("rolling hard: a = g(sinθ − μcosθ) = 5.54", M.aMeas, 5.54, 0.005);
  T.check("rolling hard: α = μg cosθ/(βr)", M.sol.alpha, 0.2 * G * Math.cos(Math.PI / 4) / (0.5 * 0.25), 1e-9);
  var heat = M.sol.f * (5 - 0.25 * M.phi), Ke = 0.5 * 2 * M.v * M.v + 0.5 * 0.5 * 2 * 0.0625 * M.w * M.w;
  T.check("rolling hard: mgh = KE + heat", Ke + heat, 2 * G * 5 * Math.sin(Math.PI / 4), 1e-6);
  T.ok("rolling try 'slip' triggered", tried("slip", "rolling"));
  R.apply({ body: "disc", th: 30, mu: 0.2, m: 2, r: 0.25 });
  M = roll();
  T.ok("rolling: rolls just above μmin", !M.sol.slip && 0.2 - M.sol.muMin < 0.02);
  T.ok("rolling try 'edge' triggered", tried("edge", "rolling"));
  T.ok("rolling: all 4 tries done", doneTries() === 4, doneTries());
  T.ok("rolling: readouts render", T.text(".readouts").length > 40);
});
