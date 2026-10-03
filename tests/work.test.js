// Work, energy & power: numeric checks for workenergy, energy and collisions.
T.run(function () {
  var G = 9.8;
  ["workenergy", "energy", "collisions"].forEach(function (id) { localStorage.removeItem("kinetic:tries:" + id); });
  T.ok("map: work ideas registered", !!(Maps.NODES.work_thm && Maps.NODES.work_loop && Maps.NODES.work_pcons) && Maps.LAB_NODES.collisions.length >= 6);
  var bad = Maps.EDGES.filter(function (e) { return !Maps.NODES[e[0]] || !Maps.NODES[e[1]]; });
  T.ok("map: every edge joins known ideas", bad.length === 0, JSON.stringify(bad));
  /* ---------- lab 1: work & the work-energy theorem ---------- */
  (function () {
    var t = T.mount("workenergy"), L = window.__lab_workenergy, sim = t.sim;
    T.ok("workenergy mounts", !!L && !!sim);
    function runUntil(cond, max) { for (var i = 0; i < (max || 3000) && !cond(); i++) sim.stepOnce(); }
    // easy: 20 N on 4 kg over 5 m, smooth: v = sqrt(2Fd/m) = 7.071
    L.apply({ mode: "const", m: 4, u: 0, mu: 0, F: 20, d: 5 });
    runUntil(function () { return L.st().x >= 5.5; });
    T.check("easy: speed after the push (m/s)", Math.abs(L.st().v), Math.sqrt(50), 0.005);
    T.check("easy: W_F = Fd (J)", L.WF(), 100, 0.001);
    T.check("easy: KE = W_F (J)", L.KE(), 100, 0.01);
    // medium: total slide s = Fd / (mu m g) = 12.245
    L.apply({ mode: "const", m: 5, u: 0, mu: 0.2, F: 30, d: 4 });
    runUntil(function () { return L.st().done; });
    T.check("medium: total distance (m)", L.st().dist, 120 / 9.8, 0.005);
    T.check("medium: W_F + W_f = 0 (J)", L.WF() + L.st().Wf, 0, 0.01);
    // hard: spring k=50, m=2, mu=0.2, x0=1: first turn at -(x0 - 2 mu m g / k) = -0.8432
    L.apply({ mode: "spring", m: 2, u: 0, mu: 0.2, k: 50, x0: 1 });
    runUntil(function () { return L.st().turns.length > 0; });
    T.check("hard: first turning point (m)", L.st().turns[0], -(1 - 2 * 0.2 * 2 * G / 50), 0.002);
    // smooth spring: v at x = 0 is |x0| sqrt(k/m)
    L.apply({ mode: "spring", m: 2, u: 0, mu: 0, k: 50, x0: 2 });
    runUntil(function () { return L.st().vAtZero !== null; });
    T.check("spring: v at natural length (m/s)", L.st().vAtZero, 2 * Math.sqrt(25), 0.02);
    // theorem with friction and a custom profile, plus starting speed
    L.apply({ mode: "custom", m: 3, u: 2, mu: 0.1, profile: "hump" });
    T.steps(sim, 120);
    var s = L.st();
    T.check("custom: KE = K0 + W_F + W_f (J)", L.KE(), s.KE0 + L.WF() + s.Wf, 0.005);
    // custom brake profile (negative work)
    L.apply({ mode: "custom", m: 2, u: 0, mu: 0, profile: "brake" });
    runUntil(function () { return L.st().x > 10.5 || L.st().done; });
    T.check("brake profile: W(0..10) = 30 J", L.WF(), 30, 0.001);
    T.check("brake profile: KE at end (J)", L.KE(), 30, 0.01);
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("workenergy: all 4 tries triggered", done === 4, done + " done");
    T.ok("workenergy: maths renders", /W_F|J/.test(T.text(".eqs")) && T.text(".readouts").length > 40);
  })();
  /* ---------- lab 2: energy conservation ---------- */
  (function () {
    var t = T.mount("energy"), L = window.__lab_energy, sim = t.sim;
    T.ok("energy mounts", !!L && !!sim);
    function runUntil(cond, max) { for (var i = 0; i < (max || 3000) && !cond(); i++) sim.stepOnce(); return i; }
    function total() { var e = L.energies(); return e.KE + e.PE + e.SP + e.Q; }
    // easy: v at the bottom = sqrt(2 g h)
    L.apply({ launch: "release", body: "block", h: 5, R: 1.5, h2: 2, m: 1, mu: 0 });
    var maxDrift = 0;
    runUntil(function () { var q = L.st(); maxDrift = Math.max(maxDrift, Math.abs(total() - q.E0)); return q.s > 4 && !q.fly && L.energies().PE < 1e-9; });
    T.check("easy: speed on the flat (m/s)", Math.abs(L.st().v), Math.sqrt(2 * G * 5), 0.005);
    runUntil(function () { var q = L.st(); maxDrift = Math.max(maxDrift, Math.abs(total() - q.E0)); return false; }, 600);
    T.check("easy: energy drift over 10 s (J)", maxDrift, 0, 0.01);
    T.ok("easy: looped (h = 3.33R)", L.st().looped, JSON.stringify(L.st().top));
    // medium: h = 2.5R: v_top = sqrt(gR), N_top = 0
    L.apply({ launch: "release", body: "block", h: 5, R: 2, h2: 2, m: 1, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.check("medium: v at top (m/s)", L.st().top && L.st().top.v, Math.sqrt(G * 2), 0.005);
    T.check("medium: N at top (N)", L.st().top && L.st().top.N, 0, 0.02);
    T.ok("medium: 5.0 m completes the loop", L.st().looped);
    L.apply({ launch: "release", body: "block", h: 4.9, R: 2, h2: 2, m: 1, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.ok("medium: 4.9 m falls off", L.st().fellInLoop);
    T.check("4.9 m: leaves at (2h + R)/3", L.st().left.y, (2 * 4.9 + 2) / 3, 0.01);
    // hard: spring, c = 0.31 makes it, c = 0.30 doesn't; c_min = sqrt(5 m g R / k)
    L.apply({ launch: "spring", body: "block", m: 0.5, k: 400, c: 0.31, R: 1.5, h2: 2, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.ok("hard: 0.31 m completes", L.st().looped);
    T.check("hard: v_top (m/s)", L.st().top.v, Math.sqrt(2 * (0.5 * 400 * 0.31 * 0.31 - 0.5 * G * 3) / 0.5), 0.005);
    L.apply({ launch: "spring", body: "block", m: 0.5, k: 400, c: 0.30, R: 1.5, h2: 2, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.ok("hard: 0.30 m falls off", L.st().fellInLoop);
    T.check("hard: c_min formula", Math.sqrt(5 * 0.5 * G * 1.5 / 400), 0.3031, 0.0005);
    // rolling ball: 2.6R fails, 2.75R makes it
    L.apply({ launch: "release", body: "ball", h: 5.2, R: 2, h2: 2, m: 1, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.ok("ball from 2.6R falls off", L.st().fellInLoop);
    L.apply({ launch: "release", body: "ball", h: 5.5, R: 2, h2: 2, m: 1, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    T.ok("ball from 2.75R loops", L.st().looped);
    T.check("ball: v_top = sqrt(10 g (h - 2R)/7)", L.st().top.v, Math.sqrt(10 * G * 1.5 / 7), 0.005);
    // friction: total conserved, all ends as heat
    L.apply({ launch: "release", body: "block", h: 4, R: 2, h2: 1, m: 2, mu: 0.1 });
    maxDrift = 0;
    runUntil(function () { var q = L.st(); maxDrift = Math.max(maxDrift, Math.abs(total() - q.E0)); return q.done; }, 3700);
    T.check("friction: total energy drift (J)", maxDrift, 0, 0.05);
    T.ok("friction: it stops", L.st().done && L.st().stuck, JSON.stringify({Q: L.st().Q, v: L.st().v, s: L.st().s, t: sim.time, still: L.st().stillFor}));
    // loop try: 2.55R
    L.apply({ launch: "release", body: "block", h: 5.1, R: 2, h2: 2, m: 1, mu: 0 });
    runUntil(function () { return L.st().looped || L.st().fellInLoop; });
    sim.stepOnce();
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("energy: all 4 tries triggered", done === 4, done + " done");
  })();
  /* ---------- lab 3: collisions ---------- */
  (function () {
    var t = T.mount("collisions"), L = window.__lab_collisions, sim = t.sim;
    T.ok("collisions mounts", !!L && !!sim);
    function runUntil(cond, max) { for (var i = 0; i < (max || 3000) && !cond(); i++) sim.stepOnce(); }
    function crash(s) { L.apply(s); runUntil(function () { return L.st().result || L.st().done; }); return L.st(); }
    // easy: stick, v = 2 m/s
    var s = crash({ mode: "1d", m1: 2, u1: 6, m2: 4, u2: 0, e: 0 });
    T.check("easy: common speed (m/s)", s.result.v1, 2, 0.001);
    T.check("easy: v2 = v1", s.result.v2, 2, 0.001);
    T.check("easy: KE lost = ½μu² (J)", L.formula1d({ m1: 2, u1: 6, m2: 4, u2: 0, e: 0 }).KE0 - s.result.KE, 0.5 * (8 / 6) * 36, 0.005);
    // medium: elastic 1 kg on 3 kg: v1 = -2, v2 = 2
    s = crash({ mode: "1d", m1: 1, u1: 4, m2: 3, u2: 0, e: 1 });
    T.check("medium: v1 after (m/s)", s.result.v1, -2, 0.001);
    T.check("medium: v2 after (m/s)", s.result.v2, 2, 0.001);
    // hard: e = 0.5, KE lost 16.2 J; impulse = mu (1+e) u_rel = 10.8 N s
    s = crash({ mode: "1d", m1: 2, u1: 5, m2: 3, u2: -1, e: 0.5 });
    T.check("hard: v1 (m/s)", s.result.v1, -0.4, 0.001);
    T.check("hard: v2 (m/s)", s.result.v2, 2.6, 0.001);
    T.check("hard: KE lost (J)", 26.5 - s.result.KE, 16.2, 0.005);
    T.check("hard: impulse = F–t area (N s)", s.result.J, 1.2 * 1.5 * 6, 0.005);
    var m = L.moms();
    T.check("hard: momentum after (kg m/s)", m.p1 + m.p2, 7, 1e-6);
    runUntil(function () { return L.st().done; });
    // equal masses elastic, target at rest: swap + stop
    s = crash({ mode: "1d", m1: 3, u1: 4, m2: 3, u2: 0, e: 1 });
    T.check("swap: v1 = u2", s.result.v1, 0, 0.001);
    T.check("swap: v2 = u1", s.result.v2, 4, 0.001);
    // 2D: equal masses elastic -> 90 degrees
    s = crash({ mode: "2d", m1: 1, u1: 4, m2: 1, e: 1, b: 0.5 });
    T.check("2D elastic equal masses: 90°", s.result.sep, 90, 0.01);
    var f2 = L.formula2d({ m1: 1, u1: 4, m2: 1, e: 1, b: 0.5 });
    T.check("2D: target speed = u cos φ (m/s)", Math.hypot(s.result.v2.x, s.result.v2.y), 4 * Math.cos(Math.asin(0.5)), 0.001);
    T.check("2D: matches formula v2y", s.result.v2.y, f2.v2.y, 0.001);
    m = L.moms();
    T.check("2D: p_x conserved", m.px, 4, 1e-9); T.check("2D: p_y conserved", m.py, 0, 1e-9);
    s = crash({ mode: "2d", m1: 1, u1: 4, m2: 1, e: 0.5, b: 0.5 });
    T.ok("2D: e = 0.5 splits by less than 90°", s.result.sep < 89, s.result.sep);
    var done = t.root.querySelectorAll(".try.done").length;
    T.ok("collisions: all 4 tries triggered", done === 4, done + " done");
    T.ok("collisions: maths renders", T.text(".eqs").length > 40 && T.text(".readouts").length > 40);
  })();
});
