/* Electrostatics, lab 2: field lines, equipotentials, a test charge set loose, and Gauss's law on a loop you can reshape. */
(function () {
  "use strict";
  // Charges in μC (rods: μC/m), distances in m, k = 9×10⁹ N m²/C².
  // Point charge: E = 9q/r² kN/C, V = 9q/r kV.  Long rod: E = 18λ/r kN/C, V = -18λ ln(r / 1 m) kV.
  // Test charge q_t in μC, mass in g: a = q_t E / m (m/s²), U = q_t V (mJ), KE = ½ m v² (mJ).
  var FOURPIK = 36 * Math.PI;             // flux per μC/m in kN·m/C: λ/ε₀ = 4πkλ
  var R_HIT = 0.06;

  var PRESETS = {
    dipole: [{ x: 2.2, y: 1.6, q: 2 }, { x: 4, y: 1.6, q: -2 }],
    like: [{ x: 2, y: 1.6, q: 2 }, { x: 4, y: 1.6, q: 2 }],
    unequal: [{ x: 2, y: 1.6, q: 3 }, { x: 4, y: 1.6, q: -1 }],
    single: [{ x: 3, y: 1.6, q: 2 }]
  };

  var lab = {
    id: "fieldlines", chapter: "electrostatics", title: "Field, potential & Gauss's law", short: "field lines, equipotentials, flux",
    lede: "Move the charges and the field lines and equipotentials redraw themselves. Let a test charge go and watch $qV + \\tfrac12 mv^2$ stay fixed, then wrap a loop around a charge and stretch it any way you like: the flux won't budge.",
    tries: [
      { id: "energy", title: "Let a test charge go and keep the books",
        text: "Drag the probe somewhere, press Release, and watch the energy graph for at least a second.",
        why: "The field does work $-q\\Delta V$ on the charge, so $qV + \\tfrac12 mv^2$ is constant. It speeds up wherever it falls to lower potential energy, just like a ball rolling downhill." },
      { id: "zeroE", title: "Find a point where E = 0",
        text: "With two or more charges, drag the probe to where the field vanishes.",
        why: "Between two equal like charges the pushes cancel at the midpoint, yet $V = 2kq/r$ there, not zero. Zero field says nothing about zero potential, and the other way round (the middle of a dipole has $V = 0$ but a strong $E$)." },
      { id: "shape", title: "Stretch the loop, keep the flux",
        text: "In line-charge mode, put the Gaussian loop round a charge, then drag its corners to change its perimeter by at least a quarter.",
        why: "Every field line that leaves the charge must cross the loop exactly once, whatever its shape. So $\\oint \\vec E\\cdot\\hat n\\,dl = \\lambda_{enc}/\\varepsilon_0$ depends only on what's inside." },
      { id: "zeroflux", title: "Lines through, but no net flux",
        text: "Place the loop so field lines cross it but the charge inside adds up to zero (a whole dipole, or no charge at all).",
        why: "Every line that comes in also goes out, so the inward and outward flux cancel. Zero flux doesn't mean zero field on the loop." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 540, ppm = 150, origin = { x: 60, y: 500 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 0.1, gridMajor: 1, yLabels: false });
    var X0 = -origin.x / ppm, X1 = (W - origin.x) / ppm, Y0 = (origin.y - H) / ppm, Y1 = origin.y / ppm;
    var SNAP = 0.05;

    /* ---------- state ---------- */
    var mode = "point", charges = [], sel = 0, probe = { x: 3.1, y: 2.4 }, test = null, loopOn = false, loop = [], show = { lines: true, eq: true };
    var cache = null, fluxLog = {}, fluxPts = [], fluxNow = null;

    /* ---------- controls ---------- */
    var qS = K.slider({ label: "Selected charge $q$", unit: "μC", min: -5, max: 5, step: 0.5, value: 2,
      onInput: function (v) { if (charges[sel]) { charges[sel].q = v; edited(); } } });
    var qtS = K.slider({ label: "Test charge $q_t$", unit: "μC", min: -1, max: 1, step: 0.1, value: 0.5, onInput: function () { resetTest(); } });
    var mS = K.slider({ label: "Test mass $m$", unit: "g", min: 1, max: 10, step: 1, value: 1, onInput: function () { resetTest(); } });
    P.controls.innerHTML = "<h3>Field of</h3>";
    var modeSeg = K.seg([{ label: "Point charges", value: "point" }, { label: "Line charges (2D)", value: "line" }], "point", function (v) { setMode(v); }, "Field model");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h('<p class="control-hint">Line charges: each dot is a long rod through the screen, so the field really is flat (E ∝ 1/r).</p>'));
    P.controls.appendChild(K.h("<h3>Charges</h3>"));
    var preSeg = K.seg([{ label: "Dipole", value: "dipole" }, { label: "Like pair", value: "like" }, { label: "+3 & −1", value: "unequal" }, { label: "One", value: "single" }], "dipole",
      function (v) { loadCharges(PRESETS[v]); }, "Preset");
    P.controls.appendChild(preSeg);
    P.controls.appendChild(qS.el);
    var btns = K.h('<div class="row"></div>');
    [["+ Positive", 1], ["+ Negative", -1], ["Remove", 0]].forEach(function (b) {
      var el = K.h('<button class="btn btn-sm" type="button">' + b[0] + "</button>");
      el.addEventListener("click", function () {
        if (b[1]) { charges.push({ x: 3, y: 2.8, q: b[1] }); sel = charges.length - 1; }
        else if (charges.length > 1) { charges.splice(sel, 1); sel = 0; }
        syncSel(); edited();
      });
      btns.appendChild(el);
    });
    P.controls.appendChild(btns);
    P.controls.appendChild(K.h("<h3>Test charge</h3>"));
    [qtS, mS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Field lines", true, function (v) { show.lines = v; }));
    row.appendChild(K.check("Equipotentials", true, function (v) { show.eq = v; }));
    var loopBox = K.check("Gaussian loop", false, function (v) { loopOn = v; if (v && mode !== "line") { setMode("line"); K.flash(P.note, "Gauss on a flat loop needs the 2D field: switched to line charges", 3500); } edited(); });
    row.appendChild(loopBox);
    P.controls.appendChild(row);
    var loopBtn = K.h('<button class="btn btn-sm" type="button">Reset loop round the selected charge</button>');
    loopBtn.addEventListener("click", function () { makeLoop(charges[sel] || probe, 0.7); edited(); });
    P.controls.appendChild(loopBtn);
    P.controls.appendChild(K.h('<p class="control-hint">Drag charges, the probe ◆ (where the test charge starts) and the loop\'s corners. Drag inside the loop to move it whole.</p>'));
    P.controls.appendChild(K.h('<div class="legend"><span class="c-fric"><i></i>positive</span><span class="c-disp"><i></i>negative</span>' +
      '<span class="c-acc"><i></i>field E</span><span class="c-grav"><i></i>equipotential V</span><span class="c-vel"><i></i>velocity</span></div>'));

    function pressSeg(seg, v) { seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }
    function setMode(v) {
      mode = v; pressSeg(modeSeg, v);
      if (v !== "line" && loopOn) { loopOn = false; loopBox.querySelector("input").checked = false; }
      fluxLog = {}; fluxPts = [];
      edited();
    }
    function loadCharges(list) { charges = list.map(function (c) { return { x: c.x, y: c.y, q: c.q }; }); sel = 0; syncSel(); fluxLog = {}; fluxPts = []; edited(); }
    function syncSel() { if (charges[sel]) qS.set(charges[sel].q); }
    function makeLoop(c, r) {
      loop = [];
      for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; loop.push({ x: +(c.x + r * Math.cos(a)).toFixed(3), y: +(c.y + r * Math.sin(a)).toFixed(3) }); }
    }

    /* ---------- physics ---------- */
    function field(x, y) {
      var Ex = 0, Ey = 0, V = 0, rmin = 1e9, big = 0;
      for (var i = 0; i < charges.length; i++) {
        var c = charges[i], dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), e;
        if (r < rmin) rmin = r;
        if (mode === "point") { e = 9 * c.q / r2; V += 9 * c.q / r; }
        else { e = 18 * c.q / r; V += -18 * c.q * Math.log(r); }
        Ex += e * dx / r; Ey += e * dy / r; big = Math.max(big, Math.abs(e));
      }
      return { x: Ex, y: Ey, mag: Math.hypot(Ex, Ey), V: V, rmin: rmin, big: big };
    }

    /* the test charge: RK4 with steps small enough near the charges */
    function resetTest() {
      sim.pause(); if (transportUI) transportUI.render(); sim.resetClock(); P.time.textContent = "t = 0.00 s";
      var f = field(probe.x, probe.y), qt = qtS.get();
      test = { x: probe.x, y: probe.y, vx: 0, vy: 0, E0: qt * f.V, t: [0], ke: [0], u: [qt * f.V], path: [[probe.x, probe.y]], vmax: 0, xAtVmax: probe.x, done: false, maxDrift: 0, keMax: 0 };
      update(true);
    }
    function acc(x, y) { var f = field(x, y), k = qtS.get() / mS.get(); return { ax: k * f.x, ay: k * f.y, rmin: f.rmin }; }
    function rk4(h) {
      var s = test, a1 = acc(s.x, s.y);
      var x2 = s.x + s.vx * h / 2, y2 = s.y + s.vy * h / 2, vx2 = s.vx + a1.ax * h / 2, vy2 = s.vy + a1.ay * h / 2, a2 = acc(x2, y2);
      var x3 = s.x + vx2 * h / 2, y3 = s.y + vy2 * h / 2, vx3 = s.vx + a2.ax * h / 2, vy3 = s.vy + a2.ay * h / 2, a3 = acc(x3, y3);
      var x4 = s.x + vx3 * h, y4 = s.y + vy3 * h, vx4 = s.vx + a3.ax * h, vy4 = s.vy + a3.ay * h, a4 = acc(x4, y4);
      s.x += h / 6 * (s.vx + 2 * vx2 + 2 * vx3 + vx4); s.y += h / 6 * (s.vy + 2 * vy2 + 2 * vy3 + vy4);
      s.vx += h / 6 * (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax); s.vy += h / 6 * (a1.ay + 2 * a2.ay + 2 * a3.ay + a4.ay);
      return a1;
    }
    sim.on("before", function () {
      if (!test || test.done) return;
      var left = K.DT, guard = 0, vPrev = test.vx;
      while (left > 1e-12 && guard++ < 20000) {
        var a = acc(test.x, test.y), v = Math.hypot(test.vx, test.vy), am = Math.hypot(a.ax, a.ay);
        var h = Math.min(left, 0.004 * a.rmin / (v + Math.sqrt(am * a.rmin) + 1e-9));
        rk4(h); left -= h;
        var sp = Math.hypot(test.vx, test.vy);
        if (sp > test.vmax) { test.vmax = sp; test.xAtVmax = test.x; test.yAtVmax = test.y; }
        if (vPrev * test.vx < 0) test.turned = true;
        vPrev = test.vx;
        var f = field(test.x, test.y);
        if (f.rmin < R_HIT) { finish("hit"); break; }
        if (test.x < X0 - 0.5 || test.x > X1 + 0.5 || test.y < Y0 - 0.5 || test.y > Y1 + 0.5) { finish("away"); break; }
      }
    });
    sim.on("step", function (t) {
      if (!test) return;
      var f = field(test.x, test.y), qt = qtS.get(), ke = 0.5 * mS.get() * (test.vx * test.vx + test.vy * test.vy), u = qt * f.V;
      test.t.push(t); test.ke.push(ke); test.u.push(u); test.path.push([test.x, test.y]);
      test.keMax = Math.max(test.keMax, ke);
      test.maxDrift = Math.max(test.maxDrift, Math.abs(ke + u - test.E0));
      if (t >= 1 && test.keMax > 1e-6 && test.maxDrift < 1e-3 * (Math.abs(test.E0) + test.keMax)) tries.mark("energy");
      if (t >= 30) finish("time");
      update();
    });
    function finish(why) {
      if (test.done) return;
      test.done = true; sim.pause(); transportUI.render();
      K.flash(P.note, why === "hit" ? "It reached a charge" : why === "away" ? "Off the stage" : "30 s: press Reset");
    }

    /* ---------- Gauss: flux through the loop, integrated numerically ---------- */
    function polyArea(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
    function inside(pt, pts) {
      var c = false;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var a = pts[i], b = pts[j];
        if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    }
    function segDist(c, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, t = K.clamp(((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(a.x + t * dx - c.x, a.y + t * dy - c.y);
    }
    function flux() {
      if (!loop.length) return null;
      var sgn = polyArea(loop) >= 0 ? 1 : -1, tot = 0, out = 0, inn = 0, per = 0;
      for (var i = 0; i < loop.length; i++) {
        var a = loop[i], b = loop[(i + 1) % loop.length], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;
        per += len;
        var nx = sgn * dy / len, ny = -sgn * dx / len;      // outward normal
        var dmin = charges.reduce(function (m, c) { return Math.min(m, segDist(c, a, b)); }, 1e9);
        var n = Math.min(40000, Math.max(60, Math.ceil(len / (0.02 * Math.max(dmin, 1e-4))))); if (n % 2) n++;
        var hs = len / n, sum = 0;
        for (var k = 0; k <= n; k++) {                        // Simpson's rule along the edge
          var f = field(a.x + dx * k / n, a.y + dy * k / n), en = f.x * nx + f.y * ny, w = (k === 0 || k === n) ? 1 : (k % 2 ? 4 : 2);
          sum += w * en;
          if (en > 0) out += w * en * hs / 3; else inn -= w * en * hs / 3;
        }
        tot += sum * hs / 3;
      }
      var enc = charges.filter(function (c) { return inside(c, loop); }), lam = enc.reduce(function (s, c) { return s + c.q; }, 0);
      return { phi: tot, out: out, inn: inn, per: per, enc: enc, lam: lam, want: FOURPIK * lam, key: enc.map(function (c) { return charges.indexOf(c) + ":" + c.q; }).join(",") };
    }

    /* ---------- field lines and equipotentials, recomputed when something moves ---------- */
    function nice(x) { var m = Math.pow(10, Math.floor(Math.log10(x))), r = x / m; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * m; }
    function rebuild() {
      var lines = [], segs = [];
      if (charges.length) {
        var pos = charges.filter(function (c) { return c.q > 0; }), neg = charges.filter(function (c) { return c.q < 0; });
        var sp = pos.reduce(function (s, c) { return s + c.q; }, 0), sn = -neg.reduce(function (s, c) { return s + c.q; }, 0);
        var seeds = sp >= sn ? pos : neg, dir = sp >= sn ? 1 : -1;
        seeds.forEach(function (c) {
          var n = Math.max(4, Math.round(6 * Math.abs(c.q)));
          for (var k = 0; k < n; k++) {
            var a = (k + 0.5) / n * Math.PI * 2, x = c.x + 0.07 * Math.cos(a), y = c.y + 0.07 * Math.sin(a), pts = [[c.x, c.y], [x, y]], ds = 0.02;
            for (var s = 0; s < 900; s++) {
              var f1 = field(x, y); if (!f1.mag) break;
              var mx = x + dir * f1.x / f1.mag * ds / 2, my = y + dir * f1.y / f1.mag * ds / 2, f2 = field(mx, my); if (!f2.mag) break;
              x += dir * f2.x / f2.mag * ds; y += dir * f2.y / f2.mag * ds;
              pts.push([x, y]);
              var end = charges.filter(function (o) { return o.q * dir < 0 && Math.hypot(o.x - x, o.y - y) < 0.06; })[0];
              if (end) { pts.push([end.x, end.y]); break; }
              if (x < X0 - 1.5 || x > X1 + 1.5 || y < Y0 - 1.5 || y > Y1 + 1.5) break;
            }
            lines.push({ pts: pts, dir: dir });
          }
        });
        // equipotentials by marching squares
        var qm = charges.reduce(function (m, c) { return Math.max(m, Math.abs(c.q)); }, 0.5);
        var dV = mode === "point" ? nice(9 * qm / 3) : nice(18 * qm * 0.3), cell = 10 / ppm;
        var nx = Math.ceil((X1 - X0) / cell) + 1, ny = Math.ceil((Y1 - Y0) / cell) + 1, grid = [];
        for (var j = 0; j < ny; j++) { grid.push([]); for (var i = 0; i < nx; i++) grid[j].push(field(X0 + i * cell, Y0 + j * cell).V); }
        for (var L = -14; L <= 14; L++) {
          var lv = L * dV;
          for (j = 0; j < ny - 1; j++) for (i = 0; i < nx - 1; i++) {
            var v0 = grid[j][i], v1 = grid[j][i + 1], v2 = grid[j + 1][i + 1], v3 = grid[j + 1][i], idx = 0;
            if (v0 > lv) idx |= 1; if (v1 > lv) idx |= 2; if (v2 > lv) idx |= 4; if (v3 > lv) idx |= 8;
            if (idx === 0 || idx === 15) continue;
            var x0 = X0 + i * cell, y0 = Y0 + j * cell, e = [];
            var edge = function (va, vb, ax, ay, bx, by) { var t = (lv - va) / (vb - va); e.push([ax + (bx - ax) * t, ay + (by - ay) * t]); };
            if ((v0 > lv) !== (v1 > lv)) edge(v0, v1, x0, y0, x0 + cell, y0);
            if ((v1 > lv) !== (v2 > lv)) edge(v1, v2, x0 + cell, y0, x0 + cell, y0 + cell);
            if ((v2 > lv) !== (v3 > lv)) edge(v2, v3, x0 + cell, y0 + cell, x0, y0 + cell);
            if ((v3 > lv) !== (v0 > lv)) edge(v3, v0, x0, y0 + cell, x0, y0);
            if (e.length >= 2) segs.push([e[0], e[1], L]);
            if (e.length === 4) segs.push([e[2], e[3], L]);
          }
        }
      }
      cache = { lines: lines, segs: segs, dV: mode === "point" ? nice(9 * Math.max(0.5, maxQ()) / 3) : nice(18 * Math.max(0.5, maxQ()) * 0.3) };
    }
    function maxQ() { return charges.reduce(function (m, c) { return Math.max(m, Math.abs(c.q)); }, 0); }

    function edited(fromDrag) {
      rebuild();
      if (!sim.running) resetTest();
      var f = field(probe.x, probe.y);
      if (fromDrag !== "keepTry" && charges.length >= 2 && f.big > 0 && f.mag < 0.02 * f.big && f.rmin > 0.1) {
        tries.mark("zeroE"); K.flash(P.note, "E = 0 here, but V = " + K.fmt(f.V, 1) + " kV");
      }
      fluxNow = loopOn && mode === "line" ? flux() : null;
      if (fluxNow) {
        var fl = fluxNow;
        if (fl) {
          fluxPts.push([fl.per, fl.phi]); if (fluxPts.length > 300) fluxPts.shift();
          if (fl.enc.length && Math.abs(fl.lam) > 1e-9 && Math.abs(fl.phi - fl.want) < 0.005 * Math.abs(fl.want)) {
            var lg = fluxLog[fl.key] = fluxLog[fl.key] || { lo: fl.per, hi: fl.per };
            lg.lo = Math.min(lg.lo, fl.per); lg.hi = Math.max(lg.hi, fl.per);
            if (lg.hi >= 1.25 * lg.lo) tries.mark("shape");
          }
          if (Math.abs(fl.lam) < 1e-9 && fl.out > 0.1 * FOURPIK * Math.max(0.5, maxQ())) tries.mark("zeroflux");
        }
      }
      update(true);
    }

    /* ---------- dragging ---------- */
    var drag = null;
    function snap(v) { return +(Math.round(v / SNAP) * SNAP).toFixed(4); }
    sim.pointer({
      down: function (pt) {
        var m = pt.m, tol = Math.max(0.14, sim.u(16) / ppm), hit = null;
        if (Math.hypot(m.x - probe.x, m.y - probe.y) < tol) hit = { kind: "probe" };
        charges.forEach(function (c, i) { if (!hit && Math.hypot(m.x - c.x, m.y - c.y) < tol) hit = { kind: "charge", i: i }; });
        if (!hit && loopOn) {
          loop.forEach(function (v, i) { if (!hit && Math.hypot(m.x - v.x, m.y - v.y) < tol) hit = { kind: "vertex", i: i }; });
          if (!hit && inside(m, loop)) hit = { kind: "loop", from: m, start: loop.map(function (v) { return { x: v.x, y: v.y }; }) };
        }
        if (!hit) return false;
        if (sim.running || (test && test.t.length > 1)) { sim.pause(); transportUI.render(); }
        if (hit.kind === "charge") { sel = hit.i; syncSel(); }
        drag = hit;
        return true;
      },
      drag: function (pt) {
        if (!drag) return;
        var m = pt.m, x = K.clamp(snap(m.x), 0, X1 - 0.1), y = K.clamp(snap(m.y), 0.05, Y1 - 0.05);
        if (drag.kind === "probe") { probe.x = x; probe.y = y; }
        else if (drag.kind === "charge") {
          if (charges.some(function (o, j) { return j !== drag.i && Math.hypot(o.x - x, o.y - y) < 0.15; })) return;
          charges[drag.i].x = x; charges[drag.i].y = y;
        } else if (drag.kind === "vertex") { loop[drag.i].x = x; loop[drag.i].y = y; }
        else {
          var dx = snap(m.x - drag.from.x), dy = snap(m.y - drag.from.y);
          loop = drag.start.map(function (v) { return { x: +(v.x + dx).toFixed(4), y: +(v.y + dy).toFixed(4) }; });
        }
        edited();
      },
      up: function () { drag = null; }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      if (!cache) return;
      if (show.eq) {
        ctx.lineWidth = sim.u(1.3);
        cache.segs.forEach(function (s) {
          ctx.strokeStyle = s[2] === 0 ? K.alpha(th.grav, 0.9) : K.alpha(th.grav, 0.45);
          var a = sim.px(s[0][0], s[0][1]), b = sim.px(s[1][0], s[1][1]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      }
      if (show.lines) {
        ctx.strokeStyle = K.alpha(th.acc, 0.75); ctx.fillStyle = K.alpha(th.acc, 0.9); ctx.lineWidth = sim.u(1.4);
        cache.lines.forEach(function (l) {
          ctx.beginPath();
          l.pts.forEach(function (p, i) { var q = sim.px(p[0], p[1]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
          ctx.stroke();
          for (var k = 30; k < l.pts.length - 2; k += 90) {        // arrowheads point along E
            var a = sim.px(l.pts[k][0], l.pts[k][1]), b = sim.px(l.pts[k + 1][0], l.pts[k + 1][1]);
            var ux = (b.x - a.x) * l.dir, uy = (b.y - a.y) * l.dir, len = Math.hypot(ux, uy); if (!len) continue;
            ux /= len; uy /= len; var s = sim.u(6);
            ctx.beginPath(); ctx.moveTo(a.x + ux * s, a.y + uy * s); ctx.lineTo(a.x - ux * s - uy * s * 0.6, a.y - uy * s + ux * s * 0.6); ctx.lineTo(a.x - ux * s + uy * s * 0.6, a.y - uy * s - ux * s * 0.6); ctx.closePath(); ctx.fill();
          }
        });
      }
      if (loopOn && loop.length) {
        ctx.fillStyle = K.alpha(th.normal, 0.08); ctx.strokeStyle = th.normal; ctx.lineWidth = sim.u(2.5);
        ctx.beginPath(); loop.forEach(function (v, i) { var q = sim.px(v.x, v.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = th.normal;
        loop.forEach(function (v) { var q = sim.px(v.x, v.y); ctx.beginPath(); ctx.arc(q.x, q.y, sim.u(5), 0, Math.PI * 2); ctx.fill(); });
        var fl = fluxNow, top = loop.reduce(function (a, v) { return v.y > a.y ? v : a; }, loop[0]), tp = sim.px(top.x, top.y);
        if (fl) K.label(ctx, "Φ = " + K.fmt(fl.phi, 1) + " kN·m/C", tp.x, tp.y - sim.u(10), th.normal, { s: sim.u(1), bg: true });
      }
    });
    sim.on("over", function (ctx) {
      charges.forEach(function (c, i) {
        var p = sim.px(c.x, c.y), r = sim.u(13);
        if (i === sel) { ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.arc(p.x, p.y, r + sim.u(5), 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = c.q > 0 ? th.fric : c.q < 0 ? th.disp : th.muted; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = sim.u(2.5); ctx.beginPath(); ctx.moveTo(p.x - r * 0.5, p.y); ctx.lineTo(p.x + r * 0.5, p.y);
        if (c.q > 0) { ctx.moveTo(p.x, p.y - r * 0.5); ctx.lineTo(p.x, p.y + r * 0.5); } ctx.stroke();
        K.label(ctx, (c.q > 0 ? "+" : "") + K.fmt(c.q, 1) + (mode === "point" ? " μC" : " μC/m"), p.x, p.y + r + sim.u(20), th.ink, { s: sim.u(0.85), bg: true });
      });
      // the probe: E arrow (log-scaled so it stays readable) and V
      var f = field(probe.x, probe.y), pp = sim.px(probe.x, probe.y), s = sim.u(8);
      if (f.mag > 1e-9) {
        var L = sim.u(Math.min(90, 22 * Math.log(1 + f.mag / 2)));
        K.arrow(ctx, pp.x, pp.y, pp.x + f.x / f.mag * L, pp.y - f.y / f.mag * L, th.acc, { s: sim.u(1), width: 3, label: "E " + K.fmt(f.mag, 1) + " kN/C" });
      }
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(pp.x, pp.y - s); ctx.lineTo(pp.x + s, pp.y); ctx.lineTo(pp.x, pp.y + s); ctx.lineTo(pp.x - s, pp.y); ctx.closePath(); ctx.fill();
      K.label(ctx, "V = " + K.fmt(f.V, 1) + " kV", pp.x, pp.y + sim.u(26), th.grav, { s: sim.u(0.9), bg: true });
      if (test && test.path.length > 1) {
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2); ctx.beginPath();
        test.path.forEach(function (q, i) { var a = sim.px(q[0], q[1]); if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); }); ctx.stroke();
        var tp = sim.px(test.x, test.y);
        ctx.fillStyle = qtS.get() >= 0 ? th.fric : th.disp; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
        ctx.beginPath(); ctx.arc(tp.x, tp.y, sim.u(7), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        var sp = Math.hypot(test.vx, test.vy);
        if (sp > 0.05) K.arrow(ctx, tp.x, tp.y, tp.x + test.vx / sp * sim.u(16 + 6 * sp), tp.y - test.vy / sp * sim.u(16 + 6 * sp), th.vel, { s: sim.u(1), label: K.fmt(sp, 2) + " m/s" });
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">KE</b>, <b class="c-grav">U = qV</b> and their sum · the sum stays flat (dashed: its starting value)</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">V along the probe\'s line</b> · steep where the equipotentials crowd, i.e. where E is strong</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-normal">Flux vs loop perimeter</b> · dots: every loop you\'ve drawn; dashed: $\\lambda_{enc}/\\varepsilon_0$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gE = new K.Graph(cv[0], { yLabel: "E (mJ)", xMax: 2, xAuto: true, color: th.ink });
    var gV = new K.Graph(cv[1], { yLabel: "V (kV)", xLabel: "x (m)", xMax: 6, color: th.grav });
    var gP = new K.Graph(cv[2], { yLabel: "Φ (kN·m/C)", xLabel: "perimeter (m)", xMax: 8, color: th.normal });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      if (test) {
        gE.set("ke", { points: test.t.map(function (t, i) { return [t, test.ke[i]]; }), color: th.vel, width: 2.5 });
        gE.set("u", { points: test.t.map(function (t, i) { return [t, test.u[i]]; }), color: th.grav, width: 2.5 });
        gE.set("tot", { points: test.t.map(function (t, i) { return [t, test.ke[i] + test.u[i]]; }), color: th.ink, width: 2.5, dot: true });
        var tEnd = Math.max(2, test.t[test.t.length - 1]);
        gE.set("tot0", { points: [[0, test.E0], [tEnd, test.E0]], color: th.ink, dash: [5, 5], width: 1.5 });
      }
      var cap = 14 * (cache ? cache.dV : 10), vp = [];
      for (var x = 0; x <= 6 + 1e-9; x += 0.01) vp.push([x, K.clamp(field(x, probe.y).V, -cap, cap)]);
      gV.set("theory", { points: vp, color: th.grav, dash: [5, 5], width: 1.5 });
      var fp = field(probe.x, probe.y);
      gV.extra = function (ctx, X, Y) { ring(ctx, X(probe.x), Y(K.clamp(fp.V, -cap, cap))); };
      var fl = fluxNow;
      gP.clear();
      if (fl) {
        gP.set("want", { points: [[0, fl.want], [8, fl.want]], color: th.normal, dash: [5, 5], width: 1.5 });
        gP.extra = function (ctx, X, Y) {
          ctx.fillStyle = K.alpha(th.normal, 0.6);
          fluxPts.forEach(function (q) { if (q[0] <= 8) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 3, 0, Math.PI * 2); ctx.fill(); } });
          if (fl.per <= 8) ring(ctx, X(fl.per), Y(fl.phi));
        };
      } else gP.extra = function (ctx) { ctx.fillStyle = th.muted; ctx.font = "600 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("Tick Gaussian loop to measure flux", gP.w / 2 + 16, gP.h / 2); };
      [gE, gV, gP].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Field at the probe: add the arrows", "Potential at the probe: add the numbers", "Energy of the test charge", "Gauss's law for the loop"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "E", label: "E at probe", cls: "c-acc" }, { id: "V", label: "V at probe", cls: "c-grav" }, { id: "v", label: "test charge speed", cls: "c-vel" },
      { id: "vmax", label: "top speed so far", cls: "c-vel" }, { id: "tot", label: "qV + ½mv²" }, { id: "phi", label: "flux through loop", cls: "c-normal" },
      { id: "enc", label: "λ_enc / ε₀", cls: "c-normal" }
    ]);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var f = field(probe.x, probe.y), list = charges.slice(0, 3), more = charges.length > 3 ? " + \\dots" : "";
      var rs = list.map(function (c) { return Math.hypot(probe.x - c.x, probe.y - c.y); });
      if (mode === "point") {
        K.tex(eqEls[0], "\\vec E = \\sum \\frac{kq_i}{r_i^2}\\hat r_i:\\ " + list.map(function (c, i) { return "\\frac{9(" + n(c.q, 1) + ")}{" + K.fmt(rs[i], 2) + "^2}"; }).join(",\\ ") + more + "\\ \\text{kN/C} \\Rightarrow |\\vec E| = \\mathbf{" + K.fmt(f.mag, 1) + "}\\ \\text{kN/C}");
        K.tex(eqEls[1], "V = \\sum \\frac{kq_i}{r_i} = " + list.map(function (c, i) { return "\\frac{9(" + n(c.q, 1) + ")}{" + K.fmt(rs[i], 2) + "}"; }).join(" + ") + more + " = \\mathbf{" + K.fmt(f.V, 1) + "}\\ \\text{kV}");
      } else {
        K.tex(eqEls[0], "\\vec E = \\sum \\frac{2k\\lambda_i}{r_i}\\hat r_i:\\ " + list.map(function (c, i) { return "\\frac{18(" + n(c.q, 1) + ")}{" + K.fmt(rs[i], 2) + "}"; }).join(",\\ ") + more + "\\ \\text{kN/C} \\Rightarrow |\\vec E| = \\mathbf{" + K.fmt(f.mag, 1) + "}\\ \\text{kN/C}");
        K.tex(eqEls[1], "V = -\\sum 2k\\lambda_i \\ln\\frac{r_i}{1\\,\\text{m}} = " + list.map(function (c, i) { return "-18(" + n(c.q, 1) + ")\\ln" + K.fmt(rs[i], 2); }).join(" ") + more + " = \\mathbf{" + K.fmt(f.V, 1) + "}\\ \\text{kV}");
      }
      var qt = qtS.get(), m = mS.get();
      if (test) {
        var ke = 0.5 * m * (test.vx * test.vx + test.vy * test.vy), u = qt * field(test.x, test.y).V;
        K.tex(eqEls[2], "q_tV_0 = q_tV + \\tfrac12 mv^2:\\ " + n(test.E0, 2) + " = " + n(u, 2) + " + " + K.fmt(ke, 2) + " = \\mathbf{" + K.fmt(u + ke, 2) + "}\\ \\text{mJ}");
        setR("v", K.fmt(Math.hypot(test.vx, test.vy), 2) + " m/s", "formula √(2q(V₀−V)/m) = " + K.fmt(Math.sqrt(Math.max(0, 2 * (test.E0 - u) / m)), 2));
        setR("vmax", K.fmt(test.vmax, 2) + " m/s", test.vmax > 0 ? "at x = " + K.fmt(test.xAtVmax, 2) + " m" : "");
        setR("tot", K.fmt(u + ke, 3) + " mJ", "start " + K.fmt(test.E0, 3) + " mJ");
      }
      var fl = fluxNow;
      if (fl) {
        K.tex(eqEls[3], "\\oint \\vec E\\cdot\\hat n\\,dl = \\frac{\\lambda_{enc}}{\\varepsilon_0} = 4\\pi k\\lambda_{enc} = 4\\pi(9\\times10^9)(" + n(fl.lam, 1) + "\\times10^{-6}) = \\mathbf{" + K.fmt(fl.want, 1) + "}\\ \\text{kN·m/C}");
        setR("phi", K.fmt(fl.phi, 1) + " kN·m/C", "out " + K.fmt(fl.out, 1) + ", in " + K.fmt(fl.inn, 1) + ", per metre of rod");
        setR("enc", K.fmt(fl.want, 1) + " kN·m/C", "λ_enc = " + K.fmt(fl.lam, 1) + " μC/m");
      } else {
        K.tex(eqEls[3], "\\oint \\vec E\\cdot d\\vec A = \\frac{q_{enc}}{\\varepsilon_0}\\quad\\text{(tick Gaussian loop to test it on line charges)}");
        setR("phi", "—", "loop off"); setR("enc", "—");
      }
      setR("E", K.fmt(f.mag, 1) + " kN/C", f.mag > 1e-9 ? "at " + K.fmt(Math.atan2(f.y, f.x) / K.DEG, 0) + "° to +x" : "zero field");
      setR("V", K.fmt(f.V, 1) + " kV", mode === "line" ? "zero at 1 m from each rod" : "zero far away");
      P.hud.innerHTML = "<span>" + (mode === "point" ? "point charges: E ∝ 1/r²" : "line charges: E ∝ 1/r") + "</span>";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A <b class=\"c-acc\">field line</b> shows which way a small positive charge would be pushed; where lines crowd, $E$ is strong. <b class=\"c-grav\">Equipotentials</b> join points of equal $V$ and always cross field lines at right angles, because moving along one costs no work.</p>" +
      "<p>$E$ adds as arrows, $V$ adds as plain numbers: $V = \\sum kq_i/r_i$. A charge set free trades potential energy for kinetic energy, $q\\Delta V = -\\Delta(\\tfrac12 mv^2)$, so it's fastest where $qV$ is lowest.</p>" +
      "<p><b>Gauss's law</b>: the flux out of any closed surface is $q_{enc}/\\varepsilon_0$. A loop drawn on a flat screen is only a closed surface for <i>line charges</i> (long rods through the screen, $E = 2k\\lambda/r$): then the loop is the cross-section of a closed tube, and the flux per metre of rod is $\\lambda_{enc}/\\varepsilon_0$, whatever the loop's shape. For point charges a flat loop isn't a closed surface, so the law doesn't apply to it.</p>" +
      '<div class="trap"><b>JEE trap: E = 0 doesn\'t mean V = 0.</b> Midway between equal like charges $E = 0$ but $V = 2kq/r$. Midway in a dipole $V = 0$ but $E$ is strong. And in Gauss\'s law $\\vec E$ is the field of <i>all</i> charges, even though only $q_{enc}$ appears on the right.</div>');
    function apply(s) {
      setMode(s.mode); pressSeg(preSeg, "");
      charges = s.charges.map(function (c) { return { x: c.x, y: c.y, q: c.q }; }); sel = 0; syncSel();
      probe = { x: s.probe.x, y: s.probe.y };
      if (s.qt != null) qtS.set(s.qt); if (s.m != null) mS.set(s.m);
      loopOn = !!s.loop; loopBox.querySelector("input").checked = loopOn;
      if (s.loop) loop = s.loop.map(function (v) { return { x: v.x, y: v.y }; });
      fluxLog = {}; fluxPts = [];
      sim.pause(); edited("keepTry");
    }
    var HARD = { mode: "point", charges: [{ x: 1, y: 1.6, q: 4 }, { x: 4, y: 1.6, q: 1 }], probe: { x: 1.5, y: 1.6 }, qt: 0.5, m: 1 };
    K.practice(P.quiz, [
      { level: "easy", tag: "E and V between like charges", setup: { mode: "point", charges: [{ x: 2, y: 1.6, q: 2 }, { x: 4, y: 1.6, q: 2 }], probe: { x: 3, y: 1.6 } }, watch: "Read E and V at the probe",
        q: "Two $+2\\ \\mu$C charges are 2 m apart. What are the field and the potential at the midpoint? ($k = 9\\times10^9$ N m²/C²)",
        options: ["E = 0, V = 36 kV", "E = 0, V = 0", "E = 36 kN/C, V = 0", "E = 9 kN/C, V = 18 kV"], answer: 0,
        explain: "The two fields are equal and opposite, so $E = 0$. Potentials are numbers and simply add: $V = 2 \\times \\dfrac{9\\times10^9 \\times 2\\times10^{-6}}{1} = 36$ kV." },
      { level: "medium", tag: "Gauss's law", setup: { mode: "line", charges: [{ x: 2, y: 1.8, q: 3 }, { x: 3, y: 1.8, q: -1 }, { x: 4.8, y: 1.8, q: 2 }], probe: { x: 3.9, y: 2.9 },
        loop: [{ x: 1.3, y: 1.1 }, { x: 3.6, y: 1.1 }, { x: 3.6, y: 2.5 }, { x: 1.3, y: 2.5 }] }, watch: "Read the flux, then reshape the loop (keep the +2 rod outside)",
        q: "Three long parallel rods carry $+3$, $-1$ and $+2\\ \\mu$C/m. A closed tube surrounds the first two only. What is the flux out of it per metre of length? ($\\varepsilon_0 = 8.84\\times10^{-12}$ C²/N m²)",
        options: ["226 kN·m/C", "452 kN·m/C", "339 kN·m/C", "0, since lines from the +2 rod pass through it"], answer: 0,
        hints: ["Only the charge inside counts, with its sign.", "$\\lambda_{enc} = 3 - 1 = 2\\ \\mu$C/m. Divide by $\\varepsilon_0$."],
        explain: "$\\Phi = \\lambda_{enc}/\\varepsilon_0 = 2\\times10^{-6}/8.84\\times10^{-12} = 2.26\\times10^5$ N m/C per metre. The +2 rod's lines go in and come out again, adding nothing; 452 comes from adding magnitudes (or counting the outside rod)." },
      { level: "hard", tag: "energy in a field", setup: HARD, watch: "Press Release and read the top speed and where it happened",
        q: "Charges $+4\\ \\mu$C and $+1\\ \\mu$C are fixed 3 m apart. A bead (mass 1 g, charge $+0.5\\ \\mu$C) is released from rest on the line between them, 0.5 m from the $4\\ \\mu$C charge. What is its greatest speed, and where?",
        options: ["6.97 m/s, 2 m from the 4 μC charge", "6.97 m/s, at the midpoint", "4.93 m/s, 2 m from the 4 μC charge", "8.69 m/s, just before reaching the 1 μC charge"], answer: 0,
        hints: ["It speeds up while the force pushes it forward and slows once the force reverses. Where is $E = 0$?", "$\\tfrac12 mv^2 = q(V_{start} - V_{E=0})$ with $V = \\sum kq_i/r_i$."],
        explain: "The force reverses where $E = 0$: $4/x^2 = 1/(3-x)^2$ gives $x = 2$ m. $V_{start} = 9(4/0.5 + 1/2.5) = 75.6$ kV and $V(2\\text{ m}) = 9(4/2 + 1/1) = 27$ kV, so $\\tfrac12 mv^2 = 0.5\\times10^{-6} \\times 48.6\\times10^3 = 0.0243$ J and $v = \\sqrt{48.6} = 6.97$ m/s. It never reaches the 1 μC charge: it turns back where $V$ is 75.6 kV again." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: resetTest, onPlay: function () { if (!test || test.done) resetTest(); } });
    makeLoop({ x: 2.2, y: 1.6 }, 0.7);
    loadCharges(PRESETS.dipole);

    if (location.hostname === "localhost") {
      window.__lab_fieldlines = {
        apply: apply, field: field, flux: flux, setMode: setMode, loadCharges: function (k) { loadCharges(PRESETS[k]); },
        setProbe: function (x, y) { probe.x = x; probe.y = y; edited(); }, setLoop: function (pts) { loop = pts; loopOn = true; loopBox.querySelector("input").checked = true; edited(); },
        moveVertex: function (i, x, y) { loop[i].x = x; loop[i].y = y; edited(); }, test: function () { return test; }, cache: function () { return cache; }
      };
    }
    return function destroy() { sim.destroy(); [gE, gV, gP].forEach(function (g) { g.destroy(); }); delete window.__lab_fieldlines; };
  }
})();
