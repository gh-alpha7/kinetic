/* Magnetism, lab 2: fields from currents. A long wire, a loop, a solenoid, two wires that pull on each
   other, and Ampère's law. Every field is summed from the Biot–Savart law, not looked up. */
(function () {
  "use strict";
  var MU0 = 4 * Math.PI * 1e-7, TAU = 2 * Math.PI;
  var ZW = 50;                 // m: half-length of the "long" straight wires
  var SOL_L = 20;              // cm: solenoid length
  var LAMBDA = 1e-3;           // kg/m: mass per length of the free wires
  var AMP_WIRES = [{ I: 3, x: -6, y: 1 }, { I: -3, x: -2, y: -2 }, { I: 5, x: 6, y: 1.5 }];

  var lab = {
    id: "biotsavart", chapter: "magnetism", title: "Fields from currents", short: "wires, loops, solenoids, Ampère",
    lede: "Every current wraps itself in a magnetic field. Switch one on and watch the compasses swing, then find out why two wires carrying current pull on each other.",
    tries: [
      { id: "half", title: "Double the distance, halve the field",
        text: "With the straight wire, read the field at one spot, then drag the probe twice as far from the wire.",
        why: "$B = \\mu_0 I/2\\pi r$ falls as $1/r$, not $1/r^2$: each bit of a long wire is a different distance away, and adding them all up softens the fall-off." },
      { id: "end", title: "Find the field at the end of a solenoid",
        text: "Drag the probe onto the axis at one end of the solenoid and compare it with the centre.",
        why: "Inside, the field comes from coils on both sides. At an end there are coils on one side only, so you get half: $B_{end} \\approx \\tfrac12\\mu_0 nI$." },
      { id: "wires", title: "Make two wires attract, then repel",
        text: "Switch on two wires with currents the same way, then again with them opposite.",
        why: "Each wire sits in the other's field and feels $F/L = I_2B_1 = \\mu_0I_1I_2/2\\pi d$. Same direction attracts, opposite repels: the reverse of charges." },
      { id: "zero", title: "Enclose wires but no net current",
        text: "Put the Ampère loop round the +3 A and −3 A wires only, then walk it.",
        why: "$\\oint \\vec B\\cdot d\\vec l = \\mu_0 I_{enc} = 0$, yet $B$ is not zero on the loop. Ampère's law fixes the total round the loop, not the field at each point." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the fields (SI inside, metres) ---------- */
  // complete elliptic integrals K(m), E(m) by the arithmetic–geometric mean
  function ellip(m) {
    m = Math.min(m, 1 - 1e-14);
    var a = 1, b = Math.sqrt(1 - m), c, sum = 0.5 * m, pw = 0.5;
    for (var i = 0; i < 40; i++) {
      var an = (a + b) / 2; c = (a - b) / 2; b = Math.sqrt(a * b); a = an; pw *= 2; sum += pw * c * c;
      if (Math.abs(c) < 1e-16) break;
    }
    var Kk = Math.PI / (2 * a);
    return [Kk, Kk * (1 - sum)];
  }
  // Biot–Savart integrated round a circular loop of radius a (axis along x, centre x0):
  // the exact closed form in elliptic integrals. Current is out of the screen at the top of the loop.
  function loopB(a, I, x0, x, y) {
    var z = x - x0, rho = Math.abs(y), q = (a + rho) * (a + rho) + z * z;
    var d2 = Math.max((a - rho) * (a - rho) + z * z, 1e-14), ke = ellip(4 * a * rho / q);
    var c = MU0 * I / (TAU * Math.sqrt(q));
    var bz = c * (ke[0] + (a * a - rho * rho - z * z) / d2 * ke[1]);
    var br = rho < 1e-12 ? 0 : c / rho * z * (-ke[0] + (a * a + rho * rho + z * z) / d2 * ke[1]);
    return [bz, y < 0 ? -br : br];
  }
  // Biot–Savart integrated along a straight wire from z = −ZW to +ZW, perpendicular to the screen at (wx, wy).
  // I > 0 is out of the screen (anticlockwise field lines).
  function wireB(I, wx, wy, x, y) {
    var dx = x - wx, dy = y - wy, d = Math.hypot(dx, dy);
    if (d < 1e-9) return [0, 0];
    var B = MU0 * I / (2 * TAU * d) * (2 * ZW / Math.sqrt(ZW * ZW + d * d));
    return [-B * dy / d, B * dx / d];
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: 0 }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "wire", dir = 1, same = true;
    var IS = K.slider({ label: "Current $I$", unit: "A", min: 1, max: 20, step: 1, value: 10, onInput: reset });
    var I2S = K.slider({ label: "Current $I_2$ (right wire)", unit: "A", min: 1, max: 20, step: 1, value: 5, onInput: reset });
    var dS = K.slider({ label: "Separation $d$", unit: "cm", min: 2, max: 20, step: 0.5, value: 6, onInput: reset, hint: "Or drag the right-hand wire." });
    var RS = K.slider({ label: "Loop radius $R$", unit: "cm", min: 2, max: 10, step: 0.5, value: 5, onInput: reset });
    var NS = K.slider({ label: "Turns $N$ (over 20 cm)", min: 10, max: 60, step: 1, value: 30, onInput: reset });
    var aS = K.slider({ label: "Solenoid radius $a$", unit: "cm", min: 1, max: 4, step: 0.5, value: 1.5, onInput: reset });
    var rhoS = K.slider({ label: "Ampère loop radius", unit: "cm", min: 1, max: 12, step: 0.5, value: 6, onInput: reset, hint: "Drag the loop's centre or its edge handle." });
    P.controls.innerHTML = "<h3>Current carrier</h3>";
    var modeSeg = K.seg([{ label: "Straight wire", value: "wire" }, { label: "Loop", value: "loop" }, { label: "Solenoid", value: "solenoid" },
      { label: "Two wires", value: "pair" }, { label: "Ampère's law", value: "ampere" }], "wire", function (v) { setMode(v); }, "Current carrier");
    P.controls.appendChild(modeSeg);
    var gI = K.h("<div><h3>Current</h3></div>");
    var dirSeg = K.seg([{ label: "⊙ out of screen", value: 1 }, { label: "⊗ into screen", value: -1 }], 1, function (v) { dir = v; reset(); }, "Current direction");
    gI.appendChild(IS.el); gI.appendChild(dirSeg);
    var dirNote = K.h('<p class="control-hint"></p>'); gI.appendChild(dirNote);
    var gPair = K.h("<div><h3>Second wire</h3></div>");
    var sameSeg = K.seg([{ label: "Same direction", value: "same" }, { label: "Opposite", value: "opp" }], "same", function (v) { same = v === "same"; reset(); }, "Second current");
    [I2S.el, sameSeg, dS.el].forEach(function (e) { gPair.appendChild(e); });
    var gLoop = K.h("<div><h3>Loop</h3></div>"); gLoop.appendChild(RS.el);
    var gSol = K.h("<div><h3>Solenoid</h3></div>"); gSol.appendChild(NS.el); gSol.appendChild(aS.el);
    var gAmp = K.h('<div><h3>Amperian loop</h3><p class="control-hint">Wires: +3 A ⊙, −3 A ⊗ and +5 A ⊙. Drag them anywhere.</p></div>'); gAmp.appendChild(rhoS.el);
    [gI, gPair, gLoop, gSol, gAmp].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h('<div class="legend"><span class="c-app"><i></i>B field</span><span class="c-ten"><i></i>current</span>' +
      '<span class="c-acc"><i></i>force on a wire</span><span class="c-fric"><i></i>compass north</span></div>'));

    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function setMode(v) { mode = v; setSeg(modeSeg, v); placeDefaults(); showGroups(); reset(); }
    function showGroups() {
      gPair.hidden = mode !== "pair"; gLoop.hidden = mode !== "loop"; gSol.hidden = mode !== "solenoid"; gAmp.hidden = mode !== "ampere";
      gI.hidden = mode === "ampere";
      dirNote.textContent = mode === "loop" || mode === "solenoid" ? "Direction of the current at the top of each turn." : mode === "pair" ? "Left wire. The right wire is set below." : "";
    }

    /* ---------- state ---------- */
    var probe = { x: 5, y: 0 }, amp = { x: -4, y: 0 }, wires = AMP_WIRES.map(function (w) { return Object.assign({}, w); });
    function placeDefaults() {
      if (mode === "wire") probe = { x: 5, y: 0 };
      if (mode === "loop") probe = { x: 0, y: 0 };
      if (mode === "solenoid") probe = { x: 0, y: 0 };
      if (mode === "pair") probe = { x: 0, y: 4 };
      if (mode === "ampere") { amp = { x: -4, y: 0 }; wires = AMP_WIRES.map(function (w) { return Object.assign({}, w); }); }
    }
    function params() {
      return { mode: mode, I: IS.get(), dir: dir, I2: I2S.get(), same: same, d: dS.get(), R: RS.get(), N: NS.get(), a: aS.get(), rho: rhoS.get() };
    }
    // the wires of the current setup as straight segments ⊥ screen (cm, signed A); loops as rings
    function sources(p, pos) {
      if (p.mode === "wire") return { wires: [{ x: 0, y: 0, I: p.dir * p.I }], loops: [] };
      if (p.mode === "pair") {
        var x1 = pos ? pos.x1 : -p.d / 2, x2 = pos ? pos.x2 : p.d / 2;
        return { wires: [{ x: x1, y: 0, I: p.dir * p.I }, { x: x2, y: 0, I: p.dir * (p.same ? 1 : -1) * p.I2 }], loops: [] };
      }
      if (p.mode === "ampere") return { wires: wires.map(function (w) { return { x: w.x, y: w.y, I: w.I }; }), loops: [] };
      if (p.mode === "loop") return { wires: [], loops: [{ x: 0, a: p.R, I: p.dir * p.I }] };
      var ls = [];
      for (var k = 0; k < p.N; k++) ls.push({ x: -SOL_L / 2 + (k + 0.5) * SOL_L / p.N, a: p.a, I: p.dir * p.I });
      return { wires: [], loops: ls };
    }
    // B (tesla) at a point given in cm
    function Bat(src, x, y) {
      var bx = 0, by = 0, X0 = x / 100, Y0 = y / 100;
      src.wires.forEach(function (w) { var b = wireB(w.I, w.x / 100, w.y / 100, X0, Y0); bx += b[0]; by += b[1]; });
      src.loops.forEach(function (l) { var b = loopB(l.a / 100, l.I, l.x / 100, X0, Y0); bx += b[0]; by += b[1]; });
      return [bx, by];
    }
    function mag(b) { return Math.hypot(b[0], b[1]); }
    function fmtB(B) { return Math.abs(B) < 1e-3 ? K.fmt(B * 1e6, 1) + " µT" : K.fmt(B * 1e3, 2) + " mT"; }

    // textbook formulas
    function F(p) {
      var o = {};
      o.wire = MU0 * p.I / (TAU * Math.max(Math.hypot(probe.x, probe.y), 1e-6) / 100);
      o.loopC = MU0 * p.I / (2 * p.R / 100);
      var xr = probe.x / 100, R = p.R / 100;
      o.loopAxis = MU0 * p.I * R * R / (2 * Math.pow(R * R + xr * xr, 1.5));
      var n = p.N / (SOL_L / 100), L = SOL_L / 100, a = p.a / 100;
      o.n = n; o.ideal = MU0 * n * p.I;
      o.solAxis = function (x) { x /= 100; return 0.5 * MU0 * n * p.I * ((x + L / 2) / Math.hypot(x + L / 2, a) - (x - L / 2) / Math.hypot(x - L / 2, a)); };
      o.solC = o.ideal * L / Math.sqrt(L * L + 4 * a * a);
      o.solEnd = 0.5 * o.ideal * L / Math.sqrt(L * L + a * a);
      o.fpl = MU0 * p.I * p.I2 / (TAU * p.d / 100);
      return o;
    }

    /* ---------- view ---------- */
    var view = { s: 25, cx: 0, cy: 0 };
    function X(x) { return W / 2 + (x - view.cx) * view.s; }
    function Y(y) { return H / 2 - (y - view.cy) * view.s; }
    function toCm(px, py) { return { x: view.cx + (px - W / 2) / view.s, y: view.cy - (py - H / 2) / view.s }; }
    function fit(p) {
      var w = { wire: 36, loop: Math.max(24, p.R * 4.4), solenoid: 36, pair: Math.max(34, p.d + 22), ampere: 34 }[p.mode];
      view.s = W / w; view.cx = 0; view.cy = 0;
      if (p.mode === "pair" && probe.x > w / 2 - 2) view.cx = probe.x - w / 2 + 3;
    }

    /* ---------- runs ---------- */
    var st = null, samples = [], pairSeen = {}, gridCache = null, lines = [], lineTimer = null;
    var NEEDLE = 50;          // px between compass needles
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      fit(p);
      st = { p: p, on: p.mode === "ampere", Ieff: p.mode === "ampere" ? 1 : 0, rec: [[0, 0]], pos: { x1: -p.d / 2, x2: p.d / 2, v1: 0, v2: 0 }, pairRec: [[0, p.d]],
        walk: 0, walkSum: null, done: false, result: null };
      st.src = sources(p, st.pos);
      buildNeedles(); buildAmpere();
      if (transportUI) { tOpts.playLabel = p.mode === "ampere" ? "Walk the loop" : p.mode === "pair" ? "Switch on & release" : "Switch on"; transportUI.render(); }
      P.time.textContent = "t = 0.00 s";
      clearTimeout(lineTimer); lines = [];
      if (p.mode === "loop" || p.mode === "solenoid") lineTimer = setTimeout(buildLines, 60);
      theory(); update(true);
    }

    // compass needles on a grid: angle, spin, and the field direction there
    var needles = [];
    function buildNeedles() {
      needles = [];
      for (var px = NEEDLE / 2; px < W; px += NEEDLE) for (var py = NEEDLE / 2; py < H; py += NEEDLE) {
        var c = toCm(px, py), b = Bat(st.src, c.x, c.y), skip = false;
        st.src.wires.forEach(function (w) { if (Math.hypot(c.x - w.x, c.y - w.y) * view.s < 16) skip = true; });
        st.src.loops.forEach(function (l) { if (Math.abs(c.x - l.x) * view.s < 8 && Math.abs(Math.abs(c.y) - l.a) * view.s < 8) skip = true; });
        if (!skip) needles.push({ px: px, py: py, a: Math.PI / 2, w: 0, b: b });
      }
      probeNeedle.b = Bat(st.src, probe.x, probe.y);
      if (!st.on) { probeNeedle.a = Math.PI / 2; probeNeedle.w = 0; }
    }
    var probeNeedle = { a: Math.PI / 2, w: 0, b: [0, 0] };
    function refB() { return MU0 * 10 / (TAU * 0.04); }
    // a needle swings towards the field: torque ∝ B sin(angle off), with damping
    function swing(nd, h) {
      var B = mag(nd.b) * st.Ieff;
      if (B < 1e-12) return;
      var target = Math.atan2(nd.b[1], nd.b[0]), off = Math.atan2(Math.sin(nd.a - target), Math.cos(nd.a - target));
      var k = 260 * Math.min(4, B / refB());
      nd.w += (-k * Math.sin(off) - 9 * nd.w) * h;
      nd.a += nd.w * h;
    }

    // field lines for the loop and solenoid, traced through a cached grid of the field
    function buildLines() {
      var p = st.p, x0 = view.cx - W / 2 / view.s, x1 = view.cx + W / 2 / view.s, y0 = view.cy - H / 2 / view.s, y1 = view.cy + H / 2 / view.s;
      var nx = 140, ny = 74, g = [];
      for (var j = 0; j <= ny; j++) for (var i = 0; i <= nx; i++) g.push(Bat(st.src, x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny));
      function at(x, y) {
        var fi = (x - x0) / (x1 - x0) * nx, fj = (y - y0) / (y1 - y0) * ny, i = Math.floor(fi), j = Math.floor(fj);
        if (i < 0 || j < 0 || i >= nx || j >= ny) return null;
        var u = fi - i, v = fj - j, a = g[j * (nx + 1) + i], b = g[j * (nx + 1) + i + 1], c = g[(j + 1) * (nx + 1) + i], d = g[(j + 1) * (nx + 1) + i + 1];
        var bx = a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * (1 - u) * v + d[0] * u * v;
        var by = a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * (1 - u) * v + d[1] * u * v, m = Math.hypot(bx, by);
        return m > 0 ? [bx / m, by / m] : null;
      }
      var h = (x1 - x0) / 300, rad = p.mode === "loop" ? p.R : p.a, out = [];
      function trace(sx, sy, sgn) {
        var pts = [[sx, sy]], x = sx, y = sy;
        for (var n = 0; n < 1400; n++) {
          var k1 = at(x, y); if (!k1) break;
          var k2 = at(x + sgn * h / 2 * k1[0], y + sgn * h / 2 * k1[1]); if (!k2) break;
          var k3 = at(x + sgn * h / 2 * k2[0], y + sgn * h / 2 * k2[1]); if (!k3) break;
          var k4 = at(x + sgn * h * k3[0], y + sgn * h * k3[1]); if (!k4) break;
          x += sgn * h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += sgn * h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          pts.push([x, y]);
          if (n > 20 && Math.hypot(x - sx, y - sy) < h) { pts.push([sx, sy]); return { pts: pts, closed: true }; }
        }
        return { pts: pts, closed: false };
      }
      for (var k = -3; k <= 3; k++) {
        var sy = rad * k / 3.6, f = trace(0, sy, 1);
        if (!f.closed) { var b = trace(0, sy, -1); f.pts = b.pts.reverse().concat(f.pts.slice(1)); }
        out.push(f.pts);
      }
      lines = out;
    }

    // Ampère: contributions B·dl round the loop, anticlockwise
    var AMP_N = 1440, ampDl = [];
    function buildAmpere() {
      ampDl = [];
      if (st.p.mode !== "ampere") return;
      var r = st.p.rho;
      for (var i = 0; i < AMP_N; i++) {
        var ph = (i + 0.5) / AMP_N * TAU, b = Bat(st.src, amp.x + r * Math.cos(ph), amp.y + r * Math.sin(ph));
        ampDl.push((-b[0] * Math.sin(ph) + b[1] * Math.cos(ph)) * (r / 100) * TAU / AMP_N);
      }
    }
    function ampTotal(upto) { var s = 0, n = Math.round((upto === undefined ? 1 : upto) * AMP_N); for (var i = 0; i < n; i++) s += ampDl[i]; return s; }
    function ampEnc(cx, cy, r) { return wires.reduce(function (s, w) { return s + (Math.hypot(w.x - cx, w.y - cy) < r ? w.I : 0); }, 0); }
    function ampInside() { return wires.filter(function (w) { return Math.hypot(w.x - amp.x, w.y - amp.y) < st.p.rho; }).length; }
    // the force per length on the right wire from the left one, by Biot–Savart (N/m, + = towards the left wire)
    function pairForce(pos) {
      var src = sources(st.p, pos), w1 = src.wires[0], w2 = src.wires[1], b = wireB(w1.I, w1.x / 100, 0, w2.x / 100, 0);
      var fx = w2.I * b[1] * -1;          // F = I L × B with L along z: (I ẑ × B)_x = −I B_y
      return { fx: fx, f: Math.abs(fx), attract: fx * (w1.x - w2.x) > 0 };
    }

    sim.on("step", function (t) {
      var p = st.p, h = K.DT;
      if (p.mode === "ampere") {
        st.walk = Math.min(1, t / 4);
        st.rec.push([st.walk * 360, ampTotal(st.walk) / MU0]);
        if (st.walk >= 1 && !st.done) finish();
      } else {
        st.on = true; st.Ieff = 1 - Math.exp(-t / 0.12);
        if (p.mode === "pair") {
          var src = sources(p, st.pos), f = pairForce(st.pos), a = f.fx * st.Ieff * st.Ieff / LAMBDA * 100;   // cm/s², on the right wire
          st.pos.v2 += a * h; st.pos.v1 -= a * h; st.pos.x2 += st.pos.v2 * h; st.pos.x1 += st.pos.v1 * h;
          st.src = src;
          var gap = st.pos.x2 - st.pos.x1;
          st.pairRec.push([t, gap]);
          if (!st.done && (gap < 0.6 || gap > 60 || t > 6)) finish(gap < 0.6 ? "touch" : "apart");
          if (st.done) { sim.pause(); transportUI.render(); }
        } else {
          st.rec.push([t, mag(probeNeedle.b) * st.Ieff * 1e6]);
          if (t >= 3 && !st.done) finish();
        }
      }
      update(st.done);
    });

    function finish(why) {
      if (st.done) return;
      st.done = true; sim.pause(); transportUI.render();
      var p = st.p;
      if (p.mode === "ampere") {
        var tot = ampTotal() / MU0, enc = ampEnc(amp.x, amp.y, p.rho);
        st.result = { total: tot, enc: enc };
        K.flash(P.note, "∮B·dl / μ₀ = " + K.fmt(tot, 2) + " A, and the enclosed current is " + K.fmt(enc, 0) + " A");
        if (ampInside() >= 2 && Math.abs(enc) < 1e-9 && Math.abs(tot) < 0.05) tries.mark("zero");
      } else if (p.mode === "pair") {
        st.result = { why: why };
        pairSeen[why] = pairSeen[why] || (why === "touch" ? p.same : !p.same);
        K.flash(P.note, why === "touch" ? "They pulled together: currents the same way attract" : "Pushed apart: opposite currents repel");
        if (pairSeen.touch && pairSeen.apart) tries.mark("wires");
      } else K.flash(P.note, "Current on: every compass lines up along the field");
    }

    /* ---------- dragging ---------- */
    var dragging = null;
    function near(pt, x, y, r) { return Math.hypot(pt.px - X(x), pt.py - Y(y)) <= (r || 16); }
    sim.pointer({
      down: function (pt) {
        var p = st.p;
        if (p.mode === "ampere") {
          for (var i = 0; i < wires.length; i++) if (near(pt, wires[i].x, wires[i].y)) { dragging = { w: i }; return true; }
          if (near(pt, amp.x + p.rho, amp.y, 14)) { dragging = { rho: true }; return true; }
          if (near(pt, amp.x, amp.y, 22)) { dragging = { amp: true }; return true; }
          return false;
        }
        if (p.mode === "pair" && !sim.running && near(pt, p.d / 2, 0) && st.pairRec.length <= 1) { dragging = { w2: true }; return true; }
        if (near(pt, probe.x, probe.y, 22)) { dragging = { probe: true }; return true; }
        return false;
      },
      drag: function (pt) {
        var c = toCm(pt.px, pt.py), r1 = function (v) { return Math.round(v * 10) / 10; };
        if (dragging.probe) { probe = { x: r1(c.x), y: r1(c.y) }; st.src = sources(st.p, st.pos); probeNeedle.b = Bat(st.src, probe.x, probe.y); update(true); return; }
        if (dragging.w2) { dS.set(K.clamp(Math.round(c.x * 4) / 2, 2, 20)); reset(); return; }
        if (dragging.w != null) { wires[dragging.w].x = r1(c.x); wires[dragging.w].y = r1(c.y); }
        if (dragging.amp) { amp = { x: r1(c.x), y: r1(c.y) }; }
        if (dragging.rho) rhoS.set(K.clamp(Math.round(Math.hypot(c.x - amp.x, c.y - amp.y) * 2) / 2, 1, 12));
        reset();
      },
      up: function () { if (dragging && dragging.probe) probed(); dragging = null; }
    });
    // a probe reading is kept for the tries and the graphs
    function probed() {
      var p = st.p, B = mag(Bat(st.src, probe.x, probe.y)), r = Math.hypot(probe.x, probe.y);
      if (p.mode === "wire") {
        samples.push({ I: p.I, r: r, B: B });
        if (samples.length > 30) samples.shift();
        var last = samples[samples.length - 1];
        samples.forEach(function (s) { if (s !== last && s.I === p.I && (Math.abs(r / s.r - 2) <= 0.06 || Math.abs(s.r / r - 2) <= 0.06)) tries.mark("half"); });
      }
      if (p.mode === "solenoid" && Math.abs(probe.y) <= 0.3 && Math.abs(Math.abs(probe.x) - SOL_L / 2) <= 0.6) tries.mark("end");
      update(true);
    }

    /* ---------- drawing ---------- */
    function sym(ctx, x, y, out, r, color, fill) {
      ctx.fillStyle = fill || th.surface; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      if (out) { ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill(); }
      else { var k = r * 0.6; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke(); }
    }
    function needle(ctx, x, y, a, len, alpha) {
      var c = Math.cos(a) * len / 2, s = Math.sin(a) * len / 2;
      ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.strokeStyle = K.alpha(th.fric, alpha); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c, y - s); ctx.stroke();
      ctx.strokeStyle = K.alpha(th.muted, alpha); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - c, y + s); ctx.stroke();
    }
    function cmGrid(ctx) {
      var st5 = view.s * 5 > 60 ? 1 : 5;
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
      var x0 = view.cx - W / 2 / view.s, x1 = view.cx + W / 2 / view.s, y0 = view.cy - H / 2 / view.s, y1 = view.cy + H / 2 / view.s;
      for (var x = Math.ceil(x0 / st5) * st5; x <= x1; x += st5) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
      for (var y = Math.ceil(y0 / st5) * st5; y <= y1; y += st5) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
      ctx.fillStyle = th.ink; ctx.fillRect(16, H - 18, 5 * view.s, 3);
      K.label(ctx, "5 cm", 16 + 2.5 * view.s, H - 20, th.muted, {});
    }

    sim.on("under", function (ctx) {
      var p = st.p;
      cmGrid(ctx);
      // compasses (they swing in real time, so you can see them settle even while paused)
      needles.forEach(function (nd) { swing(nd, 1 / 60); });
      swing(probeNeedle, 1 / 60);
      var bref = refB();
      needles.forEach(function (nd) {
        var B = mag(nd.b) * st.Ieff, al = st.on ? K.clamp(Math.sqrt(B / bref), 0.15, 0.9) : 0.35;
        needle(ctx, nd.px, nd.py, nd.a, 20, al);
      });
      var al2 = K.clamp(st.Ieff, 0, 1);
      if (p.mode === "wire" && al2 > 0.02) {
        // field lines of a long wire: circles, spaced so their density follows B ∝ 1/r
        ctx.strokeStyle = K.alpha(th.app, 0.6 * al2); ctx.lineWidth = 1.8;
        for (var k = 0; k < 9; k++) {
          var r = 1.2 * Math.pow(1.45, k) * view.s;
          ctx.beginPath(); ctx.arc(X(0), Y(0), r, 0, TAU); ctx.stroke();
          var ang = Math.PI / 4 + k * 0.5, hx = X(0) + r * Math.cos(ang), hy = Y(0) - r * Math.sin(ang), sg = p.dir;
          K.arrow(ctx, hx, hy, hx - sg * 10 * Math.sin(ang), hy - sg * 10 * Math.cos(ang), K.alpha(th.app, al2), { width: 2, head: 8 });
        }
      }
      if ((p.mode === "loop" || p.mode === "solenoid") && al2 > 0.02) {
        ctx.lineWidth = 1.8; ctx.strokeStyle = K.alpha(th.app, 0.65 * al2);
        lines.forEach(function (ln) {
          ctx.beginPath(); ln.forEach(function (q, i) { if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); }); ctx.stroke();
          var m = Math.floor(ln.length * 0.3), m2 = Math.min(ln.length - 1, m + 3);
          if (ln.length > 8) K.arrow(ctx, X(ln[m][0]), Y(ln[m][1]), X(ln[m2][0]), Y(ln[m2][1]), K.alpha(th.app, al2), { width: 2, head: 9 });
        });
      }
      if (p.mode === "solenoid") {
        ctx.strokeStyle = K.alpha(th.ten, 0.5); ctx.lineWidth = 1;
        ctx.strokeRect(X(-SOL_L / 2), Y(p.a), SOL_L * view.s, 2 * p.a * view.s);
      }
      if (p.mode === "ampere") drawAmpere(ctx);
    });

    sim.on("over", function (ctx) {
      var p = st.p, src = st.src;
      src.wires.forEach(function (w, i) {
        sym(ctx, X(w.x), Y(w.y), w.I > 0, 12, th.ten);
        var lab2 = p.mode === "pair" ? (i ? "I₂ " : "I₁ ") + K.fmt(Math.abs(w.I), 0) + " A" : (w.I > 0 ? "+" : "−") + K.fmt(Math.abs(w.I), 0) + " A";
        K.label(ctx, lab2, X(w.x), Y(w.y) - 16, th.ten, { bg: true });
      });
      src.loops.forEach(function (l) {
        var r = Math.max(4, Math.min(9, 0.35 * view.s));
        if (p.mode === "loop") {
          ctx.strokeStyle = K.alpha(th.ten, 0.5); ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.ellipse(X(l.x), Y(0), 0.25 * l.a * view.s, l.a * view.s, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        sym(ctx, X(l.x), Y(l.a), l.I > 0, r, th.ten); sym(ctx, X(l.x), Y(-l.a), l.I < 0, r, th.ten);
      });
      if (p.mode === "loop") K.label(ctx, "loop seen edge-on: current comes out at the top, goes in at the bottom", W - 12, H - 8, th.muted, { align: "right", bg: true });
      if (p.mode === "solenoid") K.label(ctx, "solenoid cut in half along its axis: " + p.N + " turns over 20 cm", W - 12, H - 8, th.muted, { align: "right", bg: true });
      if (p.mode === "pair") {
        var f = pairForce(st.pos), w = st.src.wires, L = 30 + 30 * Math.min(1.5, f.f / 2.5e-4), sgn = f.fx > 0 ? 1 : -1;
        K.arrow(ctx, X(w[1].x), Y(0) + 26, X(w[1].x) + sgn * L, Y(0) + 26, th.acc, { width: 3, label: "F" });
        K.arrow(ctx, X(w[0].x), Y(0) + 26, X(w[0].x) - sgn * L, Y(0) + 26, th.acc, { width: 3, label: "F" });
        K.label(ctx, (f.attract ? "attract" : "repel") + ": F/L = " + K.fmt(f.f * 1e4, 2) + " × 10⁻⁴ N/m", (X(w[0].x) + X(w[1].x)) / 2, Y(0) + 64, th.acc, { bg: true });
        if (!sim.running && st.pairRec.length <= 1) K.label(ctx, "drag ↔", X(w[1].x), Y(0) - 34, th.muted, {});
      }
      if (p.mode !== "ampere") drawProbe(ctx);
    });
    function drawProbe(ctx) {
      var x = X(probe.x), y = Y(probe.y), b = Bat(st.src, probe.x, probe.y);
      ctx.fillStyle = K.alpha(th.surface, 0.95); ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill(); ctx.stroke();
      needle(ctx, x, y, probeNeedle.a, 32, 1);
      K.label(ctx, st.on ? fmtB(mag(b) * st.Ieff) : "probe (drag me)", x, y - 24, th.ink, { bg: true });
    }
    function drawAmpere(ctx) {
      var p = st.p, cx = X(amp.x), cy = Y(amp.y), r = p.rho * view.s;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // anticlockwise arrows: with this sense, current out of the screen counts as positive
      for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2 + Math.PI / 4, hx = cx + r * Math.cos(a), hy = cy - r * Math.sin(a); K.arrow(ctx, hx, hy, hx - 12 * Math.sin(a), hy - 12 * Math.cos(a), th.ink, { width: 2, head: 8 }); }
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.beginPath(); ctx.arc(cx + r, cy, 7, 0, TAU); ctx.fill(); ctx.stroke();
      if (st.walk > 0) {
        ctx.strokeStyle = th.app; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, -st.walk * TAU, true); ctx.stroke();
        var ph = st.walk * TAU, mx = amp.x + p.rho * Math.cos(ph), my = amp.y + p.rho * Math.sin(ph), b = Bat(st.src, mx, my), bm = mag(b) || 1;
        K.arrow(ctx, X(mx), Y(my), X(mx) + b[0] / bm * 34, Y(my) - b[1] / bm * 34, th.app, { width: 3, label: "B" });
      }
      K.label(ctx, "I enclosed = " + K.fmt(ampEnc(amp.x, amp.y, p.rho), 0) + " A", cx, cy - r - 8, th.ink, { bg: true });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app cap1h"></b> · <span class="cap1"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app cap2h"></b> · <span class="cap2"></span></p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var g1 = new K.Graph(cv[0], { yLabel: "B (µT)", xLabel: "r (cm)", xMax: 15, yMin: 0, color: th.app });
    var g2 = new K.Graph(cv[1], { yLabel: "B (µT)", xMax: 3, yMin: 0, color: th.app });
    var capEls = ["cap1h", "cap1", "cap2h", "cap2"].map(function (c) { return P.graphs.querySelector("." + c); });
    function caps(a) { capEls[0].textContent = a[0]; capEls[1].innerHTML = K.md(a[1]); capEls[2].textContent = a[2]; capEls[3].innerHTML = K.md(a[3]); }
    var unit = 1e6;          // graph scale: µT (mT for the solenoid)
    function theory() {
      var p = st.p, f = F(p), sim1 = [], form = [], i, x;
      g1.clear(); g2.clear(); g1.extra = g2.extra = null;
      unit = p.mode === "solenoid" ? 1e3 : 1e6;
      var u = unit === 1e3 ? "mT" : "µT";
      g1.o.yLabel = "B (" + u + ")"; g2.o.yLabel = "B (" + u + ")"; g2.o.xLabel = "t (s)"; g2.o.xMax = 3; g2.o.xAuto = false; g1.o.xAuto = false; g1.o.yMin = 0; g2.o.yMin = 0;
      if (p.mode === "wire") {
        var ux = probe.x, uy = probe.y, um = Math.hypot(ux, uy) || 1;
        for (i = 1; i <= 120; i++) { x = 15 * i / 120; sim1.push([x, mag(Bat(st.src, ux / um * x, uy / um * x)) * unit]); form.push([x, MU0 * p.I / (TAU * x / 100) * unit]); }
        g1.o.xMax = 15; g1.o.xLabel = "r (cm)"; g1.o.yMax = undefined;
        g1.set("f", { points: form.filter(function (q) { return q[0] >= 1; }), color: th.app, dash: [5, 5], width: 1.5 });
        g1.set("s", { points: sim1.filter(function (q) { return q[0] >= 1; }), color: th.app, width: 2.5 });
        caps(["B vs distance", "solid: summed along the wire; dashed: $\\mu_0 I/2\\pi r$", "B at the probe vs t", "switch on and watch it rise to the formula (dashed)"]);
      } else if (p.mode === "loop") {
        for (i = 0; i <= 120; i++) { x = 3 * p.R * i / 120; sim1.push([x, Bat(st.src, x, 0)[0] * p.dir * unit]); var R = p.R / 100; form.push([x, MU0 * p.I * R * R / (2 * Math.pow(R * R + x * x / 1e4, 1.5)) * unit]); }
        g1.o.xMax = 3 * p.R; g1.o.xLabel = "x along the axis (cm)";
        g1.set("f", { points: form, color: th.app, dash: [5, 5], width: 1.5 }); g1.set("s", { points: sim1, color: th.app, width: 2.5 });
        caps(["B along the axis", "biggest at the centre, $\\mu_0 I/2R$; dashed: $\\dfrac{\\mu_0 I R^2}{2(R^2+x^2)^{3/2}}$", "B at the probe vs t", "switch on: it rises to its final value"]);
      } else if (p.mode === "solenoid") {
        for (i = 0; i <= 160; i++) { x = SOL_L * i / 160; sim1.push([x, Bat(st.src, x, 0)[0] * p.dir * unit]); form.push([x, f.solAxis(x) * unit]); }
        g1.o.xMax = SOL_L; g1.o.xLabel = "x from the centre (cm)";
        g1.set("ideal", { points: [[0, f.ideal * unit], [SOL_L / 2, f.ideal * unit]], color: K.alpha(th.muted, 0.7), width: 1 });
        g1.set("f", { points: form, color: th.app, dash: [5, 5], width: 1.5 }); g1.set("s", { points: sim1, color: th.app, width: 2.5 });
        g1.extra = function (ctx, Xg, Yg) { ctx.strokeStyle = th.ten; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(Xg(SOL_L / 2), Yg(0)); ctx.lineTo(Xg(SOL_L / 2), Yg(f.ideal * unit)); ctx.stroke(); ctx.setLineDash([]); };
        caps(["B along the axis", "flat inside at $\\mu_0 nI$ (grey), half at the end (yellow line), gone outside", "B at the probe vs t", "switch on: it rises to its final value"]);
      } else if (p.mode === "pair") {
        for (i = 4; i <= 200; i++) { x = i / 10; form.push([x, MU0 * p.I * p.I2 / (TAU * x / 100) * 1e4]); }
        g1.o.xMax = 20; g1.o.xLabel = "d (cm)"; g1.o.yLabel = "F/L (×10⁻⁴ N/m)"; g1.o.yMax = undefined;
        g1.set("f", { points: form.filter(function (q) { return q[1] < 4 * form[form.length - 1][1] * 20 / 2; }), color: th.acc, dash: [5, 5], width: 1.5 });
        g2.o.yLabel = "d (cm)"; g2.o.xMax = 1; g2.o.xAuto = true;
        caps(["Force per length vs separation", "dashed: $\\mu_0 I_1 I_2/2\\pi d$; the dot is the Biot–Savart force at your d", "Separation vs t", "after release: they speed up as they close in"]);
      } else {
        g1.o.xMax = 360; g1.o.xLabel = "angle walked (°)"; g1.o.yLabel = "∮B·dl/μ₀ (A)"; g1.o.yMin = Math.min(0, -3);
        var enc = ampEnc(amp.x, amp.y, p.rho);
        g1.set("f", { points: [[0, enc], [360, enc]], color: th.app, dash: [5, 5], width: 1.5 });
        for (i = 1; i <= 120; i++) {
          x = 15 * i / 120;
          if (wires.some(function (w) { return Math.abs(Math.hypot(w.x - amp.x, w.y - amp.y) - x) < 0.4; })) continue;   // a wire right on the path: skip
          var s = 0, n = 360;
          for (var k = 0; k < n; k++) { var ph = (k + 0.5) / n * TAU, b = Bat(st.src, amp.x + x * Math.cos(ph), amp.y + x * Math.sin(ph)); s += (-b[0] * Math.sin(ph) + b[1] * Math.cos(ph)) * (x / 100) * TAU / n; }
          sim1.push([x, s / MU0]); form.push([x, ampEnc(amp.x, amp.y, x)]);
        }
        g2.o.yLabel = "∮B·dl/μ₀ (A)"; g2.o.xLabel = "loop radius (cm)"; g2.o.xMax = 15; g2.o.yMin = -3;
        g2.set("f", { points: form, color: th.app, dash: [5, 5], width: 1.5 }); g2.set("s", { points: sim1, color: th.app, width: 2.5 });
        g2.extra = function (ctx, Xg, Yg) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Xg(p.rho), Yg(enc), 6, 0, TAU); ctx.stroke(); };
        caps(["Running total round the loop", "it wobbles on the way, but lands exactly on $I_{enc}$ (dashed)", "Total vs loop radius", "steps up only when the loop swallows another wire"]);
      }
      if (p.mode === "wire" || p.mode === "loop" || p.mode === "solenoid") {
        var fin = mag(Bat(st.src, probe.x, probe.y)) * unit;
        g2.set("f", { points: [[0, fin], [3, fin]], color: th.app, dash: [5, 5], width: 1.5 });
      }
    }

    var lastDraw = 0;
    function update(force) {
      var now = performance.now();
      if (!force && now - lastDraw < 50) return;
      lastDraw = now;
      var p = st.p, f = F(p);
      if (p.mode === "wire" || p.mode === "loop" || p.mode === "solenoid") {
        g2.set("s", { points: st.rec.map(function (q) { return [q[0], q[1] / 1e6 * unit]; }), color: th.app, width: 2.5, dot: true });
        var pr = Math.hypot(probe.x, probe.y), pB = mag(Bat(st.src, probe.x, probe.y)) * unit;
        g1.extra = p.mode === "wire" ? function (ctx, Xg, Yg) {
          ctx.fillStyle = th.app; samples.filter(function (s) { return s.I === p.I; }).forEach(function (s) { ctx.beginPath(); ctx.arc(Xg(s.r), Yg(s.B * unit), 4.5, 0, TAU); ctx.fill(); });
          ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Xg(pr), Yg(pB), 6, 0, TAU); ctx.stroke();
        } : g1.extra;
        if (p.mode !== "wire") theoryProbeLine();
      } else if (p.mode === "pair") {
        g2.set("s", { points: st.pairRec, color: th.disp, width: 2.5, dot: true });
        var pf = pairForce({ x1: -p.d / 2, x2: p.d / 2 });
        g1.extra = function (ctx, Xg, Yg) { ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(Xg(p.d), Yg(pf.f * 1e4), 5, 0, TAU); ctx.fill(); };
      } else {
        g1.set("s", { points: st.rec.slice(1), color: th.app, width: 2.5, dot: true });
      }
      void f;
      [g1, g2].forEach(function (g) { g.dirty = true; g.draw(); });
      renderMaths();
    }
    function theoryProbeLine() {
      var fin = mag(Bat(st.src, probe.x, probe.y)) * unit;
      g2.set("f", { points: [[0, fin], [3, fin]], color: th.app, dash: [5, 5], width: 1.5 });
    }

    /* ---------- maths + readouts ---------- */
    var eqEls = [], setR = null, layoutKey = "";
    var LAYOUT = {
      wire: { eqs: ["Biot–Savart: each bit of wire adds a little", "Add up a long straight wire", "Direction: right-hand grip", "It falls as 1/r"],
        ro: [["B", "B at the probe", "c-app"], ["r", "distance from the wire", "c-disp"], ["dir", "direction", ""], ["Br", "B × 2πr / μ₀", ""]] },
      loop: { eqs: ["At the centre of a loop", "Along the axis", "Direction: curl your fingers with the current", "Compare a straight wire at distance R"],
        ro: [["Bc", "B at the centre", "c-app"], ["B", "B at the probe", "c-app"], ["ax", "probe on the axis?", ""], ["w", "straight wire at R", ""]] },
      solenoid: { eqs: ["Turns per metre", "A long solenoid", "Your solenoid has a finite length", "At an end: half"],
        ro: [["Bc", "B at the centre", "c-app"], ["Be", "B at an end (on the axis)", "c-app"], ["B", "B at the probe", "c-app"], ["id", "ideal μ₀nI", ""]] },
      pair: { eqs: ["Wire 1's field at wire 2", "Force per length on wire 2", "Which way", "Newton's third law"],
        ro: [["F", "force per length", "c-acc"], ["dirn", "the wires", ""], ["B1", "B from wire 1 at wire 2", "c-app"], ["B", "B at the probe", "c-app"], ["d", "separation now", "c-disp"]] },
      ampere: { eqs: ["Ampère's law", "Current through your loop", "Your loop, summed point by point", "Wires outside the loop"],
        ro: [["tot", "∮B·dl / μ₀", "c-app"], ["enc", "enclosed current", "c-ten"], ["walk", "walked so far", ""], ["in", "wires inside", ""]] }
    };
    function layout(key) {
      if (key === layoutKey) return;
      layoutKey = key;
      var L = LAYOUT[key];
      P.eqs.innerHTML = L.eqs.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, L.ro.map(function (r) { return { id: r[0], label: r[1], cls: r[2] }; }));
    }
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function texB(B) { return Math.abs(B) < 1e-3 ? "\\mathbf{" + K.fmt(B * 1e6, 1) + "}\\ \\mu\\text{T}" : "\\mathbf{" + K.fmt(B * 1e3, 2) + "}\\ \\text{mT}"; }
    var M0 = "(4\\pi\\times10^{-7})";
    function renderMaths() {
      var p = st.p, f = F(p);
      layout(p.mode);
      var Bp = mag(Bat(st.src, probe.x, probe.y)), r = Math.hypot(probe.x, probe.y);
      if (p.mode === "wire") {
        K.tex(eqEls[0], "dB = \\frac{\\mu_0}{4\\pi}\\,\\frac{I\\,dl\\,\\sin\\theta}{r^2}");
        K.tex(eqEls[1], "B = \\frac{\\mu_0 I}{2\\pi r} = \\frac{" + M0 + "(" + p.I + ")}{2\\pi(" + K.fmt(r / 100, 3) + ")} = " + texB(f.wire));
        K.tex(eqEls[2], "\\text{thumb along } I\\ (" + (p.dir > 0 ? "\\odot" : "\\otimes") + ") \\Rightarrow B \\text{ circles " + (p.dir > 0 ? "anticlockwise" : "clockwise") + "}");
        K.tex(eqEls[3], "r \\to 2r:\\ B \\to \\tfrac12 B = " + texB(f.wire / 2));
        setR("B", fmtB(Bp), "formula " + fmtB(f.wire));
        setR("r", K.fmt(r, 1) + " cm", "drag the probe");
        setR("dir", p.dir > 0 ? "anticlockwise" : "clockwise", "seen from the front");
        setR("Br", K.fmt(Bp * TAU * r / 100 / MU0, 2) + " A", "= I: the same at every r");
      } else if (p.mode === "loop") {
        var onAxis = Math.abs(probe.y) < 0.05, Bc = mag(Bat(st.src, 0, 0));
        K.tex(eqEls[0], "B = \\frac{\\mu_0 I}{2R} = \\frac{" + M0 + "(" + p.I + ")}{2(" + K.fmt(p.R / 100, 3) + ")} = " + texB(f.loopC));
        K.tex(eqEls[1], "B(x) = \\frac{\\mu_0 I R^2}{2(R^2 + x^2)^{3/2}} \\;\\overset{x = " + K.fmt(probe.x, 1) + "\\text{ cm}}{=}\\; " + texB(f.loopAxis));
        K.tex(eqEls[2], "\\text{top of the loop } " + (p.dir > 0 ? "\\odot" : "\\otimes") + " \\Rightarrow B \\text{ at the centre points " + (p.dir > 0 ? "right" : "left") + "}");
        K.tex(eqEls[3], "\\frac{\\mu_0 I}{2\\pi R} = " + texB(f.loopC / Math.PI) + " = \\frac{1}{\\pi}\\times \\text{the loop's}");
        setR("Bc", fmtB(Bc), "formula μ₀I/2R = " + fmtB(f.loopC));
        setR("B", fmtB(Bp), onAxis ? "axis formula " + fmtB(f.loopAxis) : "off the axis: no simple formula");
        setR("ax", onAxis ? "yes, x = " + K.fmt(probe.x, 1) + " cm" : "no", "drag onto the line through the centre");
        setR("w", fmtB(f.loopC / Math.PI), "a loop concentrates the field π times");
      } else if (p.mode === "solenoid") {
        var Bc2 = mag(Bat(st.src, 0, 0)), Be = mag(Bat(st.src, SOL_L / 2, 0)), L = SOL_L / 100, a = p.a / 100;
        K.tex(eqEls[0], "n = \\frac{N}{L} = \\frac{" + p.N + "}{0.20} = \\mathbf{" + K.fmt(f.n, 0) + "}\\ \\text{turns/m}");
        K.tex(eqEls[1], "B = \\mu_0 n I = " + M0 + "(" + K.fmt(f.n, 0) + ")(" + p.I + ") = " + texB(f.ideal));
        K.tex(eqEls[2], "B_{centre} = \\mu_0 nI\\,\\frac{L}{\\sqrt{L^2 + 4a^2}} = " + texB(f.ideal) .replace("\\mathbf", "") + "\\times\\frac{0.20}{\\sqrt{0.20^2 + 4(" + K.fmt(a, 3) + ")^2}} = " + texB(f.solC));
        K.tex(eqEls[3], "B_{end} = \\tfrac12\\mu_0 nI\\,\\frac{L}{\\sqrt{L^2 + a^2}} = " + texB(f.solEnd) + " \\approx \\tfrac12 B_{centre}");
        void L;
        setR("Bc", fmtB(Bc2), "formula " + fmtB(f.solC));
        setR("Be", fmtB(Be), "formula " + fmtB(f.solEnd));
        setR("B", fmtB(Bp), "at x = " + K.fmt(probe.x, 1) + ", y = " + K.fmt(probe.y, 1) + " cm");
        setR("id", fmtB(f.ideal), "the long-solenoid limit (a ≪ L)");
      } else if (p.mode === "pair") {
        var pf = pairForce({ x1: -p.d / 2, x2: p.d / 2 }), B1 = MU0 * p.I / (TAU * p.d / 100);
        K.tex(eqEls[0], "B_1 = \\frac{\\mu_0 I_1}{2\\pi d} = \\frac{" + M0 + "(" + p.I + ")}{2\\pi(" + K.fmt(p.d / 100, 3) + ")} = " + texB(B1));
        K.tex(eqEls[1], "\\frac{F}{L} = I_2 B_1 = \\frac{\\mu_0 I_1 I_2}{2\\pi d} = \\frac{" + M0 + "(" + p.I + ")(" + p.I2 + ")}{2\\pi(" + K.fmt(p.d / 100, 3) + ")} = \\mathbf{" + K.fmt(f.fpl * 1e4, 2) + "\\times10^{-4}}\\ \\text{N/m}");
        K.tex(eqEls[2], p.same ? "\\text{same direction} \\Rightarrow \\text{attract}" : "\\text{opposite directions} \\Rightarrow \\text{repel}");
        K.tex(eqEls[3], "\\text{wire 1 feels } " + K.fmt(f.fpl * 1e4, 2) + "\\times10^{-4}\\ \\text{N/m too, the other way, even if } I_1 \\ne I_2");
        setR("F", K.fmt(pf.f * 1e4, 3) + " × 10⁻⁴ N/m", "formula " + K.fmt(f.fpl * 1e4, 3) + " × 10⁻⁴");
        setR("dirn", pf.attract ? "attract" : "repel", p.same ? "currents the same way" : "currents opposite");
        setR("B1", fmtB(mag(wireB(p.dir * p.I, -p.d / 200, 0, p.d / 200, 0))), "formula " + fmtB(B1));
        setR("B", fmtB(Bp), "at x = " + K.fmt(probe.x, 1) + ", y = " + K.fmt(probe.y, 1) + " cm");
        setR("d", K.fmt(st.pos.x2 - st.pos.x1, 2) + " cm", "");
      } else {
        var enc = ampEnc(amp.x, amp.y, p.rho), tot = ampTotal() / MU0, inside = wires.filter(function (w) { return Math.hypot(w.x - amp.x, w.y - amp.y) < p.rho; });
        K.tex(eqEls[0], "\\oint \\vec B\\cdot d\\vec l = \\mu_0 I_{enc}");
        K.tex(eqEls[1], "I_{enc} = " + (inside.length ? inside.map(function (w) { return n(w.I, 0); }).join(" + ") : "0") + " = \\mathbf{" + K.fmt(enc, 0) + "}\\ \\text{A}");
        K.tex(eqEls[2], "\\frac{1}{\\mu_0}\\sum \\vec B\\cdot \\Delta\\vec l \\;(" + AMP_N + " \\text{ steps}) = \\mathbf{" + K.fmt(tot, 2) + "}\\ \\text{A}");
        K.tex(eqEls[3], "\\text{outside: } B \\ne 0 \\text{ on the loop, but its } \\oint \\text{ adds to } 0");
        setR("tot", st.done ? K.fmt(tot, 2) + " A" : st.walk > 0 ? K.fmt(ampTotal(st.walk) / MU0, 2) + " A" : "—", "formula I_enc = " + K.fmt(enc, 0) + " A");
        setR("enc", K.fmt(enc, 0) + " A", "out of the screen counts +");
        setR("walk", K.fmt(st.walk * 360, 0) + "°", "press Walk the loop");
        setR("in", String(inside.length), "of 3");
      }
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A current makes a magnetic field. Each short piece of wire adds $dB = \\dfrac{\\mu_0}{4\\pi}\\dfrac{I\\,dl\\sin\\theta}{r^2}$ (the Biot–Savart law), and the lab adds up the pieces for you. For a long straight wire the field circles the wire with $B = \\mu_0 I/2\\pi r$; grip the wire with your right thumb along the current and your fingers show the way round.</p>" +
      "<p>Bend the wire into a loop and every piece pushes the field the same way through the middle: $B = \\mu_0 I/2R$. Stack loops into a solenoid and the field inside becomes uniform, $B = \\mu_0 nI$. Put a second wire in that field and it feels $I\\,\\vec L\\times\\vec B$: parallel currents attract. Ampère's law, $\\oint \\vec B\\cdot d\\vec l = \\mu_0 I_{enc}$, is the shortcut when the shape is symmetric.</p>" +
      '<div class="trap"><b>JEE trap: $\\mu_0 I/2\\pi r$ against $\\mu_0 I/2R$.</b> The straight wire has the $\\pi$; the loop centre doesn\'t, so a loop gives $\\pi$ times the field of a straight wire at the same distance. And parallel currents <i>attract</i>, the opposite of like charges.</div>');

    function apply(s) {
      setMode(s.mode);
      IS.set(s.I); dir = s.dir || 1; setSeg(dirSeg, dir);
      if (s.I2 != null) I2S.set(s.I2);
      if (s.same != null) { same = s.same; setSeg(sameSeg, same ? "same" : "opp"); }
      if (s.d != null) dS.set(s.d);
      if (s.R != null) RS.set(s.R);
      if (s.N != null) NS.set(s.N);
      if (s.a != null) aS.set(s.a);
      if (s.probe) probe = { x: s.probe[0], y: s.probe[1] };
      st = null; reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "long straight wire", setup: { mode: "wire", I: 10, dir: 1, probe: [5, 0] }, watch: "Predict B, then switch on and read the probe",
        q: "A long straight wire carries 10 A. What is the magnetic field 5 cm from it? ($\\mu_0 = 4\\pi\\times10^{-7}$ T m/A)",
        options: ["40 µT", "80 µT", "126 µT", "4 µT"], answer: 0,
        explain: "$B = \\dfrac{\\mu_0 I}{2\\pi r} = \\dfrac{4\\pi\\times10^{-7}\\times 10}{2\\pi\\times 0.05} = 4\\times10^{-5}$ T $= 40$ µT. Dropping the $2\\pi$ but keeping the 2, as in the loop formula, gives 126 µT." },
      { level: "medium", tag: "parallel wires", setup: { mode: "pair", I: 10, dir: 1, I2: 5, same: true, d: 4, probe: [0, 4] }, watch: "Read the force per length, then switch on and release",
        q: "Two long parallel wires 4 cm apart carry 10 A and 5 A in the same direction. What is the force per metre on each, and is it attraction or repulsion?",
        options: ["$2.5\\times10^{-4}$ N/m, attraction", "$2.5\\times10^{-4}$ N/m, repulsion", "$1.6\\times10^{-3}$ N/m, attraction", "$1.25\\times10^{-4}$ N/m on the 5 A wire only"], answer: 0,
        hints: ["Find the field of one wire where the other one sits: $B_1 = \\mu_0 I_1/2\\pi d$.", "The other wire feels $F/L = I_2 B_1$. Use the right-hand rule (or remember: parallel currents attract)."],
        explain: "$B_1 = \\dfrac{4\\pi\\times10^{-7}\\times10}{2\\pi\\times0.04} = 5\\times10^{-5}$ T, so $F/L = 5\\times 5\\times10^{-5} = 2.5\\times10^{-4}$ N/m. Currents in the same direction attract, and by Newton's third law both wires feel the same force, even though the currents differ." },
      { level: "hard", tag: "where the field vanishes", setup: { mode: "pair", I: 5, dir: 1, I2: 3, same: false, d: 10, probe: [12, 0] }, watch: "Drag the probe along the line through the wires and find where it reads zero",
        q: "Two long parallel wires 10 cm apart carry 5 A and 3 A in opposite directions. Where on the line through them is the magnetic field zero?",
        options: ["15 cm beyond the 3 A wire", "3.75 cm from the 3 A wire, between them", "15 cm beyond the 5 A wire", "Nowhere: opposite currents never cancel"], answer: 0,
        hints: ["Between opposite currents both fields point the same way, so they can only cancel outside, on the side of the weaker current.", "At a distance $x$ beyond the 3 A wire: $\\dfrac{\\mu_0 (5)}{2\\pi(10 + x)} = \\dfrac{\\mu_0 (3)}{2\\pi x}$."],
        explain: "Outside, nearer the smaller current, the two fields point opposite ways. $5x = 3(10 + x)$ gives $x = 15$ cm beyond the 3 A wire (25 cm from the 5 A wire). The 3.75 cm answer is where they'd cancel if the currents were in the same direction." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var tOpts = { playLabel: "Switch on", onReset: reset, onPlay: function () { if (st.done || (st.p.mode === "pair" && st.pairRec.length > 1)) reset(); } };
    var transportUI = null;
    transportUI = K.transport(P, sim, tOpts);
    showGroups();
    reset();

    if (location.hostname === "localhost") window.__lab_biotsavart = {
      apply: apply, st: function () { return st; }, Bat: function (x, y) { return Bat(st.src, x, y); }, F: function () { return F(st.p); },
      setProbe: function (x, y) { probe = { x: x, y: y }; probeNeedle.b = Bat(st.src, x, y); probed(); },
      setAmp: function (x, y, rho, ws) { amp = { x: x, y: y }; if (rho) rhoS.set(rho); if (ws) wires = ws.map(function (w) { return Object.assign({}, w); }); reset(); },
      pairForce: function () { return pairForce({ x1: -st.p.d / 2, x2: st.p.d / 2 }); }, ampTotal: function () { return ampTotal() / MU0; }, tries: tries, lines: function () { return lines; }
    };

    return function destroy() { clearTimeout(lineTimer); sim.destroy(); [g1, g2].forEach(function (g) { g.destroy(); }); if (window.__lab_biotsavart) delete window.__lab_biotsavart; };
  }
})();
