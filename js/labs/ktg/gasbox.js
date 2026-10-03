/* Kinetic theory, lab 1: molecules in a box. Hard discs bounce elastically off each other and the walls;
   the pressure is the momentum they deliver to the walls, per unit time and per unit length of wall. */
(function () {
  "use strict";
  var KB = 1.380649e-23, AMU = 1.66053907e-27;
  var BOX_H = 20, R_MOL = 0.15, SIG = 2 * R_MOL;   // box height, disc radius and diameter (nm)
  var W_MIN = 5, W_MAX = 30;                         // piston travel (nm)
  var U_MAX = 0.005;                                 // a held piston glides at most 0.005 nm/ps (5 m/s), slow next to the molecules
  var M_PISTON = 10000 * AMU;                        // a free piston's mass (kg)
  var GASES = [{ label: "He", value: 4 }, { label: "N₂", value: 28 }, { label: "Ar", value: 40 }];

  var lab = {
    id: "gasbox", chapter: "ktg", title: "Molecules in a box", short: "pressure from collisions, PV = NkT",
    lede: "A few dozen molecules, nothing but elastic bounces. Count the momentum they hand to the walls and you get the pressure, and Boyle's and Charles's laws fall out on their own.",
    tries: [
      { id: "boyle", title: "Show Boyle's law",
        text: "With the heat bath on, measure the pressure at one width, then halve the area (or more) and measure again.",
        why: "Same molecules, same speeds, but each one now hits a wall twice as often, so $P$ doubles: $PA$ stays at $NkT$. That's Boyle's law, $P \\propto 1/V$ at fixed $T$." },
      { id: "charles", title: "Show Charles's law",
        text: "Free the piston so the outside pressure holds $P$ fixed. Let it settle, then at least 1.5× the temperature and let it settle again.",
        why: "Faster molecules hit harder and more often, so they push the piston out until $P$ is back to $P_{ext}$. With $P$ fixed, $A = NkT/P \\propto T$." },
      { id: "squeeze", title: "Heat the gas just by squeezing it",
        text: "Switch to insulated walls and push the piston in until the temperature has risen by half.",
        why: "A molecule bouncing off an incoming piston comes back faster, like a ball off a moving bat. With no heat bath to take that energy away, $T$ rises: an adiabatic compression. For this 2D gas $TA$ stays constant ($\\gamma = 2$)." },
      { id: "heavy", title: "Change the gas, keep the pressure",
        text: "Measure $P$ for one gas, then switch to another at the same $N$, $T$ and width.",
        why: "Heavier molecules move slower, but each hit carries more momentum. The two effects cancel exactly: $P = NkT/A$ has no mass in it. Equal temperature means equal mean kinetic energy." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  // small seeded random generator, so every reset is a fresh but repeatable gas
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Hard-disc equation of state (Henderson): how much real discs raise P above the ideal NkT/A
  function zHard(eta) { return (1 + eta * eta / 8) / ((1 - eta) * (1 - eta)); }
  function etaOf(n, A) { return n * Math.PI * R_MOL * R_MOL / A; }

  /* ---------- the gas: hard discs, centres in [0, w] x [0, BOX_H]. Units nm, ps, kg ---------- */
  function Gas(rnd) { this.rnd = rnd; this.acc = { J: 0, J2: 0, Ldt: 0, Adt: 0, t: 0 }; this.hits = []; }
  Gas.prototype.init = function (n, m, T, w) {
    var rnd = this.rnd, i, j, tries;
    this.n = n; this.m = m; this.w = w; this.up = 0;
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.ord = [];
    for (i = 0; i < n; i++) {
      for (tries = 0; tries < 400; tries++) {
        this.x[i] = rnd() * w; this.y[i] = rnd() * BOX_H;
        for (j = 0; j < i; j++) if (Math.hypot(this.x[i] - this.x[j], this.y[i] - this.y[j]) < SIG * 1.5) break;
        if (j === i) break;
      }
      this.ord.push(i);
    }
    // Maxwell–Boltzmann velocities (each component Gaussian), then scaled to exactly KE = NkT
    var s = Math.sqrt(KB * T / m / 1e6);
    for (i = 0; i < n; i++) {
      var r = Math.sqrt(-2 * Math.log(1 - rnd())), a = 2 * Math.PI * rnd();
      this.vx[i] = s * r * Math.cos(a); this.vy[i] = s * r * Math.sin(a);
    }
    this.setT(T);
  };
  Gas.prototype.ke = function () {   // total kinetic energy (J); (nm/ps)^2 = 1e6 m^2/s^2
    var e = 0;
    for (var i = 0; i < this.n; i++) e += this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
    return 0.5 * this.m * e * 1e6;
  };
  Gas.prototype.T = function () { return this.ke() / (this.n * KB); };     // 2D: two quadratic terms, KE = NkT
  Gas.prototype.scale = function (f) { for (var i = 0; i < this.n; i++) { this.vx[i] *= f; this.vy[i] *= f; } };
  Gas.prototype.setT = function (T) { this.scale(Math.sqrt(T / this.T())); };
  Gas.prototype.setMass = function (m) { this.scale(Math.sqrt(this.m / m)); this.m = m; };   // same T: v ∝ 1/√m
  Gas.prototype.vmax = function () {
    var v = 0;
    for (var i = 0; i < this.n; i++) v = Math.max(v, this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    return Math.sqrt(v);
  };
  // advance dt ps; pis = { free, target, F (kg nm/ps²), damp (1/ps) }
  Gas.prototype.step = function (dt, pis) {
    var vmax = this.vmax() + Math.abs(this.up) + 1e-9;
    var nsub = Math.max(1, Math.ceil(dt * vmax / (0.3 * SIG))), h = dt / nsub;
    for (var s = 0; s < nsub; s++) this.sub(h, pis, 1.5 * vmax);
  };
  Gas.prototype.sub = function (h, pis, vmax) {
    var n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, m = this.m, ord = this.ord, acc = this.acc;
    var a, b, i, j, k;
    // 1. pair collisions during this substep, found exactly from the quadratic for |r_ij(t)| = σ.
    //    Each disc's start is shifted so the straight move below lands it where the bounce sends it.
    for (a = 1; a < n; a++) {                         // insertion sort by x: nearly sorted already
      k = ord[a];
      for (b = a - 1; b >= 0 && x[ord[b]] > x[k]; b--) ord[b + 1] = ord[b];
      ord[b + 1] = k;
    }
    var reach = SIG + 2 * vmax * h;
    for (a = 0; a < n; a++) {
      i = ord[a];
      for (b = a + 1; b < n; b++) {
        j = ord[b];
        var dx = x[j] - x[i];
        if (dx > reach) break;
        var dy = y[j] - y[i];
        if (dy > reach || dy < -reach) continue;
        var dvx = vx[j] - vx[i], dvy = vy[j] - vy[i], bb = dx * dvx + dy * dvy;
        if (bb >= 0) continue;                        // moving apart
        var cc = dx * dx + dy * dy - SIG * SIG, aa = dvx * dvx + dvy * dvy, tc = 0;
        if (cc > 0) {
          var disc = bb * bb - aa * cc;
          if (disc < 0) continue;
          tc = (-bb - Math.sqrt(disc)) / aa;
          if (tc > h) continue;
        }
        var cx = dx + dvx * tc, cy = dy + dvy * tc, d = Math.hypot(cx, cy), nx = cx / d, ny = cy / d;
        var dvn = dvx * nx + dvy * ny;                // < 0: approaching
        // equal masses: swap the normal components of velocity. Energy and momentum are exact.
        var ix = dvn * nx, iy = dvn * ny;
        vx[i] += ix; vy[i] += iy; vx[j] -= ix; vy[j] -= iy;
        x[i] -= ix * tc; y[i] -= iy * tc; x[j] += ix * tc; y[j] += iy * tc;
      }
    }
    // 2. move
    for (i = 0; i < n; i++) { x[i] += vx[i] * h; y[i] += vy[i] * h; }
    // 3. piston
    if (pis.free) {
      this.up += -pis.F / M_PISTON * h;
      if (pis.damp) this.up *= Math.exp(-pis.damp * h);
      this.w += this.up * h;
    } else {
      var dw = Math.max(-U_MAX * h, Math.min(U_MAX * h, pis.target - this.w));
      this.up = dw / h; this.w += dw;
    }
    if (this.w < W_MIN) { this.w = W_MIN; if (this.up < 0) this.up = 0; }
    if (this.w > W_MAX) { this.w = W_MAX; if (this.up > 0) this.up = 0; }
    // 4. walls: reflect, and add up the momentum each bounce hands over (2m v⊥ on a fixed wall)
    var w = this.w, J;
    for (i = 0; i < n; i++) {
      if (x[i] < 0) { x[i] = -x[i]; if (vx[i] < 0) { J = -2 * m * vx[i]; vx[i] = -vx[i]; this.hit(J, 0, y[i], 0); } }
      if (y[i] < 0) { y[i] = -y[i]; if (vy[i] < 0) { J = -2 * m * vy[i]; vy[i] = -vy[i]; this.hit(J, x[i], 0, 1); } }
      if (y[i] > BOX_H) { y[i] = 2 * BOX_H - y[i]; if (vy[i] > 0) { J = 2 * m * vy[i]; vy[i] = -vy[i]; this.hit(J, x[i], BOX_H, 1); } }
      if (x[i] > w) {
        if (vx[i] > this.up) {
          var v2;
          if (pis.free) {                             // 1D elastic collision with the piston's mass
            v2 = ((m - M_PISTON) * vx[i] + 2 * M_PISTON * this.up) / (m + M_PISTON);
            this.up = ((M_PISTON - m) * this.up + 2 * m * vx[i]) / (m + M_PISTON);
          } else v2 = 2 * this.up - vx[i];             // a held piston is a moving wall: v' = 2u − v
          this.hit(m * (vx[i] - v2), w, y[i], 0);
          vx[i] = v2;
        }
        x[i] = Math.max(0, 2 * w - x[i]);
      }
    }
    acc.Ldt += (2 * BOX_H + 2 * w) * h; acc.Adt += w * BOX_H * h; acc.t += h;
  };
  Gas.prototype.hit = function (J, x, y, side) {
    this.acc.J += J; this.acc.J2 += J * J;
    if (this.hits.length < 160) this.hits.push({ x: x, y: y, side: side, age: 0 });
  };
  Gas.prototype.take = function () { var a = this.acc; this.acc = { J: 0, J2: 0, Ldt: 0, Adt: 0, t: 0 }; return a; };

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 20, origin = { x: 70, y: 470 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, grid: false });
    var seed = 1, gas = new Gas(rng(seed));

    /* ---------- controls ---------- */
    var walls = "bath", piston = "held", molar = 28, turbo = false;
    var nS = K.slider({ label: "Molecules $N$", min: 20, max: 150, step: 10, value: 60, onInput: rebuild });
    var tS = K.slider({ label: "Temperature $T$", unit: "K", min: 100, max: 1500, step: 10, value: 300, onInput: heat,
      hint: "Moving it heats or cools the gas: every speed scales by $\\sqrt{T_{new}/T_{old}}$." });
    var wS = K.slider({ label: "Box width $w$", unit: "nm", min: W_MIN, max: W_MAX, step: 0.5, value: 20, onInput: function () { changed(); },
      hint: "Or drag the piston. It glides slowly so the gas keeps up." });
    var pS = K.slider({ label: "Outside pressure $P_{ext}$", unit: "mN/m", min: 0.4, max: 4, step: 0.1, value: 1.5, onInput: function () { changed(); } });
    P.controls.innerHTML = "<h3>Gas</h3>";
    var gasSeg = K.seg(GASES, molar, function (v) { molar = v; gas.setMass(v * AMU); changed(); }, "Gas");
    P.controls.appendChild(gasSeg);
    [nS, tS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Walls</h3>"));
    var wallSeg = K.seg([{ label: "Heat bath (fixed T)", value: "bath" }, { label: "Insulated", value: "ins" }], walls, function (v) {
      walls = v; if (v === "bath") gas.setT(tS.get()); adiRef(); changed();
    }, "Walls");
    P.controls.appendChild(wallSeg);
    P.controls.appendChild(K.h("<h3>Piston</h3>"));
    var pisSeg = K.seg([{ label: "Held", value: "held" }, { label: "Free (pushed by P_ext)", value: "free" }], piston, function (v) {
      piston = v; showPiston(); if (v === "held") wS.set(Math.round(gas.w * 2) / 2); gas.up = 0; changed();
    }, "Piston");
    P.controls.appendChild(pisSeg);
    P.controls.appendChild(wS.el); P.controls.appendChild(pS.el);
    function showPiston() { wS.el.hidden = piston !== "held"; pS.el.hidden = piston !== "free"; }
    showPiston();
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Fast-forward ×10", false, function (v) { turbo = v; }));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend"><span style="color:' + th.disp + '"><i></i>slow molecule</span><span style="color:' + th.fric + '"><i></i>fast molecule</span>' +
      '<span class="c-app"><i></i>wall hits, pressure</span><span class="c-acc"><i></i>temperature</span><span class="c-disp"><i></i>area</span></div>'));
    P.controls.appendChild(K.h('<p class="control-hint">Tap a molecule to follow it.</p>'));
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }

    /* ---------- state + measurement ---------- */
    var gasT = 0, meas, buckets, trace, runs = [], cur = null, tracer = -1, trail = [], adi, path = [];
    var SETTLE = { held: 100, free: 800 };       // ps to wait after a change before averaging
    function newMeas() {
      meas = { J: 0, J2: 0, Ldt: 0, Adt: 0, Tdt: 0, t: 0, wait: SETTLE[piston], since: 0 };
      buckets = []; trace = { t: [], pw: [], pc: [] };
    }
    function adiRef() { adi = { T0: gas.T(), A0: gas.w * BOX_H, Tz: gas.T(), Alast: gas.w * BOX_H }; }
    function rebuild() {
      sim.pause(); if (transportUI) transportUI.render();
      gas = new Gas(rng(seed++));
      var w0 = piston === "held" ? wS.get() : K.clamp(predictA(tS.get()) / BOX_H, W_MIN, W_MAX);
      gas.init(nS.get(), molar * AMU, tS.get(), w0);
      gasT = 0; tracer = -1; trail = []; path = []; cur = null;
      adiRef(); newMeas(); P.time.textContent = "t = 0 ps";
      update(true);
    }
    function changed() {
      if (cur && cur.ok) { runs.push(cur); if (runs.length > 40) runs.shift(); }
      cur = null; path = []; newMeas(); update(true);
    }
    function heat(v) { gas.setT(v); adiRef(); changed(); }
    function Pext() { return pS.get() * 1e-3; }      // N/m
    // area the free piston settles at: P_ext = Z(η) NkT/A, solved by iteration
    function predictA(T, ideal) {
      var A = nS.get() * KB * T / Pext() * 1e18;
      if (!ideal) for (var k = 0; k < 30; k++) A = nS.get() * KB * T * zHard(etaOf(nS.get(), A)) / Pext() * 1e18;
      return A;
    }

    sim.on("before", function () {
      var dt = turbo ? 10 : 1, Tset = tS.get();
      var free = piston === "free";
      var F = Pext() * BOX_H * 1e-9 * 1e-15;          // N -> kg nm/ps²
      var wBefore = gas.w;
      gas.step(dt, { free: free, target: wS.get(), F: F, damp: free && walls === "bath" ? 1 / 150 : 0 });
      if (walls === "bath") gas.setT(Tset);           // the bath hands back or soaks up whatever the piston did
      gasT += dt;
      var a = gas.take(), T = gas.T();
      var moving = !free && Math.abs(gas.w - wS.get()) > 1e-9;
      if (moving || Math.abs(gas.w - wBefore) > 1e-12 && !free) { meas.wait = SETTLE.held; meas.J = meas.J2 = meas.Ldt = meas.Adt = meas.Tdt = meas.t = 0; buckets = []; trace = { t: [], pw: [], pc: [] }; meas.since = 0; }
      // adiabatic bookkeeping: ideal 2D gas keeps TA fixed; real discs follow d ln T = −Z d ln A
      var A = gas.w * BOX_H;
      if (A !== adi.Alast) { adi.Tz *= Math.exp(-zHard(etaOf(gas.n, 0.5 * (A + adi.Alast))) * Math.log(A / adi.Alast)); adi.Alast = A; }
      if (walls === "ins") { var Ts = K.clamp(Math.round(T / 10) * 10, 100, 1500); if (Ts !== tS.get()) tS.set(Ts); }
      if (moving && walls === "ins") path.push([A, gas.n * KB * T / (A * 1e-18) * 1e3]);
      if (meas.wait > 0) { meas.wait -= dt; }
      else {
        meas.J += a.J; meas.J2 += a.J2; meas.Ldt += a.Ldt; meas.Adt += a.Adt; meas.Tdt += T * a.t; meas.t += a.t; meas.since += dt;
        buckets.push([a.J, a.Ldt]);
        if (gasT % 10 === 0 || turbo) {
          var bj = 0, bl = 0;
          for (var k = Math.max(0, buckets.length - 50); k < buckets.length; k++) { bj += buckets[k][0]; bl += buckets[k][1]; }
          trace.t.push(meas.since); trace.pw.push(bj / bl * 1e24 * 1e3); trace.pc.push(meas.J / meas.Ldt * 1e24 * 1e3);
        }
      }
      if (tracer >= 0) { trail.push([gas.x[tracer], gas.y[tracer]]); if (trail.length > 400) trail.shift(); }
      gas.hits.forEach(function (hh) { hh.age += 1; });
      gas.hits = gas.hits.filter(function (hh) { return hh.age < 14; });
    });
    sim.on("step", function () { result(); checkTries(); update(false); });

    // the current measurement: P from the walls, and what kinetic theory predicts for the same N, T, A
    function result() {
      var n = gas.n, T = meas.t ? meas.Tdt / meas.t : gas.T(), A = meas.t ? meas.Adt / meas.t : gas.w * BOX_H;
      var Pm = meas.Ldt ? meas.J / meas.Ldt * 1e24 : NaN, err = meas.Ldt ? Math.sqrt(meas.J2) / meas.Ldt * 1e24 : NaN;
      var Pi = n * KB * T / (A * 1e-18), Z = zHard(etaOf(n, A));
      cur = { n: n, T: T, A: A, P: Pm, err: err, Pi: Pi, Pz: Pi * Z, Z: Z, gas: molar, walls: walls, piston: piston, Pext: pS.get(), t: meas.since,
        ok: meas.since >= (piston === "free" ? 2000 : 600) && err / Pm < 0.03 };
      return cur;
    }
    function checkTries() {
      var c = cur, all = runs.concat(c && c.ok ? [c] : []);
      if (!c || !c.ok) { squeeze(); return; }
      all.forEach(function (r) {
        if (r === c) return;
        if (r.walls === "bath" && c.walls === "bath" && r.piston === "held" && c.piston === "held" && r.n === c.n && Math.abs(r.T - c.T) < 1 &&
            r.gas === c.gas && Math.max(r.A, c.A) / Math.min(r.A, c.A) >= 1.8 && Math.abs(r.P * r.A - c.P * c.A) / (c.P * c.A) < 0.06) tries.mark("boyle");
        if (r.piston === "free" && c.piston === "free" && r.n === c.n && r.Pext === c.Pext && Math.max(r.T, c.T) / Math.min(r.T, c.T) >= 1.45 &&
            Math.abs(r.A / r.T - c.A / c.T) / (c.A / c.T) < 0.06) tries.mark("charles");
        if (r.piston === "held" && c.piston === "held" && r.n === c.n && Math.abs(r.T - c.T) < 1 && Math.abs(r.A - c.A) < 1e-6 && r.gas !== c.gas &&
            Math.abs(r.P - c.P) / c.P < 0.06) tries.mark("heavy");
      });
      squeeze();
    }
    function squeeze() {
      if (walls === "ins" && gas.w * BOX_H < adi.A0 - 1e-6 && gas.T() >= 1.5 * adi.T0) tries.mark("squeeze");
    }

    /* ---------- direct manipulation: drag the piston, tap a molecule ---------- */
    var dragging = false;
    sim.pointer({
      down: function (pt) {
        var mx = pt.m.x, my = pt.m.y;
        if (piston === "held" && Math.abs(mx - gas.w - R_MOL) < 1.4 && my > -1 && my < BOX_H + 1) { dragging = true; return true; }
        var best = -1, bd = 0.8;
        for (var i = 0; i < gas.n; i++) { var d = Math.hypot(gas.x[i] - mx, gas.y[i] - my); if (d < bd) { bd = d; best = i; } }
        if (best >= 0) { tracer = best === tracer ? -1 : best; trail = []; K.flash(P.note, tracer >= 0 ? "Following one molecule: straight lines between bounces" : "Stopped following"); }
        return false;
      },
      drag: function (pt) { if (!dragging) return; wS.set(K.clamp(Math.round(pt.m.x * 2) / 2, W_MIN, W_MAX)); changed(); },
      up: function () { dragging = false; }
    });

    /* ---------- drawing ---------- */
    function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function mix(a, b, t) { var p = hex(a), q = hex(b); if (!p || !q) return a; return "rgb(" + p.map(function (v, i) { return Math.round(v + (q[i] - v) * t); }).join(",") + ")"; }
    sim.on("under", function (ctx) {
      var b0 = sim.px(-R_MOL, -R_MOL), b1 = sim.px(gas.w + R_MOL, BOX_H + R_MOL), wall = sim.u(6);
      ctx.fillStyle = th.surface; ctx.fillRect(b0.x, b1.y, b1.x - b0.x, b0.y - b1.y);
      ctx.fillStyle = walls === "bath" ? K.alpha(th.acc, 0.85) : th.body;
      ctx.fillRect(b0.x - wall, b1.y - wall, wall, b0.y - b1.y + 2 * wall);                    // left
      ctx.fillRect(b0.x - wall, b1.y - wall, sim.px(W_MAX + 2, 0).x - b0.x, wall);               // top
      ctx.fillRect(b0.x - wall, b0.y, sim.px(W_MAX + 2, 0).x - b0.x, wall);                      // bottom
      // scale ticks every 5 nm
      ctx.fillStyle = th.muted; ctx.font = "600 " + sim.u(11) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var xm = 0; xm <= W_MAX; xm += 5) { var q = sim.px(xm, 0); ctx.fillRect(q.x - 0.5, b0.y + wall, 1, sim.u(5)); ctx.fillText(xm + " nm", q.x, b0.y + wall + sim.u(7)); }
      ctx.save(); ctx.translate(b0.x - wall - sim.u(8), sim.px(0, BOX_H / 2).y); ctx.rotate(-Math.PI / 2);
      K.label(ctx, "height " + BOX_H + " nm", 0, 0, th.muted, { s: sim.u(1) }); ctx.restore();
      // piston + rod
      var px0 = b1.x, top = b1.y, bot = b0.y;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
      ctx.fillRect(px0, top, sim.u(12), bot - top); ctx.strokeRect(px0, top, sim.u(12), bot - top);
      ctx.fillStyle = th.body; ctx.fillRect(px0 + sim.u(12), sim.px(0, BOX_H / 2).y - sim.u(4), sim.px(W_MAX + 3, 0).x - px0, sim.u(8));
      var mid = sim.px(0, BOX_H / 2).y;
      if (piston === "free") {
        var ax = sim.px(W_MAX + 3, 0).x + sim.u(60);
        K.arrow(ctx, ax, mid - sim.u(26), ax - sim.u(50), mid - sim.u(26), th.app, { s: sim.u(1), label: "P_ext", lx: -10, ly: -14 });
      } else {
        K.label(ctx, dragging ? "w = " + K.fmt(wS.get(), 1) + " nm" : "drag ↔", px0 + sim.u(6), top - sim.u(10), th.muted, { s: sim.u(1), bg: dragging });
      }
      // wall hits: magenta ticks that fade
      ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(2.5);
      gas.hits.forEach(function (hh) {
        var p = sim.px(hh.side ? hh.x : (hh.x > 0 ? hh.x + R_MOL : -R_MOL), hh.side ? (hh.y > 0 ? BOX_H + R_MOL : -R_MOL) : hh.y), L = sim.u(7);
        ctx.globalAlpha = 1 - hh.age / 14;
        ctx.beginPath();
        if (hh.side) { ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y); } else { ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L); }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      drawGauges(ctx);
    });
    sim.on("over", function (ctx) {
      var vr = Math.sqrt(2 * KB * gas.T() / gas.m / 1e6), r = R_MOL * ppm;
      if (tracer >= 0 && trail.length > 1) {
        ctx.strokeStyle = K.alpha(th.ink, 0.5); ctx.lineWidth = sim.u(1.2); ctx.beginPath();
        trail.forEach(function (p, i) { var q = sim.px(p[0], p[1]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
        ctx.stroke();
      }
      for (var i = 0; i < gas.n; i++) {
        var s = Math.hypot(gas.vx[i], gas.vy[i]) / (2 * vr), p = sim.px(gas.x[i], gas.y[i]);
        ctx.fillStyle = mix(th.disp, th.fric, K.clamp(s, 0, 1));
        ctx.beginPath(); ctx.arc(p.x, p.y, i === tracer ? r * 1.7 : r, 0, Math.PI * 2); ctx.fill();
      }
      if (tracer >= 0) {
        var tp = sim.px(gas.x[tracer], gas.y[tracer]), k = 60;
        K.arrow(ctx, tp.x, tp.y, tp.x + gas.vx[tracer] * k, tp.y - gas.vy[tracer] * k, th.vel, { s: sim.u(1), label: K.fmt(Math.hypot(gas.vx[tracer], gas.vy[tracer]) * 1000, 0) + " m/s" });
      }
    });
    // two bars on the right: measured P against NkT/A, and the temperature
    function drawGauges(ctx) {
      var c = cur || result(), x0 = 800, y0 = 430, hh = 330, pMax = [0.5, 1, 2, 4, 8, 16, 32].filter(function (q) { return q >= c.Pi * 1e3 * 1.3; })[0] || 64;
      ctx.save();
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.line; ctx.lineWidth = 1;
      ctx.fillRect(x0 - 30, y0 - hh - 40, 200, hh + 80); ctx.strokeRect(x0 - 30, y0 - hh - 40, 200, hh + 80);
      var yP = function (v) { return y0 - hh * K.clamp(v / pMax, 0, 1); };
      ctx.fillStyle = K.alpha(th.app, 0.8);
      if (isFinite(c.P)) ctx.fillRect(x0, yP(c.P * 1e3), 34, y0 - yP(c.P * 1e3));
      ctx.strokeStyle = th.app; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 6, yP(c.Pi * 1e3)); ctx.lineTo(x0 + 40, yP(c.Pi * 1e3)); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "P", x0 + 17, y0 + 18, th.app);
      K.label(ctx, isFinite(c.P) ? K.fmt(c.P * 1e3, 2) : "…", x0 + 17, yP(isFinite(c.P) ? c.P * 1e3 : 0) - 2, th.app);
      K.label(ctx, "NkT/A", x0 + 44, yP(c.Pi * 1e3) + 8, th.app, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      var tx = x0 + 100, yT = function (v) { return y0 - hh * K.clamp(v / 1600, 0, 1); }, T = gas.T();
      ctx.fillStyle = K.alpha(th.acc, 0.85); ctx.fillRect(tx, yT(T), 22, y0 - yT(T));
      ctx.beginPath(); ctx.arc(tx + 11, y0 + 4, 15, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, K.fmt(T, 0) + " K", tx + 11, yT(T) - 2, th.acc);
      K.label(ctx, "mN/m", x0 + 17, y0 + 34, th.muted, { font: "600 10px 'JetBrains Mono', monospace" });
      K.label(ctx, "top: " + pMax + " mN/m", x0 + 17, y0 - hh - 8, th.muted, { font: "600 10px 'JetBrains Mono', monospace" });
      ctx.restore();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">P–t</b> · thin: last 50 ps of hits, jumpy. Thick: everything since the last change, settling on NkT/A</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">P–A</b> · dashed: the isotherm $P = NkT/A$; dots are your settled runs</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">PA/N vs T</b> · every run, any gas, any N, lands on one line of slope $k$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gt = new K.Graph(cv[0], { yLabel: "P (mN/m)", xLabel: "t (ps)", xMax: 400, xAuto: true, yMin: 0, color: th.app });
    var gp = new K.Graph(cv[1], { yLabel: "P (mN/m)", xLabel: "A (nm²)", xMax: W_MAX * BOX_H, yMin: 0, color: th.app });
    var gk = new K.Graph(cv[2], { yLabel: "PA/N (10⁻²¹ J)", xLabel: "T (K)", xMax: 1500, yMin: 0, color: th.acc });

    var slowMaths = K.throttle(renderMaths, 120), slowGraphs = K.throttle(drawGraphs, 60);
    function update(force) { if (force) { drawGraphs(); renderMaths(); } else { slowGraphs(); slowMaths(); } }
    function drawGraphs() {
      var c = cur || result(), n = gas.n, T = c.T;
      gt.set("win", { points: trace.t.map(function (t, i) { return [t, trace.pw[i]]; }), color: K.alpha(th.app, 0.45), width: 1.2 });
      gt.set("sim", { points: trace.t.map(function (t, i) { return [t, trace.pc[i]]; }), color: th.app, width: 2.5, dot: true });
      var tEnd = Math.max(400, trace.t.length ? trace.t[trace.t.length - 1] : 0);
      gt.set("theory", { points: [[0, c.Pi * 1e3], [tEnd, c.Pi * 1e3]], color: th.app, dash: [5, 5], width: 1.5 });
      var iso = [];
      for (var A = 60; A <= W_MAX * BOX_H; A += 6) iso.push([A, n * KB * T / (A * 1e-18) * 1e3]);
      gp.set("theory", { points: iso, color: th.app, dash: [5, 5], width: 1.5 });
      gp.set("path", { points: path.slice(), color: th.acc, width: 2 });
      var line = [[0, 0], [1500, KB * 1500 * 1e21]];
      gk.set("theory", { points: line, color: th.acc, dash: [5, 5], width: 1.5 });
      var mine = runs.filter(function (r) { return r.n === n; });
      gp.extra = function (ctx, X, Y) { dots(ctx, mine.map(function (r) { return [X(r.A), Y(r.P * 1e3)]; }), th.app); if (isFinite(c.P)) ring(ctx, X(c.A), Y(c.P * 1e3)); };
      gk.extra = function (ctx, X, Y) {
        dots(ctx, runs.map(function (r) { return [X(r.T), Y(r.P * r.A * 1e-18 / r.n * 1e21)]; }), th.acc);
        if (isFinite(c.P)) ring(ctx, X(c.T), Y(c.P * c.A * 1e-18 / c.n * 1e21));
      };
      [gt, gp, gk].forEach(function (g) { g.dirty = true; g.draw(); });
    }
    function dots(ctx, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Pressure is momentum delivered per second, per metre of wall", "Kinetic theory for this 2D box: PA = ½Nm⟨v²⟩ = NkT",
      "The 3D textbook version", "Temperature is mean kinetic energy"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "P", label: "pressure, measured", cls: "c-app" }, { id: "Pi", label: "NkT/A", cls: "c-app" }, { id: "T", label: "temperature", cls: "c-acc" },
      { id: "A", label: "area A", cls: "c-disp" }, { id: "ke", label: "mean KE", cls: "c-acc" }, { id: "v", label: "v_rms", cls: "c-vel" },
      { id: "E", label: "total KE", cls: "c-acc" }, { id: "hits", label: "wall hits", cls: "c-app" }
    ]);
    function sci(v) { var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e); return K.fmt(m, 2) + "\\times10^{" + e + "}"; }
    function renderMaths() {
      var c = cur || result(), n = c.n, T = c.T, A = c.A, m = gas.m, ke = gas.ke(), vr = Math.sqrt(2 * KB * T / m);
      var Pm = isFinite(c.P) ? K.fmt(c.P * 1e3, 3) : "\\dots";
      K.tex(eqEls[0], "P = \\frac{\\sum 2m v_\\perp}{L_{walls}\\,\\Delta t} = \\mathbf{" + Pm + "}\\ \\text{mN/m}" +
        (isFinite(c.err) ? "\\ \\pm " + K.fmt(c.err * 1e3, 3) : "") + "\\quad(\\Delta t = " + K.fmt(c.t, 0) + "\\ \\text{ps})");
      K.tex(eqEls[1], "P = \\frac{NkT}{A} = \\frac{" + n + "(1.38\\times10^{-23})(" + K.fmt(T, 0) + ")}{" + K.fmt(A, 1) + "\\times10^{-18}} = \\mathbf{" + K.fmt(c.Pi * 1e3, 3) + "}\\ \\text{mN/m}" +
        "\\;\\;\\text{(discs of real size: } \\times" + K.fmt(c.Z, 3) + " = " + K.fmt(c.Pz * 1e3, 3) + ")");
      K.tex(eqEls[2], "PV = \\tfrac13 N m \\langle v^2\\rangle = NkT, \\quad \\langle KE\\rangle = \\tfrac32 kT = " + sci(1.5 * KB * T) + "\\ \\text{J}");
      K.tex(eqEls[3], "\\text{2D: } \\langle KE\\rangle = \\tfrac22 kT \\Rightarrow \\frac{" + sci(ke / n) + "}{1.38\\times10^{-23}} = \\mathbf{" + K.fmt(ke / n / KB, 1) + "}\\ \\text{K}");
      setR("P", isFinite(c.P) ? K.fmt(c.P * 1e3, 3) + " mN/m" : "averaging…", isFinite(c.err) ? "± " + K.fmt(c.err * 1e3, 3) + " · size-corrected " + K.fmt(c.Pz * 1e3, 3) : "");
      setR("Pi", K.fmt(c.Pi * 1e3, 3) + " mN/m", "ideal kinetic theory");
      setR("T", K.fmt(gas.T(), 1) + " K", walls === "bath" ? "held by the bath" : "insulated: " + (Math.abs(gas.w * BOX_H - adi.A0) > 1e-6 ? "TA predicts " + K.fmt(adi.T0 * adi.A0 / (gas.w * BOX_H), 0) + " K" : "energy conserved"));
      setR("A", K.fmt(gas.w * BOX_H, 1) + " nm²", "w = " + K.fmt(gas.w, 2) + " nm" + (piston === "free" ? " · predicted " + K.fmt(predictA(gas.T()) / BOX_H, 2) : ""));
      setR("ke", K.fmt(ke / n * 1e21, 3) + "×10⁻²¹ J", "= kT in 2D, ³⁄₂kT in 3D");
      setR("v", K.fmt(Math.sqrt(2 * ke / (n * m)), 0) + " m/s", "√(2kT/m) = " + K.fmt(vr, 0));
      setR("E", K.fmt(ke * 1e21, 2) + "×10⁻²¹ J", walls === "ins" && piston === "held" && gas.up === 0 ? "constant: bounces are elastic" : "");
      setR("hits", meas.t ? K.fmt(meas.J / (2 * m * Math.sqrt(KB * T * Math.PI / (2 * m)) * 1e-3) / meas.t, 1) + " /ps" : "—", "faster or denser = more");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Every time a molecule bounces off a wall, its perpendicular velocity flips, so it hands the wall a momentum $2mv_\\perp$. " +
      "Add those up for a while: <b class=\"c-app\">momentum per second is force, and force per length of wall is pressure</b>. Nobody tells the simulation what pressure is; it just counts the hits.</p>" +
      "<p>Averaging over all molecules gives $PV = \\tfrac13 Nm\\langle v^2\\rangle$ in 3D. In this flat box each molecule has two directions to move in, not three, so it becomes $PA = \\tfrac12 Nm\\langle v^2\\rangle$, and pressure here is a force per metre (N/m). " +
      "Calling the mean kinetic energy per direction $\\tfrac12 kT$ turns both into the ideal gas law: $PV = NkT$, or $PA = NkT$ here. Boyle, Charles and Gay-Lussac are all that one line.</p>" +
      "<p>The measured value sits about $2\\eta$ above $NkT/A$, where $\\eta$ is the fraction of the area the discs cover. That's the excluded area of real molecules, the same idea as $b$ in van der Waals' equation.</p>" +
      '<div class="trap"><b>JEE trap: equal T means equal mean KE, not equal speed.</b> At the same temperature a He atom moves $\\sqrt{40/4} \\approx 3.2$ times faster than an Ar atom, yet both gases give the same pressure for the same $N$ and $V$. Pressure and mean KE depend on $T$ only; $v_{rms} = \\sqrt{3kT/m}$ depends on the mass too.</div>');
    function apply(s) {
      walls = s.walls || "bath"; piston = s.piston || "held"; molar = s.gas || 28;
      setSeg(wallSeg, walls); setSeg(pisSeg, piston); setSeg(gasSeg, molar); showPiston();
      nS.set(s.n || 60); tS.set(s.T || 300); wS.set(s.w || 20); if (s.Pext) pS.set(s.Pext);
      runs = []; rebuild();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "Boyle's law", setup: { walls: "bath", piston: "held", n: 60, T: 300, w: 20 }, watch: "Let P settle, then drag the piston to 10 nm and let it settle again",
        q: "A gas is held at constant temperature while its volume is halved. What happens to its pressure?",
        options: ["It halves", "It stays the same", "It doubles", "It becomes four times as large"], answer: 2,
        explain: "At constant $T$ the molecules keep their speeds, but in half the space each one hits a given patch of wall twice as often. $PV = NkT$ is fixed, so $P$ doubles. In the lab, about 0.63 mN/m at 400 nm² becomes about 1.29 mN/m at 200 nm² (each a couple of percent above $NkT/A$, because real discs take up room)." },
      { level: "medium", tag: "speed and pressure", setup: { walls: "bath", piston: "held", n: 60, T: 300, w: 20 }, watch: "Note v_rms and P, then set T to 1200 K",
        q: "A gas in a rigid container is heated from 300 K to 1200 K. By what factors do the rms speed of its molecules and its pressure change?",
        options: ["$v_{rms} \\times 2$, $P \\times 2$", "$v_{rms} \\times 2$, $P \\times 4$", "$v_{rms} \\times 4$, $P \\times 4$", "$v_{rms} \\times 4$, $P \\times 16$"], answer: 1,
        hints: ["$v_{rms} = \\sqrt{3kT/m}$, so it goes as $\\sqrt T$.", "At fixed $V$, $P = NkT/V$ goes as $T$. Or: each hit is 2× harder and there are 2× as many per second."],
        explain: "$T$ goes up 4 times, so $v_{rms} \\propto \\sqrt T$ doubles, while $P \\propto T$ goes up 4 times. Seen from the molecules: each hit carries twice the momentum, and hits come twice as often. The lab shows $v_{rms}$ going from 422 to 844 m/s (for N₂ in 2D) and $P$ from about 0.63 to 2.5 mN/m." },
      { level: "hard", tag: "adiabatic, fewer degrees of freedom", setup: { walls: "ins", piston: "held", n: 60, T: 300, w: 20 }, watch: "Drag the piston slowly to 10 nm (or set w = 10). Watch T",
        q: "Molecules of a monatomic gas are confined to move in a plane, so each has only 2 degrees of freedom. The gas starts at 300 K and is compressed slowly, with no heat exchange, to half its area. What is its final temperature?",
        options: ["300 K", "396 K", "476 K", "600 K"], answer: 3,
        hints: ["With $f$ degrees of freedom, $C_v = \\tfrac f2 R$ and $\\gamma = 1 + \\tfrac 2f$.", "For a reversible adiabatic process $TV^{\\gamma - 1}$ is constant (here $V$ is the area)."],
        explain: "$f = 2$ gives $\\gamma = 2$, so $TA^{\\gamma-1} = TA$ is constant: halving $A$ doubles $T$ to 600 K. 476 K is the 3D monatomic answer ($\\gamma = 5/3$, $300 \\times 2^{2/3}$), 396 K the diatomic one ($2^{0.4}$), and 300 K would need a heat bath. The lab reads about 613 K, give or take 2%: the slight extra is again the size of the discs." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { onReset: function () { rebuild(); } });
    sim.on("step", function () { P.time.textContent = "t = " + K.fmt(gasT, 0) + " ps"; });   // gas time, not wall-clock seconds
    rebuild();

    if (location.hostname === "localhost") {
      window.__lab_gasbox = { apply: apply, gas: function () { return gas; }, result: result, runs: function () { return runs; },
        changed: changed, predictA: predictA, adi: function () { return adi; }, wS: wS, tS: tS, pS: pS, setTurbo: function (v) { turbo = v; },
        setGas: function (v) { molar = v; setSeg(gasSeg, v); gas.setMass(v * AMU); changed(); }, zHard: zHard, etaOf: etaOf, heat: function (v) { tS.set(v); heat(v); },
        setPiston: function (v) { pisSeg.querySelector('[data-value="' + v + '"]').click(); } };
    }
    return function destroy() { sim.destroy(); [gt, gp, gk].forEach(function (g) { g.destroy(); }); };
  }
})();
