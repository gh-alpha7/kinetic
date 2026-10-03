// Properties of matter: numeric checks for elasticity, fluids and viscosity.
T.run(function () {
  var G = 9.8;
  ["elasticity", "fluids", "viscosity"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) {} });
  var MAT = { steel: [2.0e11, 2.5e8, 3.0e8, 4.0e8], copper: [1.1e11, 1.2e8, 1.5e8, 2.2e8] };
  function area(rmm) { return Math.PI * Math.pow(rmm / 1000, 2); }

  /* ---------- lab 1: elasticity ---------- */
  (function () {
    var t = T.mount("elasticity"), L = window.__lab_elasticity, sim = t.sim;
    T.ok("elasticity mounts", !!L && !!sim);
    // easy: steel 2 m, r 0.5 mm, 10 kg -> FL/AY = 1.2478 mm
    L.apply({ mode: "single", matA: "steel", rA: 0.5, L: 2, m: 10 });
    var want = 98 * 2 / (area(0.5) * 2e11);
    T.check("easy: ΔL = FL/AY (mm)", L.ext() * 1000, want * 1000, 1e-6);
    T.ok("easy: readout shows 1.248 mm", /1\.248 mm/.test(T.text(".readouts")), T.text(".readouts").slice(0, 160));
    T.check("easy: stress F/A (Pa)", L.wires()[0].s, 98 / area(0.5), 1);
    T.check("easy: work done = ½FΔL (J)", L.work(), 0.5 * 98 * want, 1e-9);
    // another setting: copper 1.5 m, r 0.3 mm, 3 kg
    L.apply({ mode: "single", matA: "copper", rA: 0.3, L: 1.5, m: 3 });
    T.check("copper: ΔL = FL/AY (mm)", L.ext() * 1000, 3 * G * 1.5 / (area(0.3) * 1.1e11) * 1000, 1e-6);
    // medium: series steel 0.4 / 0.8 mm, 5 kg -> U_A : U_B = 4
    L.apply({ mode: "series", matA: "steel", matB: "steel", rA: 0.4, rB: 0.8, L: 1, m: 5 });
    var w = L.wires();
    T.check("medium: U_A / U_B = 4", w[0].W / w[1].W, 4, 1e-6);
    T.check("medium: series ΔL = ΔL_A + ΔL_B (mm)", L.ext() * 1000, (49 / (area(0.4) * 2e11) + 49 / (area(0.8) * 2e11)) * 1000, 1e-6);
    // hard: parallel steel + copper, 20 kg -> ΔL = 0.805 mm, a = 0.355 m
    L.apply({ mode: "parallel", matA: "steel", matB: "copper", rA: 0.5, rB: 0.5, L: 1, m: 20 });
    T.check("hard: parallel ΔL (mm)", L.ext() * 1000, 196 / (area(0.5) * 3.1e11) * 1000, 1e-6);
    T.check("hard: load position from steel (m)", L.loadPos(), 1.1 / 3.1, 1e-6);
    T.ok("hard: readouts show 0.805 mm", /0\.805 mm/.test(T.text(".readouts")));
    // ramp to breaking: breaks at sigma_b A
    L.apply({ mode: "single", matA: "steel", rA: 0.5, L: 2, m: 0 });
    T.click(/^Load it up/); sim.pause();
    for (var i = 0; i < 1500 && !L.st().broken; i++) sim.stepOnce();
    T.ok("ramp: the wire snaps", !!L.st().broken);
    T.check("ramp: breaking load = σ_b A (N)", L.st().broken && L.st().broken.F, 4e8 * area(0.5), 4e8 * area(0.5) * 0.004);
    // tries
    L.apply({ mode: "single", matA: "steel", rA: 0.5, L: 2, m: 0 });
    L.clickShelf(5); L.clickShelf(5);                              // 5 kg then 10 kg: hooke
    T.check("shelf clicks add 10 kg", L.st().m, 10, 1e-9);
    L.clickHanger();
    T.check("hanger click removes the top 5 kg", L.st().m, 5, 1e-9);
    L.setLoad(26); L.setLoad(0);                                  // past yield, then unload: set
    T.ok("permanent set after yield", L.wires()[0].e > 1e-5, L.wires()[0].e);
    L.apply({ mode: "single", matA: "steel", rA: 0.5, L: 2, m: 0 }); L.setLoad(40);
    var F1 = L.st().broken && L.st().broken.F;
    L.apply({ mode: "single", matA: "steel", rA: 0.5, L: 1, m: 0 }); L.setLoad(40);
    T.ok("breaks at both lengths", !!F1 && !!L.st().broken);
    L.apply({ mode: "series", matA: "steel", matB: "steel", rA: 0.4, rB: 0.8, L: 1, m: 0 }); L.setLoad(5);
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("elasticity: all 4 tries triggered", done === 4, done + " done");
    T.ok("elasticity: maths renders", /Pa|mm/.test(T.text(".eqs")));
  })();

  /* ---------- lab 2: fluids ---------- */
  (function () {
    var t = T.mount("fluids"), L = window.__lab_fluids, sim = t.sim;
    T.ok("fluids mounts", !!L && !!sim);
    function runUntil(cond, max) { for (var i = 0; i < (max || 3000) && !cond(); i++) sim.stepOnce(); }
    // easy: 0.8 m down the thin tube in water
    L.apply({ mode: "probe", rho: 1000, x: 460, h: 0.8 });
    T.check("easy: p = p0 + ρgh (Pa)", L.pressure(), 1.013e5 + 1000 * G * 0.8, 0.01);
    T.ok("easy: readout shows 109.14 kPa", /109\.14 kPa/.test(T.text(".readouts")), T.text(".readouts"));
    L.setLiquid("hg"); L.probeTo(200, 0.3);
    T.check("mercury 0.3 m: p (Pa)", L.pressure(), 1.013e5 + 13600 * G * 0.3, 0.01);
    L.setLiquid("water");
    L.probeTo(200, 0.5); L.probeTo(760, 0.5);                    // same depth, wide tank then funnel: shape
    T.check("funnel 0.5 m: same p as tank (Pa)", L.pressure(), 1.013e5 + 4900, 0.01);
    T.ok("probe can't enter a wall", L.probeTo(385, 0.5) === false);
    L.drag(760, L.PS + 0.5 * L.PPM, 460, L.PS + 1.0 * L.PPM);    // real pointer drag into the tube
    T.check("drag: probe in the tube at 1.0 m (Pa)", L.pressure(), 1.013e5 + 9800, 0.01);
    T.click(/^Lower the probe/); runUntil(function () { return !sim.running; }, 1000);
    T.check("lowered to the channel bottom: p = p0 + ρgh", L.pressure(), 1.013e5 + 1000 * G * (486 - 150) / 250, 0.01);
    // float: wood in water, then glycerine
    L.apply({ mode: "float", rho: 1000, rhoB: 600 });
    T.click(/^Cut the string/); sim.pause(); runUntil(function () { return L.blk().settled; }, 4000);
    T.check("wood in water: fraction under = 0.600", L.blk().z / 0.2, 0.6, 1e-4);
    L.setLiquid("glyc");
    T.click(/^Cut the string/); sim.pause(); runUntil(function () { return L.blk().settled; }, 4000);
    T.check("wood in glycerine: fraction = 600/1260", L.blk().z / 0.2, 600 / 1260, 1e-4);
    L.apply({ mode: "float", rho: 13600, rhoB: 7870 });
    T.click(/^Cut the string/); sim.pause(); runUntil(function () { return L.blk().settled; }, 4000);
    T.check("iron on mercury: fraction = 7870/13600", L.blk().z / 0.2, 7870 / 13600, 1e-4);
    L.apply({ mode: "float", rho: 1000, rhoB: 2700 });
    T.click(/^Cut the string/); sim.pause(); runUntil(function () { return L.blk().settled; }, 4000);
    T.check("aluminium sinks: N = W − B (N)", L.blk().N, 2700 * 0.008 * G - 1000 * 0.008 * G, 0.01);
    // hard: aluminium fully under oil, then water, on the balance
    L.apply({ mode: "float", rho: 800, rhoB: 2700, z: 0.5 });
    T.check("hard: balance in oil (N)", L.blk().T, 211.68 - 62.72, 0.01);
    T.ok("hard: readout shows 149.0 N", /149\.0 N/.test(T.text(".readouts")));
    L.setLiquid("water"); L.holdAt(0.5);
    T.check("hard: balance in water (N)", L.blk().T, 211.68 - 78.4, 0.01);
    // half under on the balance, by dragging the block with the pointer
    L.holdAt(-0.15); var top = L.blockTop();
    L.drag(450, top + 20, 450, top + 20 + (0.25 + 0.1) * L.PPM);    // down 0.35 m: from z = -0.15 to 0.20
    T.check("drag: block bottom at 0.20 m", L.blk().z, 0.2, 0.005);
    // medium: hydraulic lift
    L.apply({ mode: "lift", r1: 2, r2: 20, M: 1500 });
    T.check("medium: F1 = Mg (r/R)^2 (N)", L.F1(), 147, 1e-6);
    L.drag(220, 140 - 54, 220, 140 - 54 + 50);                    // drag the handle down 0.2 m
    T.check("drag handle: d1 = 0.2 m", L.lift().d1, 0.2, 1e-6);
    T.click(/^Push/); sim.pause(); runUntil(function () { return L.lift().d1 >= 1; }, 600);
    T.check("medium: 1 m push raises the car 1 cm", L.lift().d2 * 100, 1, 1e-6);
    T.check("medium: work in = Mg d2 = 147 J", L.lift().Win, 147, 1e-6);
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("fluids: all 4 tries triggered", done === 4, done + " done");
    T.ok("fluids: maths renders", /\text|J|N/.test(T.text(".eqs")) || T.text(".eqs").length > 40);
  })();

  /* ---------- lab 3: viscosity ---------- */
  (function () {
    var t = T.mount("viscosity"), L = window.__lab_viscosity, sim = t.sim;
    T.ok("viscosity mounts", !!L && !!sim);
    function runUntil(cond, max) { for (var i = 0; i < (max || 3000) && !cond(); i++) sim.stepOnce(); }
    function vt(r, rho, sig, eta) { return 2 * r * r * (rho - sig) * G / (9 * eta); }
    // medium: steel r = 2 mm in glycerine -> 3.80 cm/s
    L.apply({ mode: "ball", liq: "glyc", mat: "steel", r: 2, h0: 0 });
    T.click(/^Drop/); sim.pause(); runUntil(function () { return L.ball().done; }, 3000);
    var want = vt(0.002, 7800, 1260, 1.5);
    T.check("medium: v_t timed between marks (m/s)", L.vFromMarks(), want, 1e-6);
    T.check("medium: v at the bottom = v_t (m/s)", L.ball().v, want, 1e-6);
    T.ok("medium: readout shows 3.80 cm/s", /3\.80 cm\/s/.test(T.text(".readouts")));
    // the RK4 approach to v_t matches v_t(1 - e^{-t/τ}) over the first 6τ
    var fine = L.ball().fine, tau = L.bp().tau, err = 0;
    fine.forEach(function (q) { err = Math.max(err, Math.abs(q[1] / 100 - want * (1 - Math.exp(-q[0] / 1000 / tau)))); });
    T.ok("medium: early v(t) matches the exponential (max error < 1e-6 m/s)", fine.length > 50 && err < 1e-6, fine.length + " pts, err " + err);
    // rsq: castor oil, steel, r = 1.5 and 3 mm
    L.apply({ mode: "ball", liq: "castor", mat: "steel", r: 1.5, h0: 0 });
    T.click(/^Drop/); sim.pause(); runUntil(function () { return L.ball().done; }, 6000);
    var v1 = L.vFromMarks();
    T.check("castor r = 1.5 mm: v_t (m/s)", v1, vt(0.0015, 7800, 960, 0.98), 1e-6);
    // above: r = 3 mm dropped from 0.3 m
    L.apply({ mode: "ball", liq: "castor", mat: "steel", r: 3, h0: 0.3 });
    T.click(/^Drop/); sim.pause(); runUntil(function () { return L.ball().done; }, 6000);
    T.check("drop from 0.3 m: entry speed √(2gh) (m/s)", L.ball().u, Math.sqrt(2 * G * 0.3), 1e-6);
    T.check("castor r = 3 mm: v_t from above (m/s)", L.vFromMarks(), vt(0.003, 7800, 960, 0.98), 1e-6);
    T.check("r doubled: v_t ratio = 4", L.vFromMarks() / v1, 4, 1e-4);
    // a plastic ball rises through glycerine at v_t < 0
    L.apply({ mode: "ball", liq: "glyc", mat: "plastic", r: 3, h0: 0 });
    T.click(/^Drop/); sim.pause(); T.steps(sim, 120);
    T.check("plastic in glycerine rises at v_t (m/s)", L.ball().v, vt(0.003, 900, 1260, 1.5), 1e-7);
    // capillary easy: water r = 0.5 mm -> 29.39 mm
    L.apply({ mode: "cap", liq: "water", r: 0.5, ell: 100 });
    T.click(/^Dip the tube/); sim.pause(); runUntil(function () { return L.cap().settled; }, 2000);
    T.check("easy: h = 2T cosθ / rρg (mm)", L.cap().h * 1000, 2 * 0.072 / (0.0005 * 1000 * G) * 1000, 1e-6);
    T.ok("easy: readout shows 29.39 mm", /29\.39 mm/.test(T.text(".readouts")));
    L.apply({ mode: "cap", liq: "ethanol", r: 0.25, ell: 100 });
    T.click(/^Dip the tube/); sim.pause(); runUntil(function () { return L.cap().settled; }, 2000);
    T.check("ethanol r = 0.25 mm: h (mm)", L.cap().h * 1000, 2 * 0.022 / (0.00025 * 789 * G) * 1000, 1e-6);
    // mercury: depression
    L.apply({ mode: "cap", liq: "hg", r: 0.5, ell: 100 });
    T.click(/^Dip the tube/); sim.pause(); runUntil(function () { return L.cap().settled; }, 2000);
    T.check("mercury: h < 0 (mm)", L.cap().h * 1000, 2 * 0.465 * Math.cos(140 * Math.PI / 180) / (0.0005 * 13600 * G) * 1000, 1e-6);
    // hard: tube only 20 mm -> stops at 20 mm, R = 0.73 mm
    L.apply({ mode: "cap", liq: "water", r: 0.5, ell: 20 });
    T.click(/^Dip the tube/); sim.pause(); runUntil(function () { return L.cap().settled; }, 2000);
    T.check("hard: column stops at the top (mm)", L.cap().h * 1000, 20, 1e-9);
    T.ok("hard: readout shows R = 0.73 mm", /0\.73 mm/.test(T.text(".readouts")), T.text(".readouts"));
    L.dragTubeTo(50);
    T.check("drag the tube to ℓ = 50 mm", L.cap().ell * 1000, 50, 1e-9);
    runUntil(function () { return L.cap().settled; }, 2000);
    T.check("after lengthening, it climbs to 29.39 mm", L.cap().h * 1000, 2 * 0.072 / (0.0005 * 1000 * G) * 1000, 1e-6);
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("viscosity: all 4 tries triggered", done === 4, done + " done");
  })();

  /* ---------- concept map ---------- */
  (function () {
    var mine = Object.keys(Maps.NODES).filter(function (id) { return /^matter_/.test(id); });
    T.ok("map: 15 matter ideas", mine.length === 15, mine.length);
    var bad = Maps.EDGES.filter(function (e) { return (/^matter_/.test(e[0]) || /^matter_/.test(e[1])) && (!Maps.NODES[e[0]] || !Maps.NODES[e[1]]); });
    T.ok("map: every edge joins existing ideas", bad.length === 0, JSON.stringify(bad));
    ["elasticity", "fluids", "viscosity"].forEach(function (id) {
      var ids = Maps.LAB_NODES[id] || [];
      T.ok("map: " + id + " has 6–8 ideas that exist", ids.length >= 6 && ids.length <= 8 && ids.every(function (n) { return Maps.NODES[n]; }), ids.join(","));
      var t = T.mount(id);
      T.ok("map: " + id + " page shows its concept map", !!t.root.querySelector(".cmap-slot svg"));
    });
  })();
});
