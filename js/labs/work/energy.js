/* Work, energy & power, lab 2: energy conservation on a track with a ramp, a vertical loop and a hill.
   The body moves along the track by its arc length (RK4 sub-steps). If the track would have to pull
   (N < 0) it leaves and flies as a projectile until it lands again. Heat is counted separately, from
   friction's work and landing bumps, so the total is a real check, not a definition. */
(function () {
  "use strict";
  var G = 9.8, HR = 9, LR = 7, FL = 2.5, HW = 5, LS = 3, DS = 0.01, NSUB = 40, BALL_R = 0.3, BETA_BALL = 0.4;

  var lab = {
    id: "energy", chapter: "work", title: "Energy conservation", short: "KE ⇄ PE, loops, h = 2.5R",
    lede: "Let a block go down a ramp, round a vertical loop and over a hill. Kinetic, potential, spring and heat energy trade places, and their sum never changes.",
    tries: [
      { id: "loop", title: "Loop the loop from the lowest start",
        text: "On a smooth track, get the block all the way round the loop from no more than $2.6R$.",
        why: "At the top it needs $v^2 \\ge gR$ so gravity alone can bend its path ($N \\ge 0$). Energy then says $mgh \\ge mg(2R) + \\tfrac12 mgR$, so $h \\ge 2.5R$." },
      { id: "falloff", title: "Make it fall off the loop",
        text: "Release the block from between $R$ and $2.5R$ and watch where it leaves the track.",
        why: "It leaves where $N$ reaches zero, at height $(2h + R)/3$, above the loop's middle but below the top. From there it's a projectile, cutting across the inside of the loop." },
      { id: "heat", title: "Turn it all into heat",
        text: "Switch friction on and let it run until the block stops for good.",
        why: "Friction's work $-\\mu N s$ moves mechanical energy into the thermal bar. The bars still add up to the same total: energy isn't lost, it just stops being useful." },
      { id: "rolling", title: "Roll a ball from 2.5R",
        text: "Switch to the rolling ball, release it from between $2.5R$ and $2.7R$, and see if it makes the loop.",
        why: "A rolling ball keeps $\\tfrac15 mv^2$ of its energy as spin, so less goes into speed. It needs $h \\ge 2.7R$: $mgh = 2mgR + \\tfrac12 m v^2(1 + \\tfrac25)$ with $v^2 = gR$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 340, ppm = 29, origin = { x: 20, y: 300 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 1, gridMajor: 5 });

    /* ---------- controls ---------- */
    var launch = "release", body = "block";
    var hS = K.slider({ label: "Release height $h$", unit: "m", min: 0.5, max: 9, step: 0.1, value: 6, onInput: reset, hint: "Or drag the block up and down the ramp." });
    var kS = K.slider({ label: "Spring constant $k$", unit: "N/m", min: 50, max: 800, step: 10, value: 400, onInput: reset });
    var cS = K.slider({ label: "Compression $c$", unit: "m", min: 0, max: 1, step: 0.01, value: 0.4, onInput: reset });
    var RS = K.slider({ label: "Loop radius $R$", unit: "m", min: 1, max: 3, step: 0.1, value: 2, onInput: reset, hint: "Or drag the top of the loop." });
    var h2S = K.slider({ label: "Hill height", unit: "m", min: 0, max: 4, step: 0.5, value: 2, onInput: reset });
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 0.5, max: 5, step: 0.5, value: 1, onInput: reset });
    var muS = K.slider({ label: "Track friction $\\mu_k$", min: 0, max: 0.3, step: 0.01, value: 0, onInput: reset });
    P.controls.innerHTML = "<h3>Start</h3>";
    var launchSeg = K.seg([{ label: "Release from a height", value: "release" }, { label: "Spring launcher", value: "spring" }], "release",
      function (v) { launch = v; showGroups(); reset(); }, "Launch");
    P.controls.appendChild(launchSeg);
    var gRel = K.h("<div></div>"), gSpr = K.h("<div></div>"), gFric = K.h("<div></div>");
    gRel.appendChild(hS.el); [kS, cS].forEach(function (s) { gSpr.appendChild(s.el); });
    P.controls.appendChild(gRel); P.controls.appendChild(gSpr);
    P.controls.appendChild(K.h("<h3>The track</h3>"));
    [RS, h2S].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>The body</h3>"));
    var bodySeg = K.seg([{ label: "Block (slides)", value: "block" }, { label: "Ball (rolls)", value: "ball" }], "block",
      function (v) { body = v; showGroups(); reset(); }, "Body");
    P.controls.appendChild(bodySeg);
    P.controls.appendChild(mS.el);
    gFric.appendChild(muS.el);
    P.controls.appendChild(gFric);
    var ballNote = K.h('<p class="control-hint">' + K.md("A rolling ball needs static friction, which does no work, so there's no heat from it here.") + "</p>");
    P.controls.appendChild(ballNote);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-vel"><i></i>kinetic</span><span class="c-grav"><i></i>potential mgh</span><span class="c-app"><i></i>spring</span>' +
      '<span class="c-fric"><i></i>thermal</span><span class="c-normal"><i></i>normal force</span></div>'));
    function showGroups() { gRel.hidden = launch !== "release"; gSpr.hidden = launch !== "spring"; gFric.hidden = body !== "block"; ballNote.hidden = body !== "ball"; }
    showGroups();

    function params() {
      return { h: hS.get(), k: kS.get(), c: cS.get(), R: RS.get(), h2: h2S.get(), m: mS.get(), mu: body === "block" ? muS.get() : 0,
        beta: body === "ball" ? BETA_BALL : 0, launch: launch, body: body };
    }
    var p = params();

    /* ---------- the track: dense samples with exact tangent, normal and curvature ---------- */
    // The body rides on the left of the direction of travel: n = (-ty, tx). kappa > 0 bends towards n.
    var tr = null;
    function build() {
      var X = [], Y = [], NY = [], KA = [];
      function addFn(x0, x1, f) {
        var x = x0;
        while (x < x1 - 1e-9) {
          var d = f(x); X.push(x); Y.push(d[0]);
          var sl = d[1], q = Math.sqrt(1 + sl * sl);
          NY.push(1 / q); KA.push(d[2] / (q * q * q));
          x = Math.min(x1, x + DS / q);
        }
      }
      var x = 0;
      if (p.launch === "release") addFn(0, LR, function (x) { var a = Math.PI * x / LR; return [HR * (1 + Math.cos(a)) / 2, -HR * Math.PI / (2 * LR) * Math.sin(a), -HR * Math.PI * Math.PI / (2 * LR * LR) * Math.cos(a)]; });
      else addFn(0, LR, function () { return [0, 0, 0]; });
      x = LR;
      addFn(x, x + FL, function () { return [0, 0, 0]; }); x += FL;
      // the loop: counter-clockwise from the bottom, centre (x, R)
      var R = p.R, n = Math.ceil(2 * Math.PI * R / DS), loop0 = X.length;
      for (var i = 0; i < n; i++) {
        var ph = -Math.PI / 2 + 2 * Math.PI * i / n;
        X.push(x + R * Math.cos(ph)); Y.push(R + R * Math.sin(ph)); NY.push(-Math.sin(ph)); KA.push(1 / R);
      }
      var loopIdx = [loop0, X.length];
      addFn(x, x + FL, function () { return [0, 0, 0]; }); x += FL;
      var h2 = p.h2, hx0 = x;
      addFn(x, x + 2 * HW, function (xx) { var a = Math.PI * (xx - hx0) / HW; return [h2 * (1 - Math.cos(a)) / 2, h2 * Math.PI / (2 * HW) * Math.sin(a), h2 * Math.PI * Math.PI / (2 * HW * HW) * Math.cos(a)]; });
      x += 2 * HW;
      addFn(x, x + FL, function () { return [0, 0, 0]; }); x += FL;
      var rx0 = x;
      addFn(x, x + LR + 1e-6, function (xx) { var a = Math.PI * (xx - rx0) / LR; return [HR * (1 - Math.cos(a)) / 2, HR * Math.PI / (2 * LR) * Math.sin(a), HR * Math.PI * Math.PI / (2 * LR * LR) * Math.cos(a)]; });
      X.push(x + LR); Y.push(HR); NY.push(1); KA.push(0);
      var N = X.length, S = new Float64Array(N), TX = new Float64Array(N), TY = new Float64Array(N), L = new Float64Array(N);
      for (var j = 0; j < N - 1; j++) {
        var dx = X[j + 1] - X[j], dy = Y[j + 1] - Y[j], len = Math.hypot(dx, dy);
        L[j] = len; TX[j] = dx / len; TY[j] = dy / len; S[j + 1] = S[j] + len;
      }
      // segments bucketed by x (1 m cells), for finding where a flying body lands
      var buckets = {};
      for (var k = 0; k < N - 1; k++) {
        var lo = Math.floor(Math.min(X[k], X[k + 1])), hi = Math.floor(Math.max(X[k], X[k + 1]));
        for (var c = lo; c <= hi; c++) (buckets[c] = buckets[c] || []).push(k);
      }
      tr = { X: X, Y: Y, NY: NY, KA: KA, S: S, TX: TX, TY: TY, L: L, N: N, len: S[N - 1], buckets: buckets,
        loopX: LR + FL, loopS0: S[loopIdx[0]], loopS1: S[loopIdx[1]], hillX: hx0 + HW };
      tr.loopTop = tr.loopS0 + Math.PI * R;
    }
    function seg(s) {
      var lo = 0, hi = tr.N - 2;
      if (s <= 0) return 0;
      if (s >= tr.S[hi]) return hi;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (tr.S[mid] <= s) lo = mid; else hi = mid - 1; }
      return lo;
    }
    function at(s) {
      var i = seg(s), f = (s - tr.S[i]) / tr.L[i];
      return { i: i, x: tr.X[i] + tr.TX[i] * (s - tr.S[i]), y: tr.Y[i] + tr.TY[i] * (s - tr.S[i]),
        tx: tr.TX[i], ty: tr.TY[i], ny: tr.NY[i] + (tr.NY[i + 1] - tr.NY[i]) * f, ka: tr.KA[i] + (tr.KA[i + 1] - tr.KA[i]) * f };
    }

    /* ---------- state + energy ---------- */
    var st, rec;
    function springF(s) { return p.launch === "spring" && s < LS ? p.k * (LS - s) : 0; }
    function springE(s) { return p.launch === "spring" && s < LS ? 0.5 * p.k * (LS - s) * (LS - s) : 0; }
    function normalOf(s, v) { var q = at(s); return p.m * (q.ka * v * v + G * q.ny); }
    function energies() {
      if (st.fly) {
        var f = st.fly;
        return { KE: 0.5 * p.m * (f.vx * f.vx + f.vy * f.vy) + 0.5 * p.m * p.beta * f.vr * f.vr, PE: p.m * G * f.y, SP: 0, Q: st.Q };
      }
      return { KE: 0.5 * p.m * (1 + p.beta) * st.v * st.v, PE: p.m * G * at(st.s).y, SP: springE(st.s), Q: st.Q };
    }
    function startS() {
      if (p.launch === "spring") return LS - p.c;
      var x = LR / Math.PI * Math.acos(K.clamp(2 * p.h / HR - 1, -1, 1));
      for (var i = 0; i < tr.N - 1; i++) if (tr.X[i + 1] >= x) break;
      // exact arc position where y = h on that segment
      var y0 = tr.Y[i], y1 = tr.Y[i + 1], f = Math.abs(y1 - y0) > 1e-12 ? (p.h - y0) / (y1 - y0) : 0;
      return tr.S[i] + K.clamp(f, 0, 1) * tr.L[i];
    }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      p = params(); build();
      st = { s: startS(), v: 0, Q: 0, fly: null, stuck: true, stillFor: 0, done: false, top: null, left: null, flyT: 0,
        passedTop: false, looped: false, fellInLoop: false, vmax: 0, landings: 0 };
      var e = energies();
      st.E0 = e.KE + e.PE + e.SP;
      rec = { t: [0], KE: [e.KE], PE: [e.PE], SP: [e.SP], Q: [0], E: [st.E0], y: [e.PE / (p.m * G)], v2: [0], N: [normalOf(st.s, 0)], Nf: [normalOf(st.s, 0)] };
      P.time.textContent = "t = 0.00 s";
      update(true);
    }

    // tangential acceleration along the track, for speed v
    function accel(s, v) {
      var q = at(s), F = -p.m * G * q.ty + springF(s);
      if (p.mu > 0 && v !== 0) {
        var N = Math.max(0, p.m * (q.ka * v * v + G * q.ny));
        F -= Math.sign(v) * p.mu * N;
      }
      return F / (p.m * (1 + p.beta));
    }

    function stepTrack(h) {
      var s = st.s, v = st.v;
      if (st.stuck) {
        var q0 = at(s), Ft = -p.m * G * q0.ty + springF(s), N0 = p.m * G * q0.ny;
        if (Math.abs(Ft) <= p.mu * N0 + 1e-9) return;
        st.stuck = false;
      }
      if (p.mu > 0 && Math.abs(v) < 2 * p.mu * G * h) {
        // so slow that friction stops it within this sub-step: stick, if static friction can hold it
        var q2 = at(s), Ft2 = -p.m * G * q2.ty + springF(s);
        if (Math.abs(Ft2) <= p.mu * Math.max(0, normalOf(s, 0))) { st.Q += 0.5 * p.m * (1 + p.beta) * v * v; st.v = 0; st.stuck = true; return; }
      }
      var k1v = accel(s, v), k1s = v;
      var k2v = accel(s + 0.5 * h * k1s, v + 0.5 * h * k1v), k2s = v + 0.5 * h * k1v;
      var k3v = accel(s + 0.5 * h * k2s, v + 0.5 * h * k2v), k3s = v + 0.5 * h * k2v;
      var k4v = accel(s + h * k3s, v + h * k3v), k4s = v + h * k3v;
      var sn = s + h / 6 * (k1s + 2 * k2s + 2 * k3s + k4s), vn = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (p.mu > 0) {
        // heat from friction: mu N |ds| (trapezoid in N)
        var Na = Math.max(0, normalOf(s, v)), Nb = Math.max(0, normalOf(sn, vn));
        st.Q += p.mu * 0.5 * (Na + Nb) * Math.abs(sn - s);
        if (v !== 0 && Math.sign(vn) !== Math.sign(v)) {
          // it stopped inside this sub-step; does static friction hold it?
          var q1 = at(sn), Ft1 = -p.m * G * q1.ty + springF(sn);
          if (Math.abs(Ft1) <= p.mu * p.m * G * q1.ny) { vn = 0; st.stuck = true; }
        }
      }
      // the ends of the track are stops: bounce straight back
      if (sn < 0) { sn = -sn; vn = -vn; }
      if (sn > tr.len) { sn = 2 * tr.len - sn; vn = -vn; }
      // passing the top of the loop
      if ((s - tr.loopTop) * (sn - tr.loopTop) <= 0 && s !== sn) {
        var fr = (tr.loopTop - s) / (sn - s), vt = v + (vn - v) * fr;
        st.top = { v: Math.abs(vt), N: normalOf(tr.loopTop, vt) };
        st.passedTop = true;
      }
      if (st.passedTop && !st.fellInLoop && v > 0 && s < tr.loopS1 && sn >= tr.loopS1) st.looped = true;
      st.s = sn; st.v = vn;
      if (normalOf(sn, vn) < -0.002 * p.m * G) takeOff();   // a hair of slack so round-off at exactly N = 0 doesn't count as leaving
    }

    function takeOff() {
      var q = at(st.s);
      st.fly = { x: q.x, y: q.y, vx: st.v * q.tx, vy: st.v * q.ty, vr: st.v, t: 0 };
      st.left = { y: q.y, inLoop: st.s > tr.loopS0 && st.s < tr.loopS1 };
    }

    function stepFly(h) {
      var f = st.fly, x0 = f.x, y0 = f.y;
      var x1 = x0 + f.vx * h, y1 = y0 + f.vy * h - 0.5 * G * h * h, vy1 = f.vy - G * h;
      f.t += h;
      // did it cross the track (from the riding side) during this sub-step?
      var best = null, lo = Math.floor(Math.min(x0, x1)), hi = Math.floor(Math.max(x0, x1));
      for (var c = lo; c <= hi; c++) (tr.buckets[c] || []).forEach(function (k) {
        var ax = tr.X[k], ay = tr.Y[k], nx = -tr.TY[k], ny = tr.TX[k];
        var d0 = (x0 - ax) * nx + (y0 - ay) * ny, d1 = (x1 - ax) * nx + (y1 - ay) * ny;
        if (d0 >= -1e-9 && d1 < 0) {
          var fr = d0 / (d0 - d1), qx = x0 + (x1 - x0) * fr, qy = y0 + (y1 - y0) * fr;
          var lam = (qx - ax) * tr.TX[k] + (qy - ay) * tr.TY[k];
          if (lam >= -1e-9 && lam <= tr.L[k] + 1e-9 && (!best || fr < best.fr)) best = { k: k, fr: fr, lam: lam };
        }
      });
      if (best) {
        var vxL = f.vx, vyL = f.vy - G * h * best.fr, k = best.k;
        var vt = vxL * tr.TX[k] + vyL * tr.TY[k];
        var ke = 0.5 * p.m * (vxL * vxL + vyL * vyL) + 0.5 * p.m * p.beta * f.vr * f.vr;
        var yL = y0 + (y1 - y0) * best.fr;
        // the bump kills the speed into the track; a ball also has to match its spin to its new speed
        var vNew = (vt + p.beta * f.vr) / (1 + p.beta);
        // keep the energy exact: correct for the landing point sitting on the chord
        var sNew = tr.S[k] + K.clamp(best.lam, 0, tr.L[k]), yTrack = at(sNew).y;
        st.Q += ke + p.m * G * yL - (0.5 * p.m * (1 + p.beta) * vNew * vNew + p.m * G * yTrack);
        st.fly = null; st.s = sNew; st.v = vNew; st.landings++;
        if (st.left && st.left.inLoop && f.t > 0.05) st.fellInLoop = true;
        if (f.t > 0.05) K.flash(P.note, st.left && st.left.inLoop ? "It fell off the loop: the bump turned " + K.fmt(Math.max(0, ke - 0.5 * p.m * (1 + p.beta) * vNew * vNew), 1) + " J into heat" : "Landed: the bump turned some kinetic energy into heat");
        return;
      }
      f.x = x1; f.y = y1; f.vy = vy1;
      if (f.y < -2 || f.x < -2 || f.x > tr.X[tr.N - 1] + 3) finish("off");
    }

    sim.on("step", function (t) {
      if (st.done) return;
      for (var i = 0; i < NSUB && !st.done; i++) { if (st.fly) stepFly(K.DT / NSUB); else stepTrack(K.DT / NSUB); }
      var e = energies(), v = st.fly ? Math.hypot(st.fly.vx, st.fly.vy) : Math.abs(st.v);
      st.vmax = Math.max(st.vmax, v);
      var y = e.PE / (p.m * G), N = st.fly ? 0 : normalOf(st.s, st.v);
      // N from energy conservation alone (smooth track), at the same place
      var v2f = Math.max(0, 2 * (st.E0 - e.PE - e.SP) / (p.m * (1 + p.beta)));
      var Nf = st.fly ? 0 : (function () { var q = at(st.s); return p.m * (q.ka * v2f + G * q.ny); })();
      rec.t.push(t); rec.KE.push(e.KE); rec.PE.push(e.PE); rec.SP.push(e.SP); rec.Q.push(e.Q); rec.E.push(e.KE + e.PE + e.SP + e.Q);
      rec.y.push(y); rec.v2.push(v * v); rec.N.push(N); rec.Nf.push(Nf);
      if (rec.t.length > 3600) Object.keys(rec).forEach(function (k) { rec[k].shift(); });
      // experiments
      if (st.looped && !st.loopMarked) {
        st.loopMarked = true;
        K.flash(P.note, "Round the loop! v at the top = " + K.fmt(st.top.v, 2) + " m/s, N = " + K.fmt(st.top.N, 1) + " N");
        if (p.launch === "release" && p.body === "block" && p.mu === 0 && p.h <= 2.6 * p.R + 1e-9) tries.mark("loop");
      }
      if (st.fellInLoop && !st.fellMarked) {
        st.fellMarked = true;
        if (p.launch === "release" && p.body === "block") tries.mark("falloff");
        if (p.launch === "release" && p.body === "ball" && p.h >= 2.5 * p.R - 1e-9) tries.mark("rolling");
      }
      st.stillFor = !st.fly && Math.abs(st.v) < 1e-9 && st.stuck ? st.stillFor + K.DT : 0;
      if (st.stillFor >= 1 && sim.steps > 30) {
        if (p.mu > 0 && st.Q > 0.5 * st.E0) tries.mark("heat");
        finish("stopped");
      } else if (t >= 60) finish("time");
      update(false);
    });

    function finish(why) {
      if (st.done) return;
      st.done = true; sim.pause(); transportUI.render();
      K.flash(P.note, why === "stopped" ? "It stopped: " + K.fmt(st.Q, 1) + " J is now heat" : why === "off" ? "It flew off the track" : "60 s: reset to start again");
      update(true);
    }

    /* ---------- drawing ---------- */
    function bodyPos() {
      if (st.fly) return { x: st.fly.x, y: st.fly.y, nx: 0, ny: 1, ang: Math.atan2(st.fly.vy, st.fly.vx) };
      var q = at(st.s);
      return { x: q.x, y: q.y, nx: -q.ty, ny: q.tx, ang: Math.atan2(q.ty, q.tx) };
    }
    sim.on("under", function (ctx) {
      sim.drawGround(ctx);
      // the track, drawn on the far side of the riding surface
      ctx.strokeStyle = th.bank; ctx.lineWidth = sim.u(7); ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      for (var i = 0; i < tr.N; i += 2) {
        var j = Math.min(i, tr.N - 2), q = sim.px(tr.X[i] + tr.TY[j] * 0.12, tr.Y[i] - tr.TX[j] * 0.12);
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath();
      for (var k = 0; k < tr.N; k += 2) { var r = sim.px(tr.X[k], tr.Y[k]); if (k) ctx.lineTo(r.x, r.y); else ctx.moveTo(r.x, r.y); }
      ctx.stroke();
      // heights to remember
      var top = sim.px(tr.loopX, 2 * p.R), ctr = sim.px(tr.loopX, p.R);
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(ctr.x, ctr.y, sim.u(2.5), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(top.x, top.y, sim.u(5), 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "R = " + K.fmt(p.R, 1) + " m", top.x, top.y - sim.u(8), th.muted, { s: sim.u(0.9) });
      if (p.launch === "release") {
        var hm = (2.5 + p.beta * 0.5) * p.R;
        if (hm <= HR) {
          var a = sim.px(0, hm), b = sim.px(tr.loopX + p.R + 0.6, hm);
          ctx.strokeStyle = K.alpha(th.app, 0.7); ctx.setLineDash([sim.u(5), sim.u(5)]); ctx.lineWidth = sim.u(1.5);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, (p.beta ? "2.7R" : "2.5R") + " = " + K.fmt(hm, 2) + " m", b.x + sim.u(4), b.y + sim.u(6), th.app, { s: sim.u(0.85), align: "left" });
        }
        var hh = sim.px(0, p.h), he = sim.px(tr.X[tr.N - 1], p.h);
        ctx.strokeStyle = K.alpha(th.grav, 0.45); ctx.setLineDash([sim.u(2), sim.u(5)]); ctx.lineWidth = sim.u(1.2);
        ctx.beginPath(); ctx.moveTo(hh.x, hh.y); ctx.lineTo(he.x, he.y); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "start height " + K.fmt(p.h, 1) + " m", he.x - sim.u(4), he.y - sim.u(2), th.grav, { s: sim.u(0.85), align: "right" });
      } else {
        // wall and spring
        var w = sim.px(0, 0), y = sim.px(0, BALL_R + 0.05).y, xb = st.fly ? LS : Math.min(LS, st.s);
        ctx.fillStyle = th.bank; ctx.fillRect(w.x - sim.u(6), w.y - 1.4 * ppm, sim.u(10), 1.4 * ppm);
        var x2 = sim.px(xb - BALL_R, 0).x, nC = 12, amp = sim.u(7);
        ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.moveTo(w.x, y);
        for (var c = 1; c < nC; c++) ctx.lineTo(w.x + (x2 - w.x) * c / nC, y + (c % 2 ? -amp : amp));
        ctx.lineTo(x2, y); ctx.stroke();
      }
    });
    sim.on("over", function (ctx) {
      var b = bodyPos(), c = sim.px(b.x + b.nx * BALL_R, b.y + b.ny * BALL_R), r = BALL_R * ppm;
      ctx.save(); ctx.translate(c.x, c.y);
      if (p.body === "ball") {
        ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(-(st.fly ? 0 : st.s / BALL_R)); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.stroke();
      } else {
        ctx.rotate(-b.ang);
        ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.strokeRect(-r, -r, 2 * r, 2 * r);
      }
      ctx.restore();
      if (!st.fly) {
        var v = st.v, q = at(st.s), N = normalOf(st.s, st.v);
        if (Math.abs(v) > 0.05) K.arrow(ctx, c.x, c.y, c.x + v * q.tx * sim.u(4), c.y - v * q.ty * sim.u(4), th.vel, { s: sim.u(1), label: "v " + K.fmt(Math.abs(v), 1) });
        if (N > 0.05 * p.m * G) sim.force(ctx, c.x, c.y, -q.ty * N, q.tx * N, th.normal, "N", Math.min(2.5, 60 / Math.max(N, 1)) , { lx: 4 });
      } else {
        var f = st.fly;
        K.arrow(ctx, c.x, c.y, c.x + f.vx * sim.u(4), c.y - f.vy * sim.u(4), th.vel, { s: sim.u(1), label: "v" });
      }
      if (!sim.running && sim.steps === 0) {
        K.label(ctx, p.launch === "release" ? "drag me up or down the ramp" : "press Release", c.x + sim.u(14), c.y - sim.u(10), th.muted, { s: sim.u(0.9), align: "left" });
      }
      drawBars(ctx);
    });
    // energy bars in a corner of the stage (screen-sized)
    function drawBars(ctx) {
      var e = energies(), E = Math.max(st.E0, 1e-9), v = sim.view();
      var x0 = v.x0 + (v.x1 - v.x0) * 0.47, y0 = v.y0 + sim.u(14), bw = sim.u(30), gap = sim.u(12), hMax = sim.u(80);
      var items = [["KE", e.KE, th.vel], ["PE", e.PE, th.grav], ["spring", e.SP, th.app], ["heat", e.Q, th.fric], ["total", e.KE + e.PE + e.SP + e.Q, th.ink]];
      ctx.fillStyle = K.alpha(th.surface, 0.85); ctx.fillRect(x0 - sim.u(10), y0 - sim.u(6), items.length * (bw + gap) + sim.u(8), hMax + sim.u(44));
      items.forEach(function (it, i) {
        var x = x0 + i * (bw + gap), hh = K.clamp(it[1] / E, 0, 1.2) * hMax;
        ctx.strokeStyle = th.line; ctx.lineWidth = sim.u(1); ctx.strokeRect(x, y0, bw, hMax);
        ctx.fillStyle = it[2]; ctx.fillRect(x, y0 + hMax - hh, bw, hh);
        K.label(ctx, it[0], x + bw / 2, y0 + hMax + sim.u(16), it[2], { s: sim.u(0.8) });
        K.label(ctx, K.fmt(it[1], 1), x + bw / 2, y0 + hMax + sim.u(30), th.muted, { s: sim.u(0.75) });
      });
    }

    // drag the block on the ramp (height), the top of the loop (R) or the top of the hill
    var drag = null;
    sim.pointer({
      down: function (pt) {
        if (sim.running) return false;
        var b = bodyPos(), m = pt.m;
        if (Math.hypot(m.x - b.x, m.y - b.y) < 0.9) { drag = "body"; return true; }
        if (Math.hypot(m.x - tr.loopX, m.y - 2 * p.R) < 0.7) { drag = "loop"; return true; }
        if (Math.hypot(m.x - tr.hillX, m.y - p.h2) < 0.9) { drag = "hill"; return true; }
        return false;
      },
      drag: function (pt) {
        if (drag === "body" && p.launch === "release") hS.set(K.clamp(Math.round(pt.m.y * 10) / 10, 0.5, 9));
        else if (drag === "body") cS.set(K.clamp(Math.round((LS - pt.m.x) * 100) / 100, 0, 1));
        else if (drag === "loop") RS.set(K.clamp(Math.round(pt.m.y / 2 * 10) / 10, 1, 3));
        else if (drag === "hill") h2S.set(K.clamp(Math.round(pt.m.y * 2) / 2, 0, 4));
        else return;
        reset();
      },
      up: function () { drag = null; }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">energy vs t</b> · the parts trade; the total (black) stays on the dashed line</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v² vs height</b> · a straight line of slope $-2g/(1+\\beta)$ on a smooth track</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-normal">normal force vs t</b> · the dip is the top of the loop; below zero it falls off</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gE = new K.Graph(cv[0], { yLabel: "E (J)", xMax: 3, xAuto: true, yMin: 0, color: th.vel });
    var gV = new K.Graph(cv[1], { yLabel: "v² (m²/s²)", xLabel: "height y (m)", xMax: 10, yMin: 0, color: th.vel });
    var gN = new K.Graph(cv[2], { yLabel: "N (N)", xMax: 3, xAuto: true, color: th.normal });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var pts = function (arr) { return rec.t.map(function (t, i) { return [t, arr[i]]; }); };
      gE.set("E0", { points: [[0, st.E0], [rec.t[rec.t.length - 1], st.E0]], color: th.ink, dash: [5, 5], width: 1.5 });
      gE.set("KE", { points: pts(rec.KE), color: th.vel, width: 2 });
      gE.set("PE", { points: pts(rec.PE), color: th.grav, width: 2 });
      if (p.launch === "spring") gE.set("SP", { points: pts(rec.SP), color: th.app, width: 2 }); else delete gE.series.SP;
      gE.set("Q", { points: pts(rec.Q), color: th.fric, width: 2 });
      gE.set("E", { points: pts(rec.E), color: th.ink, width: 2.5, dot: true });
      // v^2 = 2(E0 - mgy)/(m(1+beta)), away from the spring
      var line = [], ymax = Math.min(10, st.E0 / (p.m * G));
      line.push([0, 2 * st.E0 / (p.m * (1 + p.beta))]); line.push([ymax, 2 * (st.E0 - p.m * G * ymax) / (p.m * (1 + p.beta))]);
      gV.set("theory", { points: line, color: th.vel, dash: [5, 5], width: 1.5 });
      gV.set("sim", { points: rec.y.map(function (y, i) { return [y, rec.v2[i]]; }), color: th.vel, width: 2.5, dot: true });
      gN.set("zero", { points: [[0, 0], [Math.max(3, rec.t[rec.t.length - 1]), 0]], color: K.alpha(th.muted, 0.6), width: 1 });
      gN.set("theory", { points: pts(rec.Nf), color: th.normal, dash: [5, 5], width: 1.5 });
      gN.set("sim", { points: pts(rec.N), color: th.normal, width: 2.5, dot: true });
      [gE, gV, gN].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Energy is conserved (heat included)", "Speed at the top of the loop", "Normal force at the top", "Least start to loop the loop (smooth track)"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "v", label: "speed now", cls: "c-vel" }, { id: "y", label: "height now", cls: "c-grav" },
      { id: "E", label: "total energy", cls: "" }, { id: "N", label: "normal force now", cls: "c-normal" },
      { id: "vt", label: "speed at loop top", cls: "c-vel" }, { id: "Nt", label: "N at loop top", cls: "c-normal" },
      { id: "hmin", label: "least start", cls: "c-app" }, { id: "left", label: "left the track at", cls: "c-grav" }
    ]);
    function f2(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function topFormula() {
      var v2 = 2 * (st.E0 - p.m * G * 2 * p.R) / (p.m * (1 + p.beta));
      return { v2: v2, v: v2 >= 0 ? Math.sqrt(v2) : NaN, N: p.m * v2 / p.R - p.m * G };
    }
    function renderMaths() {
      var e = energies(), tf = topFormula(), b = p.beta, kf = b ? "\\tfrac12 m v^2(1 + \\tfrac25)" : "\\tfrac12 m v^2";
      K.tex(eqEls[0], "K + U + U_s + Q = " + K.fmt(e.KE, 1) + " + " + K.fmt(e.PE, 1) + " + " + K.fmt(e.SP, 1) + " + " + K.fmt(e.Q, 1) + " = \\mathbf{" + K.fmt(e.KE + e.PE + e.SP + e.Q, 1) + "}\\ \\text{J}\\ (E_0 = " + K.fmt(st.E0, 1) + ")");
      var src = p.launch === "release" ? "mgh" : "\\tfrac12 k c^2";
      K.tex(eqEls[1], src + " = mg(2R) + " + kf + " \\Rightarrow v_{top} = " + (tf.v2 >= 0 ? "\\mathbf{" + K.fmt(tf.v, 2) + "}\\ \\text{m/s}" : "\\text{(can't get that high)}"));
      K.tex(eqEls[2], "N + mg = \\frac{m v^2}{R} \\Rightarrow N = \\frac{(" + K.fmt(p.m, 1) + ")(" + K.fmt(Math.max(tf.v2, 0), 2) + ")}{" + K.fmt(p.R, 1) + "} - " + K.fmt(p.m * G, 1) + " = \\mathbf{" + K.fmt(tf.v2 >= 0 ? tf.N : NaN, 1) + "}\\ \\text{N}");
      if (p.launch === "release") {
        K.tex(eqEls[3], "N_{top} \\ge 0 \\Rightarrow v_{top}^2 \\ge gR \\Rightarrow h \\ge " + (b ? "2.7" : "2.5") + "R = \\mathbf{" + K.fmt((2.5 + b / 2) * p.R, 2) + "}\\ \\text{m}" + (p.h < (2.5 + b / 2) * p.R - 1e-9 ? "\\ (" + K.fmt(p.h, 1) + " \\text{ is too low})" : ""));
      } else {
        K.tex(eqEls[3], "\\tfrac12 k c^2 \\ge (" + (b ? "2.7" : "2.5") + ") mgR \\Rightarrow c \\ge \\sqrt{\\frac{" + (b ? "5.4" : "5") + "\\,mgR}{k}} = \\mathbf{" + K.fmt(Math.sqrt((5 + b) * p.m * G * p.R / p.k), 3) + "}\\ \\text{m}");
      }
      var v = st.fly ? Math.hypot(st.fly.vx, st.fly.vy) : Math.abs(st.v);
      setR("v", K.fmt(v, 2) + " m/s", "max " + K.fmt(st.vmax, 2));
      setR("y", K.fmt(e.PE / (p.m * G), 2) + " m", st.fly ? "flying" : "on the track");
      setR("E", K.fmt(e.KE + e.PE + e.SP + e.Q, 2) + " J", "start " + K.fmt(st.E0, 2) + " J");
      setR("N", st.fly ? "0 N" : K.fmt(normalOf(st.s, st.v), 1) + " N", st.fly ? "in the air" : "");
      setR("vt", st.top ? K.fmt(st.top.v, 2) + " m/s" : "—", "formula " + (tf.v2 >= 0 ? K.fmt(tf.v, 2) : "—") + (p.mu > 0 ? " (smooth)" : ""));
      setR("Nt", st.top ? K.fmt(st.top.N, 2) + " N" : "—", "formula " + (tf.v2 >= 0 ? K.fmt(tf.N, 2) : "—"));
      setR("hmin", p.launch === "release" ? K.fmt((2.5 + p.beta / 2) * p.R, 2) + " m" : K.fmt(Math.sqrt((5 + p.beta) * p.m * G * p.R / p.k), 3) + " m",
        p.launch === "release" ? (p.beta ? "2.7R for a rolling ball" : "2.5R") : "least compression");
      var yl = (2 * p.h + p.R) / 3;
      if (p.beta) yl = p.R + 2 * (p.h - p.R) / (3 + p.beta);
      setR("left", st.left ? K.fmt(st.left.y, 2) + " m" : "—", p.launch === "release" && p.mu === 0 && p.h > p.R && p.h < (2.5 + p.beta / 2) * p.R ? "formula " + K.fmt(yl, 2) + " m" : "");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>When only gravity and springs do work, <b>mechanical energy is conserved</b>: $K + U_g + U_s$ stays the same, so speed at any point follows from height alone: $v^2 = 2g(h - y)$. The shape of the track in between doesn't matter.</p>" +
      "<p><b class=\"c-fric\">Friction</b> breaks that, but nothing is lost: its work $\\mu N s$ shows up as heat, and the grand total stays fixed. A bump when the body lands after flying is heat too.</p>" +
      "<p>In a vertical loop, energy gives the speed and Newton's second law gives the <b class=\"c-normal\">normal force</b>: at the top $N + mg = mv^2/R$. The track can only push, so $N \\ge 0$ needs $v_{top}^2 \\ge gR$, and that needs $h \\ge 2.5R$.</p>" +
      '<div class="trap"><b>JEE trap: $h = 2R$ is not enough.</b> Energy would let it reach the top with zero speed, but it needs speed $\\sqrt{gR}$ there to stay on the track, so it falls off first. And for a ball that <i>rolls</i>, part of the energy goes into spin: then $h_{min} = 2.7R$, not $2.5R$.</div>');
    function apply(s) {
      launch = s.launch; body = s.body;
      launchSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === launch)); });
      bodySeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === body)); });
      showGroups();
      if (s.h != null) hS.set(s.h);
      if (s.k != null) kS.set(s.k);
      if (s.c != null) cS.set(s.c);
      RS.set(s.R); h2S.set(s.h2 != null ? s.h2 : 2); mS.set(s.m); muS.set(s.mu || 0);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "speed from height", setup: { launch: "release", body: "block", h: 5, R: 1.5, h2: 2, m: 1, mu: 0 }, watch: "Predict the speed on the flat, then press Release",
        q: "A small block slides from rest down a smooth curved ramp, starting 5 m above the floor ($g = 9.8$). How fast is it moving on the floor at the bottom?",
        options: ["9.90 m/s", "7.00 m/s", "98.0 m/s", "4.95 m/s"], answer: 0,
        explain: "$mgh = \\tfrac12 mv^2$, so $v = \\sqrt{2gh} = \\sqrt{98} = 9.90$ m/s. The mass cancels, and so does the ramp's shape. 98 m/s forgets the square root." },
      { level: "medium", tag: "loop the loop", setup: { launch: "release", body: "block", h: 5, R: 2, h2: 2, m: 1, mu: 0 }, watch: "Release from 5.0 m and read N at the top. Then try 4.9 m",
        q: "A small block slides without friction down a ramp and into a vertical loop of radius 2 m. What is the least release height (above the bottom of the loop) for it to go all the way round?",
        options: ["5.0 m", "4.0 m", "5.4 m", "6.0 m"], answer: 0,
        hints: ["At the top, the least speed is when $N = 0$: then $mg = mv^2/R$.", "Energy from the start to the top: $mgh = mg(2R) + \\tfrac12 mv^2$."],
        explain: "$v_{top}^2 = gR$, so $mgh = 2mgR + \\tfrac12 mgR$ and $h = 2.5R = 5.0$ m. 4.0 m ($2R$) would just reach the top with no speed, but it falls off before that. 5.4 m is the answer for a rolling ball." },
      { level: "hard", tag: "spring into a loop", setup: { launch: "spring", body: "block", m: 0.5, k: 400, c: 0.31, R: 1.5, h2: 2, mu: 0 }, watch: "Launch at 0.31 m, then try 0.30 m. Which one makes it?",
        q: "A 0.5 kg block is pressed against a spring ($k = 400$ N/m) on a smooth floor, released, and slides into a vertical loop of radius 1.5 m ($g = 9.8$). What is the least compression for it to complete the loop?",
        options: ["0.30 m", "0.27 m", "0.21 m", "0.32 m"], answer: 0,
        hints: ["The spring's energy $\\tfrac12 kc^2$ must cover $mg(2R)$ plus the kinetic energy at the top.", "At the top the least speed has $v^2 = gR$, so you need $\\tfrac12 kc^2 \\ge 2.5\\,mgR$."],
        explain: "$\\tfrac12 (400)c^2 = 2.5(0.5)(9.8)(1.5) = 18.4$ J, so $c = \\sqrt{0.0919} = 0.303$ m. With 0.30 m it stores 18.0 J and falls off; 0.31 m stores 19.2 J and makes it. 0.27 m only gets it to the top ($2R$), 0.21 m drops the ½, and 0.32 m is the rolling-ball answer." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();
    if (location.hostname === "localhost") window.__lab_energy = { apply: apply, st: function () { return st; }, energies: energies, p: function () { return p; }, topFormula: topFormula };

    return function destroy() {
      sim.destroy(); [gE, gV, gN].forEach(function (g) { g.destroy(); });
      if (window.__lab_energy) delete window.__lab_energy;
    };
  }
})();
