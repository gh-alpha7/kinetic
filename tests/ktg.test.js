// Kinetic theory: the gas box (pressure from wall hits vs NkT/A) and the speed distribution (vs 2D Maxwell–Boltzmann).
T.run(function () {
  var KB = 1.380649e-23, AMU = 1.66053907e-27;
  ["gasbox", "speeds"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) { /* ignore */ } });
  function rb(i) { return T.text(".readouts .readout:nth-child(" + (i + 1) + ") b"); }
  function tried(labId, tryId) { try { return !!JSON.parse(localStorage.getItem("kinetic:tries:" + labId) || "{}")[tryId]; } catch (e) { return false; } }

  /* ================= gas box ================= */
  var t = T.mount("gasbox"), L = window.__lab_gasbox, sim = t.sim;
  T.ok("gasbox mounts with readouts, maths and 3 practice questions", rb(0) && T.text(".eqs").length > 50 && t.root.querySelectorAll(".qcard").length === 3);
  T.ok("gasbox concept map rendered", t.root.querySelector(".cmap-slot").innerHTML.length > 50);
  L.setTurbo(true);
  function settle(steps) { T.steps(sim, steps); return L.result(); }
  // 1. pressure from collisions vs kinetic theory, three settings
  var cases = [{ n: 60, T: 300, w: 20, gas: 28 }, { n: 60, T: 300, w: 10, gas: 28 }, { n: 100, T: 900, w: 15, gas: 4 }];
  var res = cases.map(function (c) {
    L.apply({ walls: "bath", piston: "held", n: c.n, T: c.T, w: c.w, gas: c.gas });
    var r = settle(400);
    T.check("P measured vs size-corrected NkT/A (N=" + c.n + ", T=" + c.T + ", w=" + c.w + "), within 3σ", r.P * 1e3, r.Pz * 1e3, 3 * r.err * 1e3);
    T.check("ideal NkT/A formula (N=" + c.n + ", T=" + c.T + ", w=" + c.w + ")", r.Pi, c.n * KB * c.T / (c.w * 20 * 1e-18), 1e-12);
    T.ok("statistical error below 2% after averaging (" + c.w + " nm)", r.err / r.P < 0.02, r.err / r.P);
    return r;
  });
  T.check("ideal PA/N = kT within 4% (molecule size adds about 2η)", res[0].P * res[0].A * 1e-18 / 60 / (KB * 300), 1, 0.04);
  // 2. practice easy: halve the area at fixed T, P doubles
  T.check("practice easy: P(200 nm²)/P(400 nm²) ≈ 2 → 'It doubles'", res[1].P / res[0].P, 2, 0.1);
  T.check("Boyle: PA the same at 400 and 200 nm² (within 4%)", res[1].P * res[1].A / (res[0].P * res[0].A), 1, 0.04);
  // 3. energy is conserved exactly with insulated walls and a still piston
  L.apply({ walls: "ins", piston: "held", n: 60, T: 300, w: 20 });
  var E0 = L.gas().ke(); T.steps(sim, 300);
  T.check("insulated box: total KE conserved (relative)", L.gas().ke() / E0, 1, 1e-9);
  // 4. practice medium: 300 K → 1200 K at fixed volume
  L.apply({ walls: "bath", piston: "held", n: 60, T: 300, w: 20 });
  var a = settle(300), v1 = Math.sqrt(2 * L.gas().ke() / (60 * L.gas().m));
  L.heat(1200); var b = settle(300), v2 = Math.sqrt(2 * L.gas().ke() / (60 * L.gas().m));
  T.check("practice medium: v_rms × 2", v2 / v1, 2, 1e-6);
  T.check("practice medium: P × 4 (within 2σ)", b.P / a.P, 4, 2 * 4 * Math.hypot(a.err / a.P, b.err / b.P));
  T.check("v_rms (2D) = √(2kT/m) at 1200 K", v2, Math.sqrt(2 * KB * 1200 / (28 * AMU)), 1e-3);
  // 5. gas doesn't matter: He vs Ar at the same N, T, A
  L.apply({ walls: "bath", piston: "held", n: 60, T: 300, w: 20, gas: 4 });
  var he = settle(400);
  L.setGas(40); var ar = settle(400);
  T.check("He and Ar give the same P (within 3σ)", he.P * 1e3, ar.P * 1e3, 3 * 1e3 * Math.hypot(he.err, ar.err));
  T.ok("try 'heavy' triggered by switching gas", tried("gasbox", "heavy"));
  // 6. try 'boyle': settled at 20 nm, then 10 nm
  L.apply({ walls: "bath", piston: "held", n: 60, T: 300, w: 20 });
  settle(300); L.wS.set(10); L.changed(); settle(500);
  T.ok("try 'boyle' triggered", tried("gasbox", "boyle"));
  // 7. practice hard: insulated compression 400 → 200 nm² (2D: γ = 2, TA constant)
  var Ts = [];
  for (var k = 0; k < 3; k++) {
    L.apply({ walls: "ins", piston: "held", n: 60, T: 300, w: 20 });
    T.steps(sim, 10); L.wS.set(10); L.changed(); T.steps(sim, 260);
    Ts.push(L.gas().T());
    T.check("hard: piston reached 10 nm (run " + (k + 1) + ")", L.gas().w, 10, 1e-9);
  }
  var Tavg = (Ts[0] + Ts[1] + Ts[2]) / 3, Tz = L.adi().Tz;
  T.check("practice hard: adiabatic T vs size-corrected TA = const prediction (3-run mean, 2%)", Tavg, Tz, 0.02 * Tz);
  T.check("practice hard: within 4% of the ideal 2D answer 600 K", Tavg, 600, 24);
  T.ok("practice hard: 600 K is the nearest option", [300, 396, 476, 600].reduce(function (p, c) { return Math.abs(c - Tavg) < Math.abs(p - Tavg) ? c : p; }) === 600, Ts.join(", "));
  T.ok("try 'squeeze' triggered", tried("gasbox", "squeeze"));
  // 8. free piston: Charles's law
  L.apply({ walls: "bath", piston: "free", n: 60, T: 300, Pext: 1.5 });
  var f1 = settle(600);
  T.check("free piston: mean area vs NkT·Z/P_ext at 300 K (2%)", f1.A, L.predictA(300), 0.02 * L.predictA(300));
  T.check("free piston: gas pressure = P_ext (2%)", f1.P * 1e3, 1.5, 0.03);
  L.heat(600); var f2 = settle(600);
  T.check("free piston: mean area at 600 K (2%)", f2.A, L.predictA(600), 0.02 * L.predictA(600));
  T.check("Charles: A(600 K)/A(300 K) vs predicted (2% ideal, ×Z ratio for disc size)", f2.A / f1.A, L.predictA(600) / L.predictA(300), 0.03);
  T.check("Charles: ideal A ∝ T within 5% (disc size makes it a little under 2)", f2.A / f1.A, 2, 0.1);
  T.ok("try 'charles' triggered", tried("gasbox", "charles"));
  T.ok("gasbox: Play button exists", !!T.click(/Play|Pause/));

  /* ================= speed distribution ================= */
  t = T.mount("speeds"); var S = window.__lab_speeds; sim = t.sim;
  T.ok("speeds mounts with readouts, maths and 3 practice questions", rb(0) && T.text(".eqs").length > 50 && t.root.querySelectorAll(".qcard").length === 3);
  S.setTurbo(true);
  function sstats(steps) { T.steps(sim, steps); return S.stats(); }
  function form(m, Tk) { var kt = KB * Tk / m; return { mp: Math.sqrt(kt), avg: Math.sqrt(Math.PI * kt / 2), rms: Math.sqrt(2 * kt) }; }
  // 1. one speed → Maxwell–Boltzmann (2D), two gases / temperatures
  [{ gas: 28, T: 300 }, { gas: 4, T: 900 }].forEach(function (c) {
    S.apply({ gas: c.gas, T: c.T, start: "one" });
    var s = sstats(420)[0], f = form(c.gas * AMU, c.T);
    T.check("2D v_rms = √(2kT/m) exactly (" + c.gas + " g/mol, " + c.T + " K)", s.rms, f.rms, 1e-6 * f.rms);
    T.check("2D v_avg = √(πkT/2m) within 1.5% (" + c.gas + ", " + c.T + " K)", s.avg, f.avg, 0.015 * f.avg);
    T.check("v_avg/v_rms → √π/2 = 0.886 (" + c.gas + ", " + c.T + " K)", s.avg / s.rms, Math.sqrt(Math.PI) / 2, 0.012);
    T.check("v_mp from a fit to the histogram within 5% (" + c.gas + ", " + c.T + " K)", s.mp, f.mp, 0.05 * f.mp);
    var bw = S.vScale() / s.dens.length, tv = 0;
    s.dens.forEach(function (d, i) { tv += Math.abs(d - S.mb2((i + 0.5) * bw, c.gas * AMU, c.T)) * bw; });
    T.ok("histogram matches 2D Maxwell–Boltzmann: total variation < 0.08 (" + c.gas + ")", tv / 2 < 0.08, tv / 2);
  });
  T.ok("try 'spread' triggered", tried("speeds", "spread"));
  // 2. the 3D textbook density integrates to 1
  var tot = 0; for (var v = 0; v < 3000; v += 1) tot += S.mb3(v + 0.5, 28 * AMU, 300);
  T.check("3D MB density integrates to 1", tot, 1, 1e-3);
  // 3. equipartition from a sideways start
  S.apply({ gas: 28, T: 300, start: "side" });
  var sd = sstats(420)[0];
  T.check("equipartition: ⟨KE_y⟩/kT → 0.5 from a sideways start", sd.ky, 0.5, 0.03);
  T.ok("try 'sideways' triggered", tried("speeds", "sideways"));
  // 4. practice easy: H₂ vs O₂ at 300 K
  S.apply({ gas: 2, T: 300, start: "mb" });
  var h2 = sstats(260)[0], v3h = parseFloat(rb(4));
  S.setGas(32); var o2 = sstats(260)[0], v3o = parseFloat(rb(4));
  T.check("practice easy: 3D v_rms H₂ = 1934 m/s (readout)", v3h, Math.sqrt(3 * 8.314 * 300 / 0.002), 1);
  T.check("practice easy: v_rms(H₂)/v_rms(O₂) = 4 (readouts)", v3h / v3o, 4, 0.01);
  T.check("practice easy: measured box ratio = 4 too", h2.rms / o2.rms, 4, 1e-6);
  // 5. practice medium + try 'hotter': N₂ 300 K → 1200 K
  S.apply({ gas: 28, T: 300, start: "mb" });
  var c300 = sstats(260)[0], r300 = parseFloat(rb(4));
  S.tS.set(1200); S.tS.input.dispatchEvent(new Event("input"));
  var c1200 = sstats(260)[0], r1200 = parseFloat(rb(4));
  T.check("practice medium: 3D v_rms of N₂ at 300 K = 517 m/s", r300, 517, 1);
  T.check("practice medium: doubles at 1200 K (927 °C)", r1200 / r300, 2, 0.005);
  T.check("box: v_rms × 2 at 4× T", c1200.rms / c300.rms, 2, 1e-6);
  T.ok("try 'hotter' triggered", tried("speeds", "hotter"));
  // 6. practice hard + try 'mix': He + Ar at 400 K
  S.apply({ gas: "mix", T: 400, start: "one" });
  var mx = sstats(700), ka = mx[0].kx + mx[0].ky, kb = mx[1].kx + mx[1].ky;
  T.check("mixture: mean KE of He = mean KE of Ar (within 6%)", ka / kb, 1, 0.06);
  T.check("practice hard: He carries 50% of the KE (±3%)", ka / (ka + kb), 0.5, 0.03);
  T.check("practice hard: 3D v_rms of He at 400 K = 1579 m/s (readout)", parseFloat(rb(4)), 1579, 1);
  T.check("mixture: v_rms(He)/v_rms(Ar) in the box → √10 (within 4%)", mx[0].rms / mx[1].rms, Math.sqrt(10), 0.04 * Math.sqrt(10));
  T.ok("try 'mix' triggered", tried("speeds", "mix"));
  T.ok("speeds: Play button exists", !!T.click(/Play|Pause/));
});
