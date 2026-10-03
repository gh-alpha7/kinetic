// Ray optics: traced rays against Snell's law, the lens / mirror formulas and the prism formulas.
T.run(function () {
  var DEG = Math.PI / 180, t, L, c;
  function triesDone() { return document.querySelectorAll(".try.done").length; }
  function fresh(id) { try { localStorage.clear(); } catch (e) { /* private mode */ } return T.mount(id); }

  /* ---------- refraction ---------- */
  t = fresh("refraction"); L = window.__lab_refraction;
  T.ok("refraction: mounts with hook", !!L && !!t.sim);
  T.ok("refraction: readouts render", (T.text(".readouts") || "").length > 20);
  T.ok("refraction: 3 graphs, 4 eqs, 3 questions", document.querySelectorAll(".graphs canvas").length === 3 &&
    document.querySelectorAll(".eq").length === 4 && document.querySelectorAll(".qcard").length === 3);
  L.apply({ mode: "snell", n1: 1, n2: 1.5, th1: 30 });
  T.check("Snell air→glass 30°: θ2", L.current().th2, Math.asin(Math.sin(30 * DEG) / 1.5) / DEG, 0.005);
  T.check("reflection angle = incidence", L.current().thr, 30, 1e-6);
  L.apply({ mode: "snell", n1: 1.33, n2: 1, th1: 20 });
  T.check("Snell water→air 20°: θ2", L.current().th2, Math.asin(1.33 * Math.sin(20 * DEG)) / DEG, 0.005);
  L.apply({ mode: "snell", n1: 1.5, n2: 1, th1: 41.5 });
  c = L.current();
  T.check("practice easy: critical angle glass→air", c.crit, 41.81, 0.01);
  T.ok("41.5° still refracts", !!c.t && c.th2 > 80, c.th2);
  T.ok("readout shows θc 41.81°", /41\.81°/.test(T.text(".readouts")), T.text(".readouts"));
  L.apply({ mode: "snell", n1: 1.5, n2: 1, th1: 50 });
  T.ok("50° in glass: total internal reflection", L.current().t === null && L.current().R === 1);
  L.apply({ mode: "depth", n1: 1, n2: 4 / 3, d: 12, beta: 0 });
  c = L.current();
  T.check("practice medium: apparent depth 12 cm water", c.dApp, 9, 0.005);
  T.ok("readout: raised by 3.00 cm", /3\.00 cm/.test(T.text(".readouts")), T.text(".readouts"));
  L.apply({ mode: "depth", n1: 1, n2: 1.5, d: 10, beta: 50 });
  c = L.current();
  var al = Math.asin(Math.sin(50 * DEG) / 1.5);
  T.check("oblique apparent depth = d cos³β / (n cos³α)", c.dApp, 10 * Math.pow(Math.cos(50 * DEG), 3) / (1.5 * Math.pow(Math.cos(al), 3)), 0.01);
  L.apply({ mode: "slab", n1: 1, n2: Math.sqrt(3), th1: 60, t: 6 });
  c = L.current();
  T.check("practice hard: lateral shift", c.shift, 2 * Math.sqrt(3), 0.005);
  T.check("slab: emerges parallel (e = θ1)", c.e, 60, 1e-6);
  T.check("slab: path inside = t/cosθ2", c.L, 6 / Math.cos(30 * DEG), 0.005);
  T.ok("readout: shift 3.46 cm", /3\.46 cm/.test(T.text(".readouts")), T.text(".readouts"));
  L.apply({ mode: "slab", n1: 1, n2: 1.5, th1: 45, t: 10 });
  var s2 = Math.asin(Math.sin(45 * DEG) / 1.5);
  T.check("slab n=1.5, 45°, 10 cm", L.current().shift, 10 * Math.sin(45 * DEG - s2) / Math.cos(s2), 0.005);
  // tries
  L.apply({ mode: "snell", n1: 1.5, n2: 1, th1: 41.5 });
  L.apply({ mode: "snell", n1: 1.5, n2: 1, th1: 55 });
  L.apply({ mode: "depth", n1: 1, n2: 4 / 3, d: 12, beta: 50 });
  L.apply({ mode: "slab", n1: 1, n2: 1.5, th1: 40, t: 4 });
  L.apply({ mode: "slab", n1: 1, n2: 1.5, th1: 40, t: 8 });
  T.check("refraction: all 4 tries triggered", triesDone(), 4, 0);
  // the sweep traces the θ2–θ1 curve
  L.apply({ mode: "snell", n1: 1, n2: 1.5, th1: 10 });
  T.click(/^Sweep/); t.sim.pause(); T.steps(t.sim, 400);
  var sw = L.sweep();
  T.ok("sweep runs to 89.5°", sw && sw.done && L.S.th1 >= 89.5, L.S.th1);
  var mid = sw.pts1[Math.floor(sw.pts1.length / 2)];
  T.check("swept point obeys Snell", mid[1], Math.asin(Math.sin(mid[0] * DEG) / 1.5) / DEG, 0.01);

  /* ---------- lenses ---------- */
  t = fresh("lenses"); L = window.__lab_lenses;
  T.ok("lenses: mounts with hook", !!L && !!t.sim);
  L.apply({ kind: "convex", f: 20, u: -30, h: 4 });
  c = L.trace();
  T.check("practice easy: v (convex f=20, u=-30)", c.v, 60, 0.01);
  T.check("practice easy: m", c.m, -2, 0.001);
  T.ok("readout v = +60.00 cm", /\+60\.00 cm/.test(T.text(".readouts")), T.text(".readouts"));
  L.apply({ kind: "cmirror", f: 10, u: -5, h: 3 });
  c = L.trace();
  T.check("practice medium: v (concave mirror R=20, u=-5)", c.v, 10, 0.01);
  T.check("practice medium: m", c.m, 2, 0.001);
  T.ok("practice medium: virtual", !c.real);
  L.apply({ kind: "convex", maker: true, R1: 20, R2: -20, n: 1.5, contact: true, P2: -2.5, u: -60, h: 3, f: 20 });
  c = L.trace();
  T.check("hard: lens maker f1", L.f1(), 20, 1e-6);
  T.check("hard: combined F", L.F(), 40, 1e-6);
  T.check("practice hard: v", c.v, 120, 0.01);
  T.check("practice hard: m", c.m, -2, 0.001);
  L.apply({ kind: "vmirror", f: 15, u: -30, h: 5 });
  c = L.trace();
  T.check("convex mirror f=15, u=-30: v", c.v, 10, 0.01);
  T.check("convex mirror m = -v/u", c.m, 1 / 3, 0.001);
  L.apply({ kind: "concave", f: 20, u: -20, h: 5 });
  c = L.trace();
  T.check("concave lens f=20, u=-20: v", c.v, -10, 0.01);
  T.check("concave lens m = v/u", c.m, 0.5, 0.001);
  L.apply({ kind: "cmirror", f: 15, u: -45, h: 4 });
  T.check("concave mirror u=-45, f=-15: v", L.trace().v, 1 / (-1 / 15 + 1 / 45), 0.01);
  // tries
  t = fresh("lenses"); L = window.__lab_lenses;
  L.apply({ kind: "convex", f: 20, u: -40, h: 4 });
  L.apply({ kind: "cmirror", f: 10, u: -5, h: 3 });
  L.apply({ kind: "convex", maker: true, R1: 20, R2: -20, n: 1.5, u: -30, h: 3 });
  L.apply({ kind: "vmirror", f: 15, u: -30, h: 4 });
  T.click(/^Walk in/); t.sim.pause(); T.steps(t.sim, 600);
  T.ok("walk-in finishes", L.sweep() && L.sweep().done);
  T.check("lenses: all 4 tries triggered", triesDone(), 4, 0);
  L.apply({ kind: "convex", f: 20, u: -30, h: 4 });
  T.click(/^Walk in/); t.sim.pause(); T.steps(t.sim, 600);
  var seg0 = L.sweep().v[0], p = seg0[Math.floor(seg0.length / 2)];
  T.check("walk-in point obeys lens formula", p[1], 1 / (1 / 20 - 1 / p[0]), 0.01);

  /* ---------- prism ---------- */
  t = fresh("prism"); L = window.__lab_prism;
  T.ok("prism: mounts with hook", !!L && !!t.sim);
  L.apply({ A: 5, n: 1.5, i: 3.75 });
  T.check("practice easy: thin prism δ", L.current().main.delta, 2.5, 0.005);
  L.apply({ A: 60, n: Math.SQRT2, i: 45 });
  c = L.current().main;
  T.check("practice medium: δ at i = 45°", c.delta, 30, 0.005);
  T.check("practice medium: δm formula", L.minDev(60, Math.SQRT2).delta, 30, 0.005);
  T.check("practice medium: traced minimum", L.tracedMin(60, Math.SQRT2).delta, 30, 0.005);
  T.ok("readout n from δm = 1.414", /1\.414/.test(T.text(".readouts")), T.text(".readouts"));
  T.check("symmetric passage: r1 = A/2", c.r1, 30, 0.005);
  L.apply({ A: 60, n: 1.5, i: 28 });
  T.ok("practice hard: emerges at i = 28°", !L.current().main.tir, L.current().main.e);
  L.apply({ A: 60, n: 1.5, i: 27.8 });
  T.ok("practice hard: trapped at i = 27.8°", L.current().main.tir);
  T.check("practice hard: limiting i", Math.asin(1.5 * Math.sin(60 * DEG - Math.asin(1 / 1.5))) / DEG, 27.92, 0.01);
  L.apply({ A: 60, n: 1.5, i: 50 });
  c = L.current().main;
  var f = L.formula(60, 1.5, 50);
  T.check("δ = i + e − A (A=60, n=1.5, i=50)", c.delta, f.delta, 0.005);
  T.check("e matches formula", c.e, f.e, 0.005);
  T.check("traced δm, A=60 n=1.5", L.tracedMin(60, 1.5).delta, 2 * Math.asin(0.75) / DEG - 60, 0.005);
  L.apply({ A: 5, n: 1.5, i: 10 });
  T.check("thin prism at i = 10°: δ ≈ (n−1)A", L.current().main.delta, 2.5, 0.05);
  L.apply({ A: 60, n: 1.5, i: 50, white: true });
  var cols = L.current().cols;
  T.ok("white: violet deviates more than red", cols[6].delta > cols[0].delta + 0.5, cols[6].delta - cols[0].delta);
  T.check("Cauchy n(589) = n", L.nOf(589), 1.5, 1e-9);
  // tries
  T.click(/minimum deviation/);
  L.apply({ A: 60, n: 1.5, i: 20 });
  L.apply({ A: 5, n: 1.5, i: 5 });
  T.check("prism: all 4 tries triggered", triesDone(), 4, 0);
  L.apply({ A: 60, n: 1.5, i: 40 });
  T.click(/^Sweep/); t.sim.pause(); T.steps(t.sim, 400);
  var sp = L.sweep();
  T.ok("prism sweep done", sp && sp.done);
  var low = sp.d.reduce(function (a, q) { return q[1] < a[1] ? q : a; }, [0, 1e9]);
  T.check("swept minimum ≈ δm", low[1], 2 * Math.asin(0.75) / DEG - 60, 0.02);
});
