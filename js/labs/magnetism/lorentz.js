/* Magnetism, lab 1: a charge in a magnetic field. Circles, helices, a velocity selector and a
   cyclotron, all stepped with a rotation-exact Boris pusher so the orbits close on themselves. */
(function () {
  "use strict";
  var TAU = 2 * Math.PI;
  var SEL = { L: 8, gap: 3, slit: 0.15, x0: -2 };   // selector: plate length, plate gap, exit slit half-width, start x (m)
  var RACE = [1, 0.6, 0.3];                          // speed factors when racing three speeds
  var EDGE_RUN = 2.5;                                // m of straight run before the field edge

  var lab = {
    id: "lorentz", chapter: "magnetism", title: "Charges in magnetic fields", short: "circles, helices, cyclotron",
    lede: "Fire a charge into a magnetic field. The push is always sideways, so it never speeds the charge up: it bends it into a circle whose period doesn't care how fast you threw it.",
    tries: [
      { id: "period", title: "Show the period doesn't depend on speed",
        text: "In Circle mode, tick Race three speeds (or fire twice at very different speeds) and let them go round once.",
        why: "$r = mv/qB$ grows with speed, but so does the distance round the circle. They cancel: $T = 2\\pi m/qB$. Fast charges take bigger circles in exactly the same time, which is the whole trick behind the cyclotron." },
      { id: "pitch", title: "Make the pitch equal the circumference",
        text: "In Helix mode, find the angle where one turn carries the charge along B exactly as far as once round its circle ($p = 2\\pi r$).",
        why: "Pitch $p = v\\cos\\theta\\,T$ and circumference $2\\pi r = v\\sin\\theta\\,T$. They match when $\\tan\\theta = 1$, so $\\theta = 45°$, whatever q, m, v or B." },
      { id: "selector", title: "Send a charge straight through the selector",
        text: "In Velocity selector mode, adjust E, B or v until the charge flies through the exit slit.",
        why: "The electric push $qE$ and the magnetic push $qvB$ cancel when $v = E/B$. Both scale with q and both flip with its sign, so the selector picks out a speed, not a charge or a mass." },
      { id: "cyclotron", title: "Pump a charge out of the cyclotron",
        text: "In Cyclotron mode, keep the AC in step with the charge and let it spiral out of the dees.",
        why: "Each half-turn takes $\\pi m/qB$ at any speed, so one fixed frequency $f = qB/2\\pi m$ catches the charge at every gap crossing. It leaves with $KE = q^2B^2r^2/2m$: set by the size of the machine, not by the voltage." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the pusher ---------- */
  // Rotate (vx, vy, vz) about the unit vector (bx, by, bz) by angle a (Rodrigues).
  function rot(v, b, a) {
    var c = Math.cos(a), s = Math.sin(a), d = (v[0] * b[0] + v[1] * b[1] + v[2] * b[2]) * (1 - c);
    return [v[0] * c + (b[1] * v[2] - b[2] * v[1]) * s + b[0] * d,
            v[1] * c + (b[2] * v[0] - b[0] * v[2]) * s + b[1] * d,
            v[2] * c + (b[0] * v[1] - b[1] * v[0]) * s + b[2] * d];
  }
  function sinc(x) { return Math.abs(x) < 1e-8 ? 1 - x * x / 6 : Math.sin(x) / x; }
  // One Boris step of length h: half electric kick, magnetic rotation, half kick. The rotation uses the
  // exact angle qBh/m (not the usual 2 atan(qBh/2m)) and the drift follows the true arc, so with E = 0
  // a step of any length lands exactly on the circle: orbits close, however long you run them.
  function push(s, h, f) {
    var v = [s.v[0] + f.qm * f.E[0] * h / 2, s.v[1] + f.qm * f.E[1] * h / 2, s.v[2] + f.qm * f.E[2] * h / 2];
    var x = s.x.slice(), Bm = Math.hypot(f.B[0], f.B[1], f.B[2]);
    if (Bm > 0) {
      var b = [f.B[0] / Bm, f.B[1] / Bm, f.B[2] / Bm], a = -f.qm * Bm * h;   // dv/dt = (q/m) v × B turns v by −(q/m)B t about B̂
      var v1 = rot(v, b, a / 2), par = v1[0] * b[0] + v1[1] * b[1] + v1[2] * b[2], k = sinc(a / 2);
      for (var i = 0; i < 3; i++) x[i] += (par * b[i] + (v1[i] - par * b[i]) * k) * h;
      v = rot(v1, b, a / 2);
    } else {
      for (var j = 0; j < 3; j++) x[j] += v[j] * h;
    }
    for (var n = 0; n < 3; n++) v[n] += f.qm * f.E[n] * h / 2;
    return { x: x, v: v };
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, SUB = 8, dt = K.DT / SUB;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: 0 }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "circle", sign = 1, bdir = 1, region = "all", race = false;
    function grp(title) { var d = K.h("<div></div>"); if (title) d.appendChild(K.h("<h3>" + title + "</h3>")); return d; }
    var qS = K.slider({ label: "Charge $|q|$", unit: "mC", min: 0.5, max: 5, step: 0.5, value: 1, onInput: reset });
    var mS = K.slider({ label: "Mass $m$", unit: "g", min: 0.5, max: 5, step: 0.5, value: 1, onInput: reset });
    var BS = K.slider({ label: "Field $B$", unit: "T", min: 0.2, max: 2, step: 0.1, value: 1, onInput: reset });
    var vS = K.slider({ label: "Speed $v$", unit: "m/s", min: 1, max: 10, step: 0.5, value: 4, onInput: reset });
    var phS = K.slider({ label: "Launch direction $\\varphi$", unit: "°", min: -80, max: 80, step: 1, value: 0, onInput: reset,
      hint: "Angle above the +x direction. Drag the green arrow on the stage too." });
    var thS = K.slider({ label: "Angle to B $\\theta$", unit: "°", min: 0, max: 90, step: 1, value: 60, onInput: reset });
    var ES = K.slider({ label: "Electric field $E$", unit: "V/m", min: 0.5, max: 20, step: 0.5, value: 6, onInput: reset,
      hint: "Points down, from the + plate to the − plate." });
    var VS = K.slider({ label: "Gap voltage $V$", unit: "V", min: 1, max: 10, step: 0.5, value: 4, onInput: reset });
    var fS = K.slider({ label: "AC frequency $f$", unit: "× qB/2πm", min: 0.8, max: 1.2, step: 0.01, value: 1, onInput: reset,
      hint: "1.00 means in step with the charge." });
    var RS = K.slider({ label: "Dee radius $R$", unit: "m", min: 3, max: 8, step: 0.5, value: 6, onInput: reset });

    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Circle", value: "circle" }, { label: "Helix", value: "helix" }, { label: "Velocity selector", value: "selector" }, { label: "Cyclotron", value: "cyclotron" }],
      "circle", function (v) { setMode(v); }, "Experiment");
    P.controls.appendChild(modeSeg);
    var gCharge = grp("Charge");
    var signSeg = K.seg([{ label: "+ positive", value: 1 }, { label: "− negative", value: -1 }], 1, function (v) { sign = v; reset(); }, "Sign of charge");
    gCharge.appendChild(signSeg); gCharge.appendChild(qS.el); gCharge.appendChild(mS.el);
    var gField = grp("Magnetic field");
    var dirSeg = K.seg([{ label: "⊙ out of screen", value: 1 }, { label: "⊗ into screen", value: -1 }], 1, function (v) { bdir = v; reset(); }, "Field direction");
    var dirWrap = K.h("<div></div>"); dirWrap.appendChild(dirSeg);
    gField.appendChild(BS.el); gField.appendChild(dirWrap);
    var regWrap = K.h("<div></div>");
    var regSeg = K.seg([{ label: "Field everywhere", value: "all" }, { label: "Only right of the line", value: "edge" }], "all", function (v) { region = v; reset(); }, "Field region");
    regWrap.appendChild(regSeg); gField.appendChild(regWrap);
    var gLaunch = grp("Launch");
    var raceChk = K.check("Race three speeds (v, 0.6v, 0.3v)", false, function (v) { race = v; reset(); });
    gLaunch.appendChild(vS.el); gLaunch.appendChild(phS.el); gLaunch.appendChild(thS.el); gLaunch.appendChild(raceChk);
    var gSel = grp("Crossed electric field"); gSel.appendChild(ES.el);
    var gCyc = grp("Cyclotron"); [VS.el, fS.el, RS.el].forEach(function (e) { gCyc.appendChild(e); });
    var tune = K.h('<button class="btn btn-sm" type="button">Tune to qB/2πm</button>');
    tune.addEventListener("click", function () { fS.set(1); reset(); });
    gCyc.appendChild(tune);
    [gCharge, gField, gLaunch, gSel, gCyc].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h('<div class="legend"><span class="c-app"><i></i>B field</span><span class="c-normal"><i></i>E field</span>' +
      '<span class="c-vel"><i></i>velocity</span><span class="c-acc"><i></i>force qv×B</span><span class="c-fric"><i></i>+ charge</span><span class="c-disp"><i></i>− charge</span></div>'));

    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function setMode(v, keep) {
      mode = v; setSeg(modeSeg, v);
      if (!keep) {
        if (v === "selector") { bdir = -1; setSeg(dirSeg, -1); }
        if (v === "cyclotron") { BS.set(2); }
      }
      showGroups(); reset();
    }
    function showGroups() {
      dirWrap.hidden = mode === "helix";
      regWrap.hidden = mode !== "circle";
      gLaunch.hidden = mode === "cyclotron";
      phS.el.hidden = mode !== "circle";
      thS.el.hidden = mode !== "helix";
      raceChk.hidden = !(mode === "circle" && region === "all");
      gSel.hidden = mode !== "selector";
      gCyc.hidden = mode !== "cyclotron";
    }

    function params() {
      var p = { mode: mode, sign: sign, bdir: bdir, region: region, race: race && mode === "circle" && region === "all",
        q: qS.get(), m: mS.get(), B: BS.get(), v: vS.get(), phi: phS.get(), th: thS.get(), E: ES.get(), V: VS.get(), fr: fS.get(), R: RS.get() };
      p.qm = p.sign * p.q / p.m;                    // C/kg (mC per g)
      p.w = p.q * p.B / p.m;                        // ω = qB/m, rad/s
      p.T = TAU / p.w;
      p.turn = -p.sign * (mode === "helix" ? 1 : p.bdir);   // +1: anticlockwise as seen (about +z, or +x for the helix)
      p.f = p.fr * p.w / TAU;                       // AC frequency, Hz
      return p;
    }
    function radius(p, v) { return p.m * v / (p.q * p.B); }

    // fields at a point, and which region it's in (motion inside one region is exact)
    function field(p, x) {
      var none = { qm: p.qm, E: [0, 0, 0], B: [0, 0, 0], region: 0 };
      if (p.mode === "helix") return { qm: p.qm, E: [0, 0, 0], B: [p.B, 0, 0], region: 1 };
      if (p.mode === "circle") {
        if (p.region === "edge" && x[0] < 0) return none;
        return { qm: p.qm, E: [0, 0, 0], B: [0, 0, p.bdir * p.B], region: 1 };
      }
      if (p.mode === "selector") {
        if (x[0] < 0 || x[0] > SEL.L) return none;
        return { qm: p.qm, E: [0, -p.E, 0], B: [0, 0, p.bdir * p.B], region: 1 };
      }
      if (Math.hypot(x[0], x[1]) >= p.R) return none;
      return { qm: p.qm, E: [0, 0, 0], B: [0, 0, p.bdir * p.B], region: x[0] >= 0 ? 1 : 2 };
    }
    function bAxis(p) { return p.mode === "helix" ? [1, 0, 0] : [0, 0, 1]; }
    function perpAngle(a, b, ax) {
      var ap = [], bp = [], da = a[0] * ax[0] + a[1] * ax[1] + a[2] * ax[2], db = b[0] * ax[0] + b[1] * ax[1] + b[2] * ax[2];
      for (var i = 0; i < 3; i++) { ap[i] = a[i] - da * ax[i]; bp[i] = b[i] - db * ax[i]; }
      var cx = ap[1] * bp[2] - ap[2] * bp[1], cy = ap[2] * bp[0] - ap[0] * bp[2], cz = ap[0] * bp[1] - ap[1] * bp[0];
      return Math.atan2(Math.hypot(cx, cy, cz), ap[0] * bp[0] + ap[1] * bp[1] + ap[2] * bp[2]);
    }

    /* ---------- particles ---------- */
    function particle(p, x, v, ghost) {
      return { s: { x: x, v: v }, t: 0, start: x.slice(), v0: Math.hypot(v[0], v[1], v[2]), ghost: ghost, phase: 0, turns: [], maxD: 0,
        path: [[x[0], x[1], x[2], 0]], ev: {}, kicks: [], stopped: false };
    }
    // advance one particle by h, splitting the step exactly where it changes region
    function advance(pt, p, h) {
      var left = h, guard = 0, ax = bAxis(p);
      while (left > 1e-12 && guard++ < 6) {
        var f = field(p, pt.s.x), n = push(pt.s, left, f), step = left;
        if (field(p, n.x).region !== f.region) {
          var lo = 0, hi = left;
          for (var i = 0; i < 44; i++) { var mid = (lo + hi) / 2; if (field(p, push(pt.s, mid, f).x).region === f.region) lo = mid; else hi = mid; }
          step = hi; n = push(pt.s, hi, f);
        }
        // phase of v⊥: how far the velocity has turned (exactly uniform inside the field)
        var dph = perpAngle(pt.s.v, n.v, ax), target = TAU * (pt.turns.length + 1);
        if (dph > 0 && pt.phase + dph >= target) {
          var frac = (target - pt.phase) / dph, at = push(pt.s, frac * step, f);
          pt.turns.push({ t: pt.t + frac * step, x: at.x });
        }
        pt.phase += dph;
        var before = pt.s;
        pt.s = n; pt.t += step; left -= step;
        trackSize(pt, p);
        if (step < h || field(p, n.x).region !== f.region) {
          if (field(p, n.x).region !== f.region) crossing(pt, p, f.region, field(p, n.x).region, before);
        }
        if (pt.stopped) return;
      }
    }
    function trackSize(pt, p) {
      var d = p.mode === "helix" ? Math.hypot(pt.s.x[1] - pt.start[1], pt.s.x[2] - pt.start[2]) : Math.hypot(pt.s.x[0] - pt.start[0], pt.s.x[1] - pt.start[1]);
      if (pt.turns.length === 0 || p.mode !== "circle") pt.maxD = Math.max(pt.maxD, d);
    }
    function crossing(pt, p, from, to) {
      var x = pt.s.x, v = pt.s.v, e = pt.ev;
      if (p.mode === "circle") {
        if (to === 1) { e.tIn = pt.t; e.yIn = x[1]; e.phIn = pt.phase; }
        else { e.tOut = pt.t; e.yOut = x[1]; e.phOut = pt.phase; e.vOut = v.slice(); }
      } else if (p.mode === "selector") {
        if (to === 1) { e.tIn = pt.t; return; }
        e.tOut = pt.t; e.yExit = x[1];
        if (x[0] < SEL.L / 2) { e.back = true; return; }
        e.pass = Math.abs(x[1]) < SEL.slit;
        if (!e.pass) { pt.stopped = true; e.blocked = true; }
      } else if (p.mode === "cyclotron") {
        if (to === 0) { e.tExit = pt.t; e.keExit = 0.5 * p.m * dot(v, v); return; }
        if (from === 0) return;
        var ke = 0.5 * p.m * dot(v, v), dir = v[0] > 0 ? 1 : -1;
        ke = Math.max(ke + p.q * p.V * Math.cos(TAU * p.f * pt.t) * dir * p.sign, 0.02 * p.q * p.V);
        var k = Math.sqrt(2 * ke / p.m) / Math.sqrt(dot(v, v));
        pt.s.v = [v[0] * k, v[1] * k, v[2] * k];
        pt.kicks.push({ t: pt.t, ke: ke, y: x[1] });
      }
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

    function launch(p) {
      var parts = [];
      if (p.mode === "circle") {
        var u = [Math.cos(p.phi * K.DEG), Math.sin(p.phi * K.DEG), 0];
        var fhat = [-p.turn * u[1], p.turn * u[0], 0];             // from the charge towards the centre
        var x0 = p.region === "edge" ? [-EDGE_RUN * u[0], -EDGE_RUN * u[1], 0] : [-radius(p, p.v) * fhat[0], -radius(p, p.v) * fhat[1], 0];
        (p.race ? RACE : [1]).forEach(function (k, i) { parts.push(particle(p, x0.slice(), [u[0] * p.v * k, u[1] * p.v * k, 0], i > 0)); });
      } else if (p.mode === "helix") {
        parts.push(particle(p, [0, 0, 0], [p.v * Math.cos(p.th * K.DEG), p.v * Math.sin(p.th * K.DEG), 0], false));
      } else if (p.mode === "selector") {
        parts.push(particle(p, [SEL.x0, 0, 0], [p.v, 0, 0], false));
      } else {
        var dir = p.sign;                                          // the AC starts by pushing + charges to the right
        var v1 = Math.sqrt(2 * p.q * p.V / p.m), pt = particle(p, [dir * 1e-9, 0, 0], [dir * v1, 0, 0], false);
        pt.kicks.push({ t: 0, ke: p.q * p.V, y: 0 });
        parts.push(pt);
      }
      return parts;
    }
    // how long a run lasts (s), given the particle so far
    function over(pt, p) {
      var e = pt.ev;
      if (p.mode === "circle") return p.region === "edge" ? (e.tOut != null ? pt.t >= e.tOut + 1.2 : pt.t >= 3 * p.T + EDGE_RUN / p.v) : pt.t >= 2 * p.T - 1e-9;
      if (p.mode === "helix") return pt.t >= 2 * p.T - 1e-9;
      if (p.mode === "selector") return pt.stopped || e.back || (e.tOut != null && pt.t >= e.tOut + 0.8) || pt.t >= 20;
      return (e.tExit != null && pt.t >= e.tExit + 1) || pt.t >= 100;
    }
    // the formula path: the same exact pusher run ahead with big steps (not shown for the cyclotron)
    function predict(p) {
      if (p.mode === "cyclotron") return [];
      return launch(p).map(function (pt) {
        var pts = [[pt.s.x[0], pt.s.x[1], pt.s.x[2]]], h = Math.min(1 / 60, p.T / 200), n = 0;
        while (!over(pt, p) && !pt.stopped && n++ < 20000) {
          advance(pt, p, h);
          if (p.mode === "circle" && p.region === "all" && pt.t > p.T + h) break;
          pts.push([pt.s.x[0], pt.s.x[1], pt.s.x[2]]);
        }
        return { pts: pts, ev: pt.ev };
      });
    }

    /* ---------- view: my own metres -> px mapping, refitted on reset ---------- */
    var view = { s: 40, cx: 0, cy: 0 };
    function X(x) { return W / 2 + (x - view.cx) * view.s; }
    function Y(y) { return H / 2 - (y - view.cy) * view.s; }
    function fit(p, pred) {
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      function inc(x, y) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (p.mode === "cyclotron") { inc(-p.R - 1, -p.R - 0.6); inc(p.R + 1, p.R + 1.3); }
      else if (p.mode === "selector") { inc(SEL.x0 - 0.6, -SEL.gap / 2 - 0.8); inc(SEL.L + 2, SEL.gap / 2 + 0.8); }
      else {
        pred.forEach(function (pr) { pr.pts.forEach(function (q) { inc(q[0], q[1]); }); });
        inc(0, 0);
        var pad = Math.max(0.6, 0.08 * Math.max(x1 - x0, y1 - y0));
        x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
        if (p.mode === "helix") { y0 = Math.min(y0, -1); y1 = Math.max(y1, 1); x1 += 0.25 * (x1 - x0); }   // room for the end-on inset
      }
      view.s = Math.min(W / (x1 - x0), H / (y1 - y0));
      view.cx = (x0 + x1) / 2; view.cy = (y0 + y1) / 2;
    }

    /* ---------- runs ---------- */
    var run = null, runs = [], pred = [], keepView = false;
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      pred = predict(p);
      if (!keepView) fit(p, pred);
      run = { p: p, parts: launch(p), done: false, rec: [], result: null };
      record();
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }
    function record() {
      var pt = run.parts[0], v = pt.s.v;
      run.rec.push([pt.t, v[0], v[1], v[2], Math.hypot(v[0], v[1], v[2]), 0.5 * run.p.m * dot(v, v)]);
      run.parts.forEach(function (q) { q.path.push([q.s.x[0], q.s.x[1], q.s.x[2], q.t]); });
    }

    sim.on("step", function () {
      if (!run || run.done) return;
      var p = run.p;
      for (var k = 0; k < SUB; k++) {
        run.parts.forEach(function (pt) { if (!pt.stopped && !over(pt, p)) advance(pt, p, dt); });
        // the selector plates stop anything that hits them
        if (p.mode === "selector") run.parts.forEach(function (pt) {
          if (!pt.stopped && field(p, pt.s.x).region === 1 && Math.abs(pt.s.x[1]) >= SEL.gap / 2) { pt.stopped = true; pt.ev.hit = true; }
        });
      }
      record();
      if (run.parts.every(function (pt) { return pt.stopped || over(pt, p); })) finish();
      update(run.done);
    });

    // results from the finished run
    function measure() {
      var p = run.p, pt = run.parts[0], e = pt.ev, r = { p: p };
      if (p.mode === "circle" && p.region === "all") {
        r.parts = run.parts.map(function (q) {
          var tr = q.turns[0];
          return { v: q.v0, T: tr ? tr.t : null, r: q.maxD / 2, gap: tr ? Math.hypot(tr.x[0] - q.start[0], tr.x[1] - q.start[1]) : null };
        });
      } else if (p.mode === "circle") {
        if (e.tOut != null) {
          r.tField = e.tOut - e.tIn; r.chord = Math.abs(e.yOut - e.yIn); r.swept = (e.phOut - e.phIn) / K.DEG;
          r.exitAng = Math.atan2(e.vOut[1], -e.vOut[0]) / K.DEG;
        }
      } else if (p.mode === "helix") {
        var tr = pt.turns[0];
        if (tr) { r.T = tr.t; r.pitch = tr.x[0] - pt.start[0]; }
        r.r = pt.maxD / 2;
      } else if (p.mode === "selector") {
        r.yExit = e.yExit; r.pass = !!e.pass; r.hit = !!e.hit; r.blocked = !!e.blocked; r.back = !!e.back;
      } else {
        var ks = pt.kicks;
        r.n = ks.length; r.ke = ks.length ? ks[ks.length - 1].ke : 0;
        if (ks.length > 1) r.f = (ks.length - 1) / (2 * (ks[ks.length - 1].t - ks[0].t));
        r.half = [];
        for (var i = 1; i < ks.length; i++) r.half.push([Math.sqrt(2 * ks[i - 1].ke / p.m), Math.abs(ks[i].y - ks[i - 1].y) / 2]);
        if (e.tExit != null) {
          r.exit = true; r.keExit = e.keExit;
          var last = ks.length ? ks[ks.length - 1].t : 0, arc = pt.path.filter(function (q) { return q[3] > last + 1e-9 && q[3] <= e.tExit + 1e-9; });
          if (arc.length >= 3) r.rExit = circum(arc[0], arc[Math.floor(arc.length / 2)], arc[arc.length - 1]);
        }
      }
      return r;
    }
    function circum(a, b, c) {
      var ab = Math.hypot(a[0] - b[0], a[1] - b[1]), bc = Math.hypot(b[0] - c[0], b[1] - c[1]), ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
      var area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
      return area2 > 1e-12 ? ab * bc * ca / (2 * area2) : null;
    }

    function finish() {
      if (run.done) return;
      run.done = true; sim.pause(); transportUI.render();
      var p = run.p, r = run.result = measure();
      if (p.mode === "circle" && p.region === "all") {
        r.parts.forEach(function (q) { if (q.T) runs.push({ q: p.q, m: p.m, B: p.B, mode: "circle", v: q.v, T: q.T }); });
        K.flash(P.note, r.parts.length > 1 ? "All three back at the start together: T = " + K.fmt(r.parts[0].T, 2) + " s" : "Round twice, closed exactly: T = " + K.fmt(r.parts[0].T, 2) + " s");
        var same = runs.filter(function (q) { return q.q === p.q && q.m === p.m && q.B === p.B; });
        for (var i = 0; i < same.length; i++) for (var j = 0; j < same.length; j++) {
          if (Math.max(same[i].v, same[j].v) >= 1.5 * Math.min(same[i].v, same[j].v) && Math.abs(same[i].T - same[j].T) <= 0.005 * same[i].T) tries.mark("period");
        }
      } else if (p.mode === "circle") {
        if (r.tField != null) K.flash(P.note, "In the field for " + K.fmt(r.tField, 2) + " s, out " + K.fmt(r.chord, 2) + " m from where it went in");
      } else if (p.mode === "helix") {
        if (r.T) runs.push({ q: p.q, m: p.m, B: p.B, mode: "helix", v: p.v, T: r.T });
        K.flash(P.note, r.pitch != null ? "Pitch " + K.fmt(r.pitch, 2) + " m, circumference " + K.fmt(TAU * r.r, 2) + " m" : "Straight along B: no force");
        if (r.pitch != null && p.th > 0 && p.th < 90 && Math.abs(r.pitch - TAU * r.r) <= 0.01 * TAU * r.r) tries.mark("pitch");
      } else if (p.mode === "selector") {
        if (r.yExit != null && !r.back) runs.push({ mode: "selector", E: p.E, B: p.B, bdir: p.bdir, v: p.v, y: r.yExit });
        K.flash(P.note, r.pass ? "Straight through the slit: v = E/B" : r.hit ? "Hit a plate" : r.blocked ? "Blocked by the slit: " + K.fmt(r.yExit, 2) + " m off" : "Turned back");
        if (r.pass) tries.mark("selector");
      } else {
        K.flash(P.note, r.exit ? "Out with " + K.fmt(r.keExit, 1) + " mJ after " + r.n + " kicks" : "Out of step: the AC stopped helping");
        if (r.exit) tries.mark("cyclotron");
      }
      if (runs.length > 60) runs.shift();
    }

    /* ---------- dragging the launch arrow ---------- */
    var drag = false, KV = 16;            // px per m/s for the launch arrow
    function tipPx() {
      var p = params(), pt = run.parts[0], a = p.mode === "helix" ? p.th : p.phi;
      return { x: X(pt.start[0]) + p.v * KV * Math.cos(a * K.DEG), y: Y(pt.start[1]) - p.v * KV * Math.sin(a * K.DEG) };
    }
    sim.pointer({
      down: function (pt) {
        if (mode !== "circle" && mode !== "helix") return false;
        var t = tipPx();
        if (Math.hypot(pt.px - t.x, pt.py - t.y) > 22) return false;
        drag = true; return true;
      },
      drag: function (pt) {
        var s = run.parts[0].start, dx = pt.px - X(s[0]), dy = Y(s[1]) - pt.py;
        var ang = Math.round(Math.atan2(dy, dx) / K.DEG), sp = Math.round(Math.hypot(dx, dy) / KV * 2) / 2;
        vS.set(K.clamp(sp, 1, 10));
        if (mode === "helix") thS.set(K.clamp(ang, 0, 90)); else phS.set(K.clamp(ang, -80, 80));
        keepView = true; reset(); keepView = false;
      },
      up: function () { if (drag) { drag = false; reset(); } }
    });

    /* ---------- drawing ---------- */
    function sym(ctx, x, y, out, r, color) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (out) { ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill(); }
      else { var k = r * 0.62; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke(); }
    }
    function grid(ctx) {
      var steps = [0.5, 1, 2, 5, 10, 20], st = steps[0];
      for (var i = 0; i < steps.length && steps[i] * view.s < 36; i++) st = steps[Math.min(i + 1, steps.length - 1)];
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
      var xm0 = view.cx - W / 2 / view.s, xm1 = view.cx + W / 2 / view.s, ym0 = view.cy - H / 2 / view.s, ym1 = view.cy + H / 2 / view.s;
      for (var x = Math.ceil(xm0 / st) * st; x <= xm1; x += st) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
      for (var y = Math.ceil(ym0 / st) * st; y <= ym1; y += st) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
      ctx.fillStyle = th.ink; ctx.fillRect(16, H - 18, st * view.s, 3);
      K.label(ctx, st + " m", 16 + st * view.s / 2, H - 20, th.muted, {});
    }
    function symbolsIn(ctx, x0, x1, y0, y1, out, clip) {
      var gap = 56, col = K.alpha(th.app, 0.45);
      for (var x = x0 + gap / 2; x < x1; x += gap) for (var y = y0 + gap / 2; y < y1; y += gap) if (!clip || clip(x, y)) sym(ctx, x, y, out, 7, col);
    }

    sim.on("under", function (ctx) {
      var p = run.p, t = sim.time;
      grid(ctx);
      if (p.mode === "circle") {
        if (p.region === "edge") {
          var bx = X(0);
          ctx.fillStyle = K.alpha(th.app, 0.06); ctx.fillRect(bx, 0, W - bx, H);
          symbolsIn(ctx, bx, W, 0, H, p.bdir > 0);
          ctx.strokeStyle = th.app; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, H); ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, "field starts here", bx + 6, 22, th.app, { align: "left" });
        } else symbolsIn(ctx, 0, W, 0, H, p.bdir > 0);
        K.label(ctx, "B = " + K.fmt(p.B, 1) + " T " + (p.bdir > 0 ? "⊙ out of the screen" : "⊗ into the screen"), W - 12, H - 8, th.app, { align: "right", bg: true });
      } else if (p.mode === "helix") {
        ctx.strokeStyle = K.alpha(th.app, 0.35); ctx.lineWidth = 1.5;
        for (var yy = 30; yy < H; yy += 60) K.arrow(ctx, 10, yy, W - 10, yy, K.alpha(th.app, 0.3), { width: 1.5 });
        K.label(ctx, "B = " + K.fmt(p.B, 1) + " T, along +x (in the screen)", W - 12, H - 8, th.app, { align: "right", bg: true });
      } else if (p.mode === "selector") {
        var x0 = X(0), x1 = X(SEL.L), yt = Y(SEL.gap / 2), yb = Y(-SEL.gap / 2);
        ctx.fillStyle = K.alpha(th.app, 0.06); ctx.fillRect(x0, yt, x1 - x0, yb - yt);
        symbolsIn(ctx, x0, x1, yt, yb, p.bdir > 0);
        for (var xe = x0 + 28; xe < x1; xe += 56) K.arrow(ctx, xe, yt + 8, xe, yb - 8, K.alpha(th.normal, 0.55), { width: 1.5 });
        ctx.fillStyle = th.body; ctx.fillRect(x0, yt - 8, x1 - x0, 8); ctx.fillRect(x0, yb, x1 - x0, 8);
        K.label(ctx, "+ plate", x0 + 6, yt - 10, th.ink, { align: "left" });
        K.label(ctx, "− plate", x0 + 6, yb + 26, th.ink, { align: "left" });
        // exit slit
        var ys0 = Y(SEL.slit), ys1 = Y(-SEL.slit);
        ctx.fillRect(x1 - 3, yt, 6, ys0 - yt); ctx.fillRect(x1 - 3, ys1, 6, yb - ys1);
        K.label(ctx, "slit", x1 + 8, ys0 - 2, th.muted, { align: "left" });
        K.label(ctx, "E = " + K.fmt(p.E, 1) + " V/m ↓   B = " + K.fmt(p.B, 1) + " T " + (p.bdir > 0 ? "⊙" : "⊗"), W - 12, H - 8, th.ink, { align: "right", bg: true });
      } else {
        var c = { x: X(0), y: Y(0) }, R = p.R * view.s, g = 0.18 * view.s, pol = Math.cos(TAU * p.f * t);
        ctx.fillStyle = K.alpha(th.app, 0.08); ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x - g, c.y, R, Math.PI / 2, 3 * Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x + g, c.y, R, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        symbolsIn(ctx, c.x - R, c.x + R, c.y - R, c.y + R, p.bdir > 0, function (x, y) { return Math.hypot(x - c.x, y - c.y) < R - 10 && Math.abs(x - c.x) > g + 10; });
        // the AC across the gap: E points from the + dee to the − dee
        for (var ya = c.y - R + 30; ya < c.y + R - 20; ya += 46) {
          var L = 22 * pol;
          if (Math.abs(L) > 3) K.arrow(ctx, c.x - L / 2, ya, c.x + L / 2, ya, th.normal, { width: 2, head: 6 });
        }
        K.label(ctx, pol >= 0 ? "+" : "−", c.x - R * 0.5, c.y - R - 6, th.ink, { font: "700 18px 'JetBrains Mono', monospace" });
        K.label(ctx, pol >= 0 ? "−" : "+", c.x + R * 0.5, c.y - R - 6, th.ink, { font: "700 18px 'JetBrains Mono', monospace" });
        K.label(ctx, "AC at f = " + K.fmt(p.f, 3) + " Hz", W - 12, H - 8, th.normal, { align: "right", bg: true });
      }
    });

    function pathLine(ctx, pts, color, width, dash, depth) {
      var zc = depth ? run.p.turn * radius(run.p, run.p.v * Math.sin(run.p.th * K.DEG)) : 0;   // z of the helix axis
      if (pts.length < 2) return;
      ctx.save(); ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.setLineDash(dash || []);
      if (!depth) {
        ctx.strokeStyle = color; ctx.beginPath();
        pts.forEach(function (q, i) { if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); });
        ctx.stroke();
      } else {
        // helix seen from the side: the half in front of the screen (z > 0) bold, the half behind faint
        for (var i = 1; i < pts.length; i++) {
          ctx.strokeStyle = pts[i][2] >= zc ? color : K.alpha(th.muted, 0.45);
          ctx.beginPath(); ctx.moveTo(X(pts[i - 1][0]), Y(pts[i - 1][1])); ctx.lineTo(X(pts[i][0]), Y(pts[i][1])); ctx.stroke();
        }
      }
      ctx.restore();
    }
    function charge(ctx, x, y, r, ghost) {
      var col = run.p.sign > 0 ? th.fric : th.disp;
      ctx.fillStyle = ghost ? K.alpha(col, 0.6) : col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.round(r * 1.4) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(run.p.sign > 0 ? "+" : "−", x, y + 1);
    }

    sim.on("over", function (ctx) {
      var p = run.p, helix = p.mode === "helix";
      pred.forEach(function (pr) { pathLine(ctx, pr.pts, K.alpha(th.ink, 0.35), 1.5, [6, 6], false); });
      run.parts.forEach(function (pt, i) { pathLine(ctx, pt.path, i ? K.alpha(th.ink, 0.55) : th.ink, i ? 2 : 2.5, null, helix); });
      run.parts.slice().reverse().forEach(function (pt) {
        var x = pt.s.x, r = helix ? 9 + 2 * (x[2] - p.turn * radius(p, p.v * Math.sin(p.th * K.DEG))) / Math.max(radius(p, p.v), 0.1) : 9;
        charge(ctx, X(x[0]), Y(x[1]), Math.max(5, r), pt.ghost);
      });
      // velocity and force on the main charge
      var pt = run.parts[0], x = pt.s.x, v = pt.s.v, f = field(p, x), sp = Math.hypot(v[0], v[1], v[2]);
      var F = [p.qm * (f.E[0] + v[1] * f.B[2] - v[2] * f.B[1]), p.qm * (f.E[1] + v[2] * f.B[0] - v[0] * f.B[2])];
      var Fm = Math.hypot(F[0], F[1]), px = X(x[0]), py = Y(x[1]);
      if (!pt.stopped) {
        if (sp > 0) K.arrow(ctx, px, py, px + v[0] * KV, py - v[1] * KV, th.vel, { label: "v", width: 3 });
        if (Fm > 1e-9) { var L = 46 * Math.min(1.6, Fm / Math.max(p.w * p.v, 1e-9)); K.arrow(ctx, px, py, px + F[0] / Fm * L, py - F[1] / Fm * L, th.acc, { label: "F", width: 3 }); }
      }
      if (!sim.running && run.rec.length <= 1 && (p.mode === "circle" || helix)) {
        var tp = tipPx();
        ctx.strokeStyle = th.vel; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tp.x, tp.y, 9, 0, TAU); ctx.stroke();
        K.label(ctx, "drag to aim", tp.x + 12, tp.y - 10, th.vel, { align: "left" });
      }
      if (p.mode === "circle" && p.region === "all" && run.parts.length === 1) {
        var c = [pt.start[0] + radius(p, p.v) * -p.turn * Math.sin(p.phi * K.DEG), pt.start[1] + radius(p, p.v) * p.turn * Math.cos(p.phi * K.DEG)];
        ctx.fillStyle = th.muted; ctx.beginPath(); ctx.arc(X(c[0]), Y(c[1]), 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = K.alpha(th.muted, 0.6); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(c[0]), Y(c[1])); ctx.lineTo(X(pt.start[0]), Y(pt.start[1])); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "r = " + K.fmt(radius(p, p.v), 2) + " m", (X(c[0]) + X(pt.start[0])) / 2, (Y(c[1]) + Y(pt.start[1])) / 2 - 4, th.muted, { bg: true });
      }
      if (helix) drawInset(ctx, p);
    });
    // end-on view of the helix, looking back along B (so B points at you)
    function drawInset(ctx, p) {
      var s = 150, x0 = W - s - 12, y0 = 12, r = Math.max(radius(p, p.v * Math.sin(p.th * K.DEG)), 0.05), k = (s / 2 - 18) / (2 * r);
      ctx.fillStyle = K.alpha(th.surface, 0.94); ctx.strokeStyle = th.line; ctx.lineWidth = 1;
      ctx.fillRect(x0, y0, s, s); ctx.strokeRect(x0, y0, s, s);
      var cx = x0 + s / 2, cy = y0 + s / 2 + 6;
      sym(ctx, x0 + 16, y0 + 18, true, 6, th.app);
      K.label(ctx, "looking along B", x0 + 28, y0 + 24, th.muted, { align: "left" });
      var pts = run.parts[0].path;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath();
      pts.forEach(function (q, i) { var u = cx - q[2] * k, w = cy - q[1] * k; if (i) ctx.lineTo(u, w); else ctx.moveTo(u, w); });
      ctx.stroke();
      var q = run.parts[0].s.x;
      charge(ctx, cx - q[2] * k, cy - q[1] * k, 6, false);
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">velocity components vs t</b> · <span class="cap1"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">kinetic energy vs t</b> · <span class="cap2"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app cap3h"></b> · <span class="cap3"></span></p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var g1 = new K.Graph(cv[0], { yLabel: "v (m/s)", xMax: 1, xAuto: true, color: th.vel });
    var g2 = new K.Graph(cv[1], { yLabel: "KE (mJ)", xMax: 1, xAuto: true, yMin: 0, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "T (s)", xLabel: "v (m/s)", xMax: 10, yMin: 0, color: th.app });
    var caps = { c1: P.graphs.querySelector(".cap1"), c2: P.graphs.querySelector(".cap2"), c3: P.graphs.querySelector(".cap3"), c3h: P.graphs.querySelector(".cap3h") };

    // formula curves (dashed), set on reset
    function theory() {
      var p = run.p, a1 = [], a2 = [], ke = [], i, t;
      [g1, g2, g3].forEach(function (g) { g.clear(); g.extra = null; });
      var KE0 = 0.5 * p.m * p.v * p.v;
      if (p.mode === "circle" && p.region === "all") {
        for (i = 0; i <= 240; i++) {
          t = 2 * p.T * i / 240; var psi = p.phi * K.DEG + p.turn * p.w * t;
          a1.push([t, p.v * Math.cos(psi)]); a2.push([t, p.v * Math.sin(psi)]); ke.push([t, KE0]);
        }
      } else if (p.mode === "helix") {
        for (i = 0; i <= 240; i++) {
          t = 2 * p.T * i / 240;
          a1.push([t, p.v * Math.cos(p.th * K.DEG)]); a2.push([t, p.v * Math.sin(p.th * K.DEG) * Math.cos(p.w * t)]); ke.push([t, KE0]);
        }
      } else if (p.mode === "circle") {
        var tEnd = pred[0] && pred[0].ev.tOut != null ? pred[0].ev.tOut + 1.2 : 3 * p.T;
        ke = [[0, KE0], [tEnd, KE0]];
      } else if (p.mode === "selector") {
        // crossed fields, exactly: v = u + R(ωt)(v₀ − u), with drift u = E×B/B² = (E/B along x for ⊗)
        var ev = pred[0] ? pred[0].ev : {}, tIn = -SEL.x0 / p.v, tOut = ev.tOut != null ? ev.tOut : 20, end = Math.min(20, tOut + 0.8);
        var u = -p.bdir * p.E / p.B, last = [p.v, 0];
        for (i = 0; i <= 300; i++) {
          t = end * i / 300; var vx = p.v, vy = 0;
          if (t >= tIn) {
            var tt = Math.min(t, tOut) - tIn, ang = p.turn * p.w * tt, dx = p.v - u;
            vx = u + dx * Math.cos(ang); vy = dx * Math.sin(ang);
          }
          last = [vx, vy];
          a1.push([t, vx]); a2.push([t, vy]); ke.push([t, 0.5 * p.m * (vx * vx + vy * vy)]);
        }
        void last;
      } else if (p.fr === 1) {
        // in step: n kicks of qV, one every half-turn
        var nMax = Math.floor(p.q * p.B * p.q * p.B * p.R * p.R / (2 * p.m) / (p.q * p.V)) + 1;
        for (i = 1; i <= nMax; i++) {
          var t0 = (i - 1) * p.T / 2, t1 = i * p.T / 2, k = i * p.q * p.V, s = Math.sqrt(2 * k / p.m);
          ke.push([t0, k], [t1, k]); a1.push([t0, s], [t1, s]);
        }
      }
      var dash = [5, 5];
      if (a1.length) g1.set("f1", { points: a1, color: K.alpha(th.vel, 0.55), dash: dash, width: 1.5 });
      if (a2.length) g1.set("f2", { points: a2, color: th.vel, dash: dash, width: 1.5 });
      if (ke.length) g2.set("f", { points: ke, color: th.acc, dash: dash, width: 1.5 });
      g3.o.xMax = 10; g3.o.xAuto = false; g3.o.xLabel = "v (m/s)";
      if (p.mode === "circle" || p.mode === "helix") {
        g3.o.yLabel = "T (s)"; g3.set("f", { points: [[0, p.T], [10, p.T]], color: th.app, dash: dash, width: 1.5 });
      } else if (p.mode === "selector") {
        g3.o.yLabel = "exit y (m)"; g3.set("f", { points: [[0, 0], [10, 0]], color: K.alpha(th.muted, 0.6), width: 1 });
      } else {
        var vmax = p.q * p.B * p.R / p.m;
        g3.o.yLabel = "r (m)"; g3.o.xMax = Math.ceil(vmax * 1.1); g3.set("f", { points: [[0, 0], [g3.o.xMax, radius(p, g3.o.xMax)]], color: th.app, dash: dash, width: 1.5 });
      }
      var C = {
        circle: ["they swing like sines: the direction turns at a steady rate $\\omega = qB/m$", "flat: a force at 90° to v does no work", "Period vs speed", "flat line: $T = 2\\pi m/qB$, dots are your runs"],
        edge: ["straight, then turning, then straight again", "flat: a force at 90° to v does no work", "Period vs speed", "flat line: $T = 2\\pi m/qB$"],
        helix: ["$v_\\parallel$ (faint) never changes, $v_y$ swings", "flat: the field does no work", "Period vs speed", "same $T$ whatever the angle or speed"],
        selector: ["$v_x$ (faint) and $v_y$: both stay put when $v = E/B$", "changes only if E does work on it", "Exit deflection vs speed", "dots are your runs; zero at $v = E/B$"],
        cyclotron: ["speed jumps at every gap crossing", "a staircase: $qV$ per crossing", "Orbit radius vs speed", "each half-turn: $r = mv/qB$, a straight line"]
      };
      var key = p.mode === "circle" && p.region === "edge" ? "edge" : p.mode;
      caps.c1.innerHTML = K.md(C[key][0]); caps.c2.innerHTML = K.md(C[key][1]); caps.c3h.textContent = C[key][2]; caps.c3.innerHTML = K.md(C[key][3]);
      if (p.mode === "cyclotron") caps.c1.innerHTML = K.md(C[key][0] + " (speed, not components)");
    }

    var slowMaths = K.throttle(renderMaths, 100), lastDraw = 0;
    function update(force) {
      var now = performance.now();
      if (!force && now - lastDraw < 50) return;
      lastDraw = now;
      var p = run.p, rec = run.rec, cyc = p.mode === "cyclotron";
      if (cyc) g1.set("s1", { points: rec.map(function (q) { return [q[0], q[4]]; }), color: th.vel, width: 2.5, dot: true });
      else {
        g1.set("s1", { points: rec.map(function (q) { return [q[0], q[1]]; }), color: K.alpha(th.vel, 0.55), width: 2.5 });
        g1.set("s2", { points: rec.map(function (q) { return [q[0], q[2]]; }), color: th.vel, width: 2.5, dot: true });
      }
      g2.set("s", { points: rec.map(function (q) { return [q[0], q[5]]; }), color: th.acc, width: 2.5, dot: true });
      var dots = [];
      if (p.mode === "circle" || p.mode === "helix") dots = runs.filter(function (r) { return r.T && r.q === p.q && r.m === p.m && r.B === p.B; }).map(function (r) { return [r.v, r.T]; });
      else if (p.mode === "selector") dots = runs.filter(function (r) { return r.mode === "selector" && r.E === p.E && r.B === p.B && r.bdir === p.bdir; }).map(function (r) { return [r.v, r.y]; });
      else dots = measure().half;
      g3.extra = function (ctx, Xg, Yg) {
        ctx.fillStyle = th.app;
        dots.forEach(function (d) { ctx.beginPath(); ctx.arc(Xg(d[0]), Yg(d[1]), 4.5, 0, TAU); ctx.fill(); });
        if (p.mode === "selector") {
          var vx = Xg(p.E / p.B);
          ctx.strokeStyle = th.normal; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(vx, 12); ctx.lineTo(vx, 150); ctx.stroke(); ctx.setLineDash([]);
        }
      };
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      renderMaths();
    }

    /* ---------- maths + readouts ---------- */
    var eqEls = [], setR = null, layoutKey = "";
    var LAYOUT = {
      circle: { eqs: ["Magnetic force: always sideways", "It bends into a circle", "The period has no v in it", "No work is done"],
        ro: [["r", "radius", "c-disp"], ["T", "period", ""], ["gap", "gap after one turn", ""], ["v", "speed", "c-vel"], ["ke", "kinetic energy", "c-acc"], ["F", "force qvB", "c-acc"]] },
      edge: { eqs: ["The radius inside the field", "It leaves at the angle it came in", "Angle turned, so time inside", "Where it comes out"],
        ro: [["tf", "time in the field", ""], ["ch", "exit distance from entry", "c-disp"], ["sw", "angle turned", ""], ["ea", "exit angle to the normal", ""], ["r", "radius", "c-disp"], ["v", "speed", "c-vel"]] },
      helix: { eqs: ["Split v along and across B", "Across B: a circle", "Same period as ever", "Along B: a steady drift"],
        ro: [["p", "pitch", "c-disp"], ["r", "radius", "c-disp"], ["T", "period", ""], ["vp", "v along B", "c-vel"], ["vn", "v across B", "c-vel"], ["c", "circumference 2πr", ""]] },
      selector: { eqs: ["Electric force", "Magnetic force", "They cancel at one speed", "Your charge"],
        ro: [["y", "exit deflection", "c-disp"], ["vs", "speed that passes", "c-vel"], ["fe", "electric force qE", "c-normal"], ["fb", "magnetic force qvB", "c-acc"], ["net", "net force at entry", "c-acc"], ["v", "speed now", "c-vel"]] },
      cyclotron: { eqs: ["One frequency fits every orbit", "Each gap crossing", "The biggest orbit fits the dees", "Number of turns"],
        ro: [["n", "gap crossings", ""], ["ke", "kinetic energy", "c-acc"], ["f", "revolution frequency", ""], ["ko", "exit KE", "c-acc"], ["ro", "exit orbit radius", "c-disp"], ["km", "KE max (r = R)", "c-acc"]] }
    };
    function layout(key) {
      if (key === layoutKey) return;
      layoutKey = key;
      var L = LAYOUT[key];
      P.eqs.innerHTML = L.eqs.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, L.ro.map(function (r) { return { id: r[0], label: r[1], cls: r[2] }; }));
    }
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function e3(v) { return K.fmt(v, 1) + "\\times10^{-3}"; }
    function bold(v, d, unit) { return "\\mathbf{" + K.fmt(v, d) + "}\\ \\text{" + unit + "}"; }
    function renderMaths() {
      var p = run.p, key = p.mode === "circle" && p.region === "edge" ? "edge" : p.mode;
      layout(key);
      var r = run.done ? run.result : null, pt = run.parts[0], v = pt.s.v, sp = Math.hypot(v[0], v[1], v[2]);
      var rr = radius(p, p.v), KE0 = 0.5 * p.m * p.v * p.v, qmB = "\\frac{" + e3(p.m) + "}{(" + e3(p.q) + ")(" + K.fmt(p.B, 1) + ")}";
      if (key === "circle") {
        K.tex(eqEls[0], "F = qvB\\sin 90^\\circ = (" + e3(p.q) + ")(" + K.fmt(p.v, 1) + ")(" + K.fmt(p.B, 1) + ") = " + bold(p.q * p.v * p.B, 2, "mN"));
        K.tex(eqEls[1], "qvB = \\frac{mv^2}{r} \\Rightarrow r = \\frac{mv}{qB} = \\frac{(" + e3(p.m) + ")(" + K.fmt(p.v, 1) + ")}{(" + e3(p.q) + ")(" + K.fmt(p.B, 1) + ")} = " + bold(rr, 2, "m"));
        K.tex(eqEls[2], "T = \\frac{2\\pi r}{v} = \\frac{2\\pi m}{qB} = 2\\pi" + qmB + " = " + bold(p.T, 2, "s"));
        K.tex(eqEls[3], "W = Fv\\cos 90^\\circ\\,t = 0 \\Rightarrow KE = \\tfrac12 mv^2 = " + bold(KE0, 2, "mJ") + " \\text{ forever}");
        var a = r && r.parts[0];
        setR("r", a ? K.fmt(a.r, 2) + " m" : "—", "formula " + K.fmt(rr, 2) + " m");
        setR("T", a && a.T ? K.fmt(a.T, 2) + " s" : "—", "formula " + K.fmt(p.T, 2) + " s" + (r && r.parts.length > 1 ? " · all three: " + r.parts.map(function (q) { return K.fmt(q.T, 2); }).join(", ") : ""));
        setR("gap", a && a.gap != null ? K.fmt(a.gap, 3) + " m" : "—", "the circle closes");
        setR("v", K.fmt(sp, 2) + " m/s", "never changes");
        setR("ke", K.fmt(0.5 * p.m * sp * sp, 2) + " mJ", "formula " + K.fmt(KE0, 2) + " mJ");
        setR("F", K.fmt(p.q * sp * p.B, 2) + " mN", "always ⊥ v");
      } else if (key === "edge") {
        var c = p.turn, sw = 180 - 2 * c * p.phi, tf = sw / 360 * p.T, ch = 2 * rr * Math.cos(p.phi * K.DEG);
        K.tex(eqEls[0], "r = \\frac{mv}{qB} = \\frac{(" + e3(p.m) + ")(" + K.fmt(p.v, 1) + ")}{(" + e3(p.q) + ")(" + K.fmt(p.B, 1) + ")} = " + bold(rr, 2, "m") + ",\\quad T = \\frac{2\\pi m}{qB} = " + K.fmt(p.T, 2) + "\\ \\text{s}");
        K.tex(eqEls[1], "\\text{in at } \\varphi = " + n(p.phi, 0) + "^\\circ \\text{ to the normal} \\Rightarrow \\text{out at } " + n(p.phi, 0) + "^\\circ \\text{ (mirror image)}");
        K.tex(eqEls[2], "\\Delta\\theta = 180^\\circ " + (c < 0 ? "+" : "-") + " 2\\varphi = " + K.fmt(sw, 0) + "^\\circ \\Rightarrow t = \\frac{" + K.fmt(sw, 0) + "^\\circ}{360^\\circ}T = " + bold(tf, 2, "s"));
        K.tex(eqEls[3], "d = 2r\\cos\\varphi = 2(" + K.fmt(rr, 2) + ")\\cos" + n(p.phi, 0) + "^\\circ = " + bold(ch, 2, "m"));
        setR("tf", r && r.tField != null ? K.fmt(r.tField, 2) + " s" : "—", "formula " + K.fmt(tf, 2) + " s");
        setR("ch", r && r.chord != null ? K.fmt(r.chord, 2) + " m" : "—", "formula " + K.fmt(ch, 2) + " m");
        setR("sw", r && r.swept != null ? K.fmt(r.swept, 1) + "°" : "—", "formula " + K.fmt(sw, 1) + "°");
        setR("ea", r && r.exitAng != null ? K.fmt(r.exitAng, 1) + "°" : "—", "went in at " + K.fmt(p.phi, 1) + "°");
        setR("r", K.fmt(rr, 2) + " m", "mv/qB");
        setR("v", K.fmt(sp, 2) + " m/s", "never changes");
      } else if (key === "helix") {
        var vp = p.v * Math.cos(p.th * K.DEG), vn = p.v * Math.sin(p.th * K.DEG), rh = radius(p, vn), pitch = vp * p.T;
        K.tex(eqEls[0], "v_\\parallel = v\\cos\\theta = " + K.fmt(p.v, 1) + "\\cos" + p.th + "^\\circ = " + K.fmt(vp, 2) + ",\\quad v_\\perp = v\\sin\\theta = " + K.fmt(vn, 2) + "\\ \\text{m/s}");
        K.tex(eqEls[1], "r = \\frac{mv_\\perp}{qB} = \\frac{(" + e3(p.m) + ")(" + K.fmt(vn, 2) + ")}{(" + e3(p.q) + ")(" + K.fmt(p.B, 1) + ")} = " + bold(rh, 2, "m"));
        K.tex(eqEls[2], "T = \\frac{2\\pi m}{qB} = " + bold(p.T, 2, "s") + " \\quad(\\text{no } v, \\text{ no } \\theta)");
        K.tex(eqEls[3], "p = v_\\parallel T = " + K.fmt(vp, 2) + "\\times" + K.fmt(p.T, 2) + " = " + bold(pitch, 2, "m"));
        setR("p", r && r.pitch != null ? K.fmt(r.pitch, 2) + " m" : "—", "formula " + K.fmt(pitch, 2) + " m");
        setR("r", r ? K.fmt(r.r, 2) + " m" : "—", "formula " + K.fmt(rh, 2) + " m");
        setR("T", r && r.T ? K.fmt(r.T, 2) + " s" : "—", "formula " + K.fmt(p.T, 2) + " s");
        setR("vp", K.fmt(v[0], 2) + " m/s", "never changes");
        setR("vn", K.fmt(Math.hypot(v[1], v[2]), 2) + " m/s", "only turns");
        setR("c", K.fmt(TAU * rh, 2) + " m", "equals p at θ = 45°");
      } else if (key === "selector") {
        var fe = p.q * p.E, fb = p.q * p.v * p.B, vsel = p.E / p.B, up = p.bdir < 0 ? 1 : -1;   // + charge: qv×B is up for ⊗
        var net = p.sign * (fb * up - fe);
        K.tex(eqEls[0], "F_E = qE = (" + e3(p.q) + ")(" + K.fmt(p.E, 1) + ") = " + bold(fe, 2, "mN") + (p.sign > 0 ? "\\ \\downarrow" : "\\ \\uparrow"));
        K.tex(eqEls[1], "F_B = qvB = (" + e3(p.q) + ")(" + K.fmt(p.v, 1) + ")(" + K.fmt(p.B, 1) + ") = " + bold(fb, 2, "mN") + (p.sign * up > 0 ? "\\ \\uparrow" : "\\ \\downarrow"));
        K.tex(eqEls[2], "qE = qvB \\Rightarrow v = \\frac{E}{B} = \\frac{" + K.fmt(p.E, 1) + "}{" + K.fmt(p.B, 1) + "} = " + bold(vsel, 2, "m/s") + " \\quad(\\text{no } q, \\text{ no } m)");
        K.tex(eqEls[3], up < 0 ? "\\text{with B out of the screen both forces point the same way: nothing passes}" :
          "v = " + K.fmt(p.v, 1) + (Math.abs(p.v - vsel) < 1e-9 ? " = " : p.v > vsel ? " \\gt " : " \\lt ") + "\\tfrac{E}{B} \\Rightarrow " + (Math.abs(p.v - vsel) < 1e-9 ? "\\text{straight through}" : (p.v > vsel ? "qvB \\text{ wins}" : "qE \\text{ wins}")));
        setR("y", r && r.yExit != null ? K.fmt(r.yExit, 3) + " m" : r && r.hit ? "hit a plate" : "—", r ? (r.pass ? "through the slit" : r.hit ? "" : "blocked") : "at the end of the plates");
        setR("vs", K.fmt(vsel, 2) + " m/s", "E/B");
        setR("fe", K.fmt(fe, 2) + " mN", "qE");
        setR("fb", K.fmt(fb, 2) + " mN", "qvB");
        setR("net", K.fmt(Math.abs(net), 2) + " mN", Math.abs(net) < 1e-9 ? "balanced" : net > 0 ? "up" : "down");
        setR("v", K.fmt(sp, 2) + " m/s", Math.abs(p.v - vsel) < 1e-9 ? "unchanged" : "E does work");
      } else {
        var fc = p.w / TAU, kick = p.q * p.V, km = p.q * p.q * p.B * p.B * p.R * p.R / (2 * p.m), N = km / (2 * kick), m = measure();
        K.tex(eqEls[0], "f = \\frac{qB}{2\\pi m} = \\frac{(" + e3(p.q) + ")(" + K.fmt(p.B, 1) + ")}{2\\pi(" + e3(p.m) + ")} = " + bold(fc, 3, "Hz") + ";\\ \\text{AC at } " + K.fmt(p.f, 3) + "\\ \\text{Hz}");
        K.tex(eqEls[1], "\\Delta KE = qV = (" + e3(p.q) + ")(" + K.fmt(p.V, 1) + ") = " + bold(kick, 2, "mJ") + " \\text{ per crossing}");
        K.tex(eqEls[2], "KE_{max} = \\frac{q^2B^2R^2}{2m} = \\frac{(" + e3(p.q) + ")^2(" + K.fmt(p.B, 1) + ")^2(" + K.fmt(p.R, 1) + ")^2}{2(" + e3(p.m) + ")} = " + bold(km, 1, "mJ"));
        K.tex(eqEls[3], "N = \\frac{KE_{max}}{2qV} = \\frac{" + K.fmt(km, 1) + "}{2(" + K.fmt(kick, 2) + ")} = " + bold(N, 1, "turns") + " \\quad(\\text{a bigger } V \\text{ just gets there sooner})");
        setR("n", String(m.n), m.n ? "each one adds up to qV = " + K.fmt(kick, 2) + " mJ" : "");
        setR("ke", K.fmt(0.5 * p.m * sp * sp, 2) + " mJ", p.fr === 1 ? "n·qV = " + K.fmt(m.n * kick, 2) + " mJ" : "detuned");
        setR("f", m.f ? K.fmt(m.f, 3) + " Hz" : "—", "formula " + K.fmt(fc, 3) + " Hz");
        setR("ko", m.exit ? K.fmt(m.keExit, 2) + " mJ" : "—", m.rExit ? "q²B²r²/2m = " + K.fmt(p.q * p.q * p.B * p.B * m.rExit * m.rExit / (2 * p.m), 2) + " mJ" : "");
        setR("ro", m.rExit ? K.fmt(m.rExit, 2) + " m" : "—", m.rExit ? "mv/qB = " + K.fmt(radius(p, Math.sqrt(2 * m.keExit / p.m)), 2) + " m, dee " + K.fmt(p.R, 1) + " m" : "");
        setR("km", K.fmt(km, 1) + " mJ", "the orbits wander a little off centre, so it leaves just short");
      }
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A magnetic field pushes only on <b>moving</b> charges, and always <b>sideways</b>: $\\vec F = q\\,\\vec v \\times \\vec B$. Because the push is at 90° to the motion it does no work, so the speed never changes; only the direction does. A steady sideways push of fixed size is exactly what a circle needs: $qvB = mv^2/r$, so $r = mv/qB$.</p>" +
      "<p>The time for one lap, $T = 2\\pi m/qB$, has no $v$ in it. Any velocity along $B$ feels no force at all, so it simply carries the circle along: a helix with pitch $v_\\parallel T$. Add an electric field across the magnetic one and the two pushes cancel for one speed, $v = E/B$.</p>" +
      '<div class="trap"><b>JEE trap: a magnetic field cannot change a charge\'s kinetic energy.</b> It changes the velocity (direction), so momentum changes, but $KE$ stays put. In a cyclotron the energy comes from the electric field across the gap; the magnetic field only brings the charge back to it, in step.</div>');

    function apply(s) {
      qS.set(s.q); mS.set(s.m); BS.set(s.B);
      if (s.v != null) vS.set(s.v);
      if (s.phi != null) phS.set(s.phi);
      if (s.th != null) thS.set(s.th);
      if (s.E != null) ES.set(s.E);
      if (s.V != null) VS.set(s.V);
      if (s.fr != null) fS.set(s.fr);
      if (s.R != null) RS.set(s.R);
      sign = s.sign || 1; setSeg(signSeg, sign);
      bdir = s.bdir || 1; setSeg(dirSeg, bdir);
      region = s.region || "all"; setSeg(regSeg, region);
      race = !!s.race; raceChk.querySelector("input").checked = race;
      setMode(s.mode, true);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "period and speed", setup: { mode: "circle", q: 1, m: 1, B: 1, v: 4, phi: 0, race: true }, watch: "Three speeds, one field. Predict who gets back first, then press Fire",
        q: "A charged particle circles in a uniform magnetic field with a period of 6.28 s. Its speed is doubled. What is the new period?",
        options: ["3.14 s", "6.28 s", "12.6 s", "25.1 s"], answer: 1,
        explain: "$T = 2\\pi m/qB$ has no $v$ in it. Doubling the speed doubles the radius ($r = mv/qB$), so the circle is twice as long, but the particle goes round it twice as fast: the period stays 6.28 s." },
      { level: "medium", tag: "helix pitch", setup: { mode: "helix", q: 1, m: 1, B: 1, v: 4, th: 60 }, watch: "Predict the pitch, then press Fire and read it off",
        q: "A particle with $q/m = 1$ C/kg moves at 4 m/s at 60° to a uniform 1 T magnetic field. What is the pitch of its helix?",
        options: ["6.28 m", "12.6 m", "21.8 m", "25.1 m"], answer: 1,
        hints: ["Only the part of v across B makes a circle. The part along B, $v\\cos\\theta$, is untouched.", "The pitch is how far that untouched part carries it in one period: $p = v\\cos\\theta \\times 2\\pi m/qB$."],
        explain: "$T = 2\\pi m/qB = 2\\pi$ s $= 6.28$ s and $v_\\parallel = 4\\cos 60° = 2$ m/s, so $p = 2 \\times 6.28 = 12.6$ m. Using $v\\sin\\theta$ gives 21.8 m, and using the full $v$ gives 25.1 m." },
      { level: "hard", tag: "entering a field region", setup: { mode: "circle", region: "edge", q: 1, m: 1, B: 1, bdir: 1, sign: 1, v: 4, phi: 30 }, watch: "Predict both numbers, then press Fire",
        q: "A positive particle ($q/m = 1$ C/kg, 4 m/s) crosses into a region $x \\ge 0$ that holds a uniform 1 T field pointing out of the screen. It enters at 30° to the normal, heading upward. How long does it stay in the field, and how far from the entry point does it leave?",
        options: ["4.19 s and 6.93 m", "2.09 s and 6.93 m", "3.14 s and 8.00 m", "4.19 s and 4.00 m"], answer: 0,
        hints: ["For a + charge with B out of the screen, $q\\vec v \\times \\vec B$ turns it clockwise. Sketch the circle: does it take the short arc or the long one?", "By symmetry it leaves at 30° to the normal on the other side. The chord along the boundary is $2r\\cos 30°$ and the angle turned is $180° + 2(30°)$."],
        explain: "$r = mv/qB = 4$ m and $T = 2\\pi$ s. Turning clockwise from 30° above the normal, it sweeps $180° + 60° = 240°$ before it comes back out, so $t = \\tfrac{240}{360} \\times 6.28 = 4.19$ s. It leaves $2r\\cos 30° = 6.93$ m below the entry point. A negative charge would take the short arc: $120°$, 2.09 s." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Fire", onReset: reset, onPlay: function () { if (run.done) reset(); } });
    showGroups();
    reset();

    if (location.hostname === "localhost") window.__lab_lorentz = { apply: apply, run: function () { return run; }, measure: measure, params: params, tries: tries, setMode: setMode };

    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_lorentz) delete window.__lab_lorentz; };
  }
})();
