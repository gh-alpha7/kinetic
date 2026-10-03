/* Electrostatics, lab 3: capacitors. A parallel-plate capacitor you can stretch, fill with a dielectric and cut off from its battery; then series and parallel combinations. */
(function () {
  "use strict";
  var EPS0 = 8.85e-12;            // C²/N m²
  var TAU = 0.4;                  // s: charging time constant in combination mode, slowed down so you can watch

  var lab = {
    id: "capacitors", chapter: "electrostatics", title: "Capacitors", short: "C = ε₀A/d, dielectrics, Q or V fixed",
    lede: "Pull the plates apart, slide in a dielectric, cut the battery off and try again. The one question to ask every time: is the charge fixed, or the voltage?",
    tries: [
      { id: "connected", title: "Double the gap with the battery connected",
        text: "Keep the battery on and drag the top plate until $d$ is twice what it was.",
        why: "The battery holds $V$ fixed. $C = \\varepsilon_0A/d$ halves, so $Q = CV$ halves: charge flows back into the battery. Energy $\\tfrac12CV^2$ halves too." },
      { id: "isolated", title: "Pull the plates apart with the battery cut off",
        text: "Untick the battery, then increase $d$ by at least half as much again.",
        why: "Now $Q$ has nowhere to go, so it's fixed. $V = Q/C$ grows with $d$, and so does $U = Q^2/2C$: the extra energy is the work you did pulling the attracting plates apart. $E = \\sigma/\\varepsilon_0$ doesn't change at all." },
      { id: "fill", title: "Fill the gap completely with the slab",
        text: "Make the slab as thick as the gap and slide it all the way in.",
        why: "Filling the whole gap multiplies $C$ by exactly $K$. The bound charges on the slab's faces cancel part of the plates' field, so $E$ inside drops to $E_0/K$." },
      { id: "combo", title: "Charge three capacitors in series, then in parallel",
        text: "In Combinations, charge them fully in series, then switch to parallel and charge again.",
        why: "In series every capacitor carries the same $Q$ and the voltages share out as $1/C$; $C_{eq}$ is less than the smallest. In parallel they share one $V$, the charges add, and $C_{eq} = C_1 + C_2 + C_3$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 480;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- state ---------- */
    var mode = "single", action = "plates", connected = true, Qfix = 0, book = null, rec = [], anchor = null, combo = { topo: "series", t: 0, seen: {} };

    /* ---------- controls ---------- */
    var aS = K.slider({ label: "Plate area $A$", unit: "cm²", min: 50, max: 400, step: 10, value: 100, onInput: function () { changed(); } });
    var dS = K.slider({ label: "Gap $d$", unit: "mm", min: 1, max: 10, step: 0.5, value: 2, onInput: function () { changed(); } });
    var vS = K.slider({ label: "Battery $V_0$", unit: "V", min: 10, max: 200, step: 10, value: 100, onInput: function () { newBook(); changed(); } });
    var kS = K.slider({ label: "Dielectric constant $K$", min: 1, max: 10, step: 0.5, value: 4, onInput: function () { changed(); } });
    var tS = K.slider({ label: "Slab thickness $t$", unit: "mm", min: 0.5, max: 10, step: 0.5, value: 2, onInput: function () { changed(); } });
    var fS = K.slider({ label: "Slab inserted", unit: "%", min: 0, max: 100, step: 5, value: 0, onInput: function () { changed(); } });
    var c1S = K.slider({ label: "$C_1$", unit: "μF", min: 1, max: 12, step: 1, value: 2, onInput: function () { comboChanged(); } });
    var c2S = K.slider({ label: "$C_2$", unit: "μF", min: 1, max: 12, step: 1, value: 3, onInput: function () { comboChanged(); } });
    var c3S = K.slider({ label: "$C_3$", unit: "μF", min: 1, max: 12, step: 1, value: 6, onInput: function () { comboChanged(); } });
    var vbS = K.slider({ label: "Battery $V$", unit: "V", min: 1, max: 24, step: 1, value: 12, onInput: function () { comboChanged(); } });

    P.controls.innerHTML = "<h3>Lab</h3>";
    var modeSeg = K.seg([{ label: "One capacitor", value: "single" }, { label: "Combinations", value: "combo" }], "single", function (v) { setMode(v); }, "Mode");
    P.controls.appendChild(modeSeg);
    var single = K.h("<div></div>"), multi = K.h("<div></div>");
    single.appendChild(K.h("<h3>Plates</h3>"));
    [aS, dS].forEach(function (s) { single.appendChild(s.el); });
    single.appendChild(K.h("<h3>Battery</h3>"));
    single.appendChild(vS.el);
    var connBox = K.check("Battery connected", true, function (v) { setConnected(v); });
    var r1 = K.h('<div class="row"></div>'); r1.appendChild(connBox); single.appendChild(r1);
    single.appendChild(K.h("<h3>Dielectric slab</h3>"));
    [kS, tS, fS].forEach(function (s) { single.appendChild(s.el); });
    single.appendChild(K.h("<h3>Play does</h3>"));
    var actSeg = K.seg([{ label: "Pull plates apart", value: "plates" }, { label: "Slide slab in", value: "slab" }], "plates", function (v) { action = v; newRec(); update(true); }, "Action");
    single.appendChild(actSeg);
    single.appendChild(K.h('<p class="control-hint">Or drag the top plate up and down, and the slab sideways.</p>'));
    multi.appendChild(K.h("<h3>Arrangement</h3>"));
    var topoSeg = K.seg([{ label: "Series", value: "series" }, { label: "Parallel", value: "parallel" }, { label: "C₁ + (C₂ ∥ C₃)", value: "mixed" }], "series",
      function (v) { combo.topo = v; comboChanged(); }, "Arrangement");
    multi.appendChild(topoSeg);
    multi.appendChild(K.h("<h3>Values</h3>"));
    [c1S, c2S, c3S, vbS].forEach(function (s) { multi.appendChild(s.el); });
    multi.appendChild(K.h('<p class="control-hint">Press Play to connect the battery and watch the charge build up.</p>'));
    multi.hidden = true;
    P.controls.appendChild(single); P.controls.appendChild(multi);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-fric"><i></i>+ charge</span><span class="c-disp"><i></i>− charge</span>' +
      '<span class="c-acc"><i></i>field E</span><span class="c-grav"><i></i>voltage V</span><span class="c-ten"><i></i>energy U</span><span class="muted"><i></i>dielectric</span></div>'));
    function pressSeg(seg, v) { seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }

    /* ---------- physics: one capacitor ---------- */
    function params() {
      var d = dS.get(), t = Math.min(tS.get(), d);
      return { A: aS.get(), d: d, t: t, K: kS.get(), f: fS.get() / 100, V0: vS.get() };
    }
    // C in pF, Q in nC, V in V, E in kV/m, U in nJ
    function solve(p, conn, qfix) {
      var A = p.A * 1e-4, d = p.d * 1e-3, t = p.t * 1e-3;
      var deff = d - t + t / p.K;
      var C1 = EPS0 * p.f * A / deff * 1e12, C2 = EPS0 * (1 - p.f) * A / d * 1e12, C = C1 + C2, Cair = EPS0 * A / d * 1e12;
      var V = conn ? p.V0 : qfix / C * 1000, Q = C * V / 1000;
      return { C: C, C1: C1, C2: C2, Cair: Cair, V: V, Q: Q, U: 0.5 * C * V * V / 1000, Eair: V / d / 1000, Egap: V / deff / 1000, Eslab: V / deff / p.K / 1000, deff: deff };
    }
    function state() { return solve(params(), connected, Qfix); }
    function xNow() { return action === "plates" ? dS.get() : fS.get(); }

    function newBook() { var s = state(); book = { Q0: s.Q, U0: s.U, Wb: 0, Q: s.Q }; anchor = { d: dS.get(), Q: s.Q, V: s.V, U: s.U, conn: connected }; }
    function newRec() { var s = state(); rec = [[xNow(), s.Q, s.V, s.U]]; }
    function setConnected(v) {
      var s = state();
      connected = v; connBox.querySelector("input").checked = v;
      if (!v) { Qfix = s.Q; K.flash(P.note, "Cut off: Q = " + K.fmt(s.Q, 3) + " nC is now trapped on the plates", 3000); }
      else K.flash(P.note, "Connected: the battery fixes V = " + vS.get() + " V", 3000);
      newBook(); newRec(); update(true);
    }
    // every change in d, A, K, t or f goes through here, so the battery's work is booked step by step
    function changed() {
      var p = params();
      if (p.f > 0 && tS.get() > p.d) tS.set(p.d);
      var s = state();
      if (connected) book.Wb += p.V0 * (s.Q - book.Q);                 // nC × V = nJ
      book.Q = s.Q;
      var x = xNow(), last = rec[rec.length - 1];
      if (!last || last[0] !== x || Math.abs(last[1] - s.Q) > 1e-12 || Math.abs(last[2] - s.V) > 1e-12) rec.push([x, s.Q, s.V, s.U]);
      if (rec.length > 400) rec.shift();
      checkTries(s, p);
      update(true);
    }
    function checkTries(s, p) {
      if (!anchor) return;
      if (connected && anchor.conn && Math.abs(p.d - 2 * anchor.d) < 1e-9 && Math.abs(s.Q / anchor.Q - 0.5) < 0.01) tries.mark("connected");
      if (!connected && !anchor.conn && p.d >= 1.5 * anchor.d - 1e-9 && s.V > anchor.V && s.U > anchor.U && Math.abs(s.Q - anchor.Q) < 1e-9) tries.mark("isolated");
      if (p.f >= 1 && p.t >= p.d - 1e-9 && Math.abs(s.C / s.Cair - p.K) < 1e-6 && p.K > 1) tries.mark("fill");
    }

    /* ---------- physics: combinations (μF, V, μC, μJ) ---------- */
    function solveCombo() {
      var C = [c1S.get(), c2S.get(), c3S.get()], V = vbS.get(), Ceq, Q = [], Vs = [];
      if (combo.topo === "series") { Ceq = 1 / (1 / C[0] + 1 / C[1] + 1 / C[2]); Q = [Ceq * V, Ceq * V, Ceq * V]; Vs = Q.map(function (q, i) { return q / C[i]; }); }
      else if (combo.topo === "parallel") { Ceq = C[0] + C[1] + C[2]; Vs = [V, V, V]; Q = C.map(function (c) { return c * V; }); }
      else {
        var C23 = C[1] + C[2]; Ceq = C[0] * C23 / (C[0] + C23);
        var Q1 = Ceq * V, V1 = Q1 / C[0], V23 = V - V1;
        Q = [Q1, C[1] * V23, C[2] * V23]; Vs = [V1, V23, V23];
      }
      return { C: C, V: V, Ceq: Ceq, Q: Q, Vs: Vs, U: Q.map(function (q, i) { return 0.5 * q * Vs[i]; }), Utot: 0.5 * Ceq * V * V };
    }
    function comboChanged() { sim.pause(); if (transportUI) transportUI.render(); combo.t = 0; combo.rec = [[0, [0, 0, 0], [0, 0, 0]]]; sim.resetClock(); P.time.textContent = "t = 0.00 s"; update(true); }
    function chargeFrac(t) { return 1 - Math.exp(-t / TAU); }

    function setMode(v) {
      mode = v; pressSeg(modeSeg, v); single.hidden = v !== "single"; multi.hidden = v !== "combo";
      sim.pause(); if (transportUI) transportUI.render();
      P.playBtn.dataset.label = v;
      if (v === "combo") comboChanged(); else { newBook(); newRec(); update(true); }
      transportUI && transportUI.render();
    }

    /* ---------- the clock: Play animates the chosen action or the charging ---------- */
    sim.on("before", function () {
      if (mode === "combo") {
        combo.t += K.DT;
        var s = solveCombo(), k = chargeFrac(combo.t);
        combo.rec.push([combo.t, s.Q.map(function (q) { return q * k; }), s.Vs.map(function (v) { return v * k; })]);
        if (combo.t >= 6 * TAU) {
          combo.seen[combo.topo] = true;
          if (combo.seen.series && combo.seen.parallel) tries.mark("combo");
          if (combo.t >= 8 * TAU) { sim.pause(); transportUI.render(); K.flash(P.note, "Fully charged: Q = C_eq V = " + K.fmt(s.Ceq * s.V, 1) + " μC from the battery"); }
        }
        update();
        return;
      }
      if (action === "plates") {
        var p = params(), dMax = 10;
        var nd = Math.min(dMax, +(dS.get() + 0.5).toFixed(2));
        if (sim.steps % 30 === 0) {                        // 1 mm/s, in 0.5 mm steps
          if (nd <= dS.get()) { sim.pause(); transportUI.render(); K.flash(P.note, "Widest gap"); return; }
          dS.set(nd); changed();
        }
        void p;
      } else {
        if (sim.steps % 12 === 0) {                        // 25 %/s
          if (fS.get() >= 100) { sim.pause(); transportUI.render(); K.flash(P.note, "Slab fully in"); return; }
          fS.set(fS.get() + 5); changed();
        }
      }
    });

    /* ---------- geometry of the drawing (world px) ---------- */
    var GX = 520, BOT = 380, PX_MM = 32;
    function geo() {
      var p = params(), w = 24 * Math.sqrt(p.A), g = p.d * PX_MM;
      return { p: p, w: w, g: g, x0: GX - w / 2, x1: GX + w / 2, topY: BOT - g, slabX: GX + w / 2 - p.f * w, slabH: p.t * PX_MM };
    }

    /* ---------- dragging ---------- */
    var drag = null;
    sim.pointer({
      down: function (pt) {
        if (mode !== "single") return false;
        var G = geo();
        if (pt.px > G.x0 - 10 && pt.px < G.x1 + 10 && Math.abs(pt.py - (G.topY - 6)) < 18) { drag = { kind: "plate" }; }
        else if (G.p.t > 0 && pt.px > G.slabX && pt.px < G.slabX + G.w && pt.py > BOT - G.slabH - 4 && pt.py < BOT + 4) { drag = { kind: "slab", x: pt.px, f: fS.get() }; }
        else return false;
        sim.pause(); transportUI.render();
        return true;
      },
      drag: function (pt) {
        if (!drag) return;
        var G = geo();
        if (drag.kind === "plate") {
          var d = K.clamp(Math.round((BOT - pt.py - 6) / PX_MM * 2) / 2, G.p.f > 0 ? Math.max(1, tS.get()) : 1, 10);
          if (d !== dS.get()) { dS.set(d); changed(); }
        } else {
          var f = K.clamp(Math.round((drag.f + (drag.x - pt.px) / G.w * 100) / 5) * 5, 0, 100);
          if (f !== fS.get()) { fS.set(f); changed(); }
        }
      },
      up: function () { drag = null; }
    });

    /* ---------- drawing ---------- */
    sim.on("over", function (ctx) { if (mode === "single") drawSingle(ctx); else drawCombo(ctx); });
    function plus(ctx, x, y, s, color) { ctx.strokeStyle = color; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); }
    function minus(ctx, x, y, s, color) { ctx.strokeStyle = color; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke(); }
    function battery(ctx, x, y, on) {
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(3);
      ctx.beginPath(); ctx.moveTo(x - 22, y - 8); ctx.lineTo(x + 22, y - 8); ctx.stroke();
      ctx.lineWidth = sim.u(6); ctx.beginPath(); ctx.moveTo(x - 12, y + 6); ctx.lineTo(x + 12, y + 6); ctx.stroke();
      K.label(ctx, "+", x + 32, y - 2, th.fric, { s: sim.u(1) }); K.label(ctx, "−", x + 32, y + 16, th.disp, { s: sim.u(1) });
      void on;
    }
    function drawSingle(ctx) {
      var G = geo(), s = state(), p = G.p, BX = 130, by = (G.topY + BOT) / 2, wy = BOT + 50, sx = BX + 70;
      // wires and the switch (on the lower wire)
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(BX, by - 8); ctx.lineTo(BX, G.topY - 44); ctx.lineTo(GX, G.topY - 44); ctx.lineTo(GX, G.topY - 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(BX, by + 6); ctx.lineTo(BX, wy); ctx.lineTo(sx, wy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, wy);
      if (connected) ctx.lineTo(sx + 50, wy); else ctx.lineTo(sx + 44, wy - 26);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 50, wy); ctx.lineTo(GX, wy); ctx.lineTo(GX, BOT + 12); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(sx, wy, sim.u(3.5), 0, 7); ctx.arc(sx + 50, wy, sim.u(3.5), 0, 7); ctx.fill();
      battery(ctx, BX, by, connected);
      K.label(ctx, vS.get() + " V", BX - 30, by + 6, th.grav, { s: sim.u(1), align: "right" });
      K.label(ctx, connected ? "switch closed" : "switch open", sx + 25, wy + 24, th.muted, { s: sim.u(0.85) });
      // field between the plates: line spacing shrinks as E grows
      var regions = [];
      if (p.f < 1) regions.push({ x0: G.x0, x1: G.slabX, E: s.Eair, slab: false });
      if (p.f > 0) regions.push({ x0: G.slabX, x1: G.x1, E: s.Egap, slab: true });
      regions.forEach(function (r) {
        var gapPx = Math.max(10, 1400 / Math.max(r.E, 1)), n = Math.max(1, Math.floor((r.x1 - r.x0) / gapPx));
        for (var i = 0; i < n; i++) {
          var x = r.x0 + (i + 0.5) * (r.x1 - r.x0) / n, yTop = G.topY + 4, yBot = BOT - 4;
          if (r.slab && G.slabH > 2) {
            var ys = BOT - G.slabH;
            K.arrow(ctx, x, yTop, x, Math.max(yTop + 3, ys - 2), th.acc, { s: sim.u(1), width: 1.6, head: 6 });
            if (i % Math.max(1, Math.round(p.K)) === 0) K.arrow(ctx, x, ys + 2, x, yBot, K.alpha(th.acc, 0.8), { s: sim.u(1), width: 1.6, head: 6 });
          } else K.arrow(ctx, x, yTop, x, yBot, th.acc, { s: sim.u(1), width: 1.6, head: 6 });
        }
      });
      // slab with its bound charges
      if (p.t > 0) {
        ctx.fillStyle = K.alpha(th.muted, 0.28); ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.5);
        ctx.fillRect(G.slabX, BOT - G.slabH, G.w, G.slabH); ctx.strokeRect(G.slabX, BOT - G.slabH, G.w, G.slabH);
        K.label(ctx, "K = " + p.K, G.slabX + G.w - 8, BOT - G.slabH / 2 + 7, th.muted, { s: sim.u(0.9), align: "right" });
        if (p.f > 0 && p.K > 1) {
          var nb = Math.max(1, Math.round((G.x1 - G.slabX) / 30 * (1 - 1 / p.K)));
          for (var b = 0; b < nb; b++) {
            var bx = G.slabX + (b + 0.5) * (G.x1 - G.slabX) / nb;
            minus(ctx, bx, BOT - G.slabH + 6, 4, s.Q >= 0 ? th.disp : th.fric);
            if (G.slabH > 16) plus(ctx, bx, BOT - 6, 4, s.Q >= 0 ? th.fric : th.disp);
          }
        }
      }
      // plates and their free charges
      ctx.fillStyle = th.body;
      ctx.fillRect(G.x0, G.topY - 12, G.w, 12); ctx.fillRect(G.x0, BOT, G.w, 12);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1); ctx.strokeRect(G.x0, G.topY - 12, G.w, 12);
      [[G.x0, Math.min(G.slabX, G.x1), s.C2 / Math.max(1e-9, 1 - p.f)], [Math.max(G.slabX, G.x0), G.x1, s.C1 / Math.max(1e-9, p.f)]].forEach(function (r, k) {
        if (r[1] - r[0] < 4 || (k === 0 && p.f >= 1) || (k === 1 && p.f <= 0)) return;
        var sigma = r[2] * s.V / 1000 / (p.A * 1e-4) / 1e6;            // μC/m² ... only for spacing
        var gap = K.clamp(24 / Math.max(sigma, 0.05), 7, 80), n = Math.max(1, Math.floor((r[1] - r[0]) / gap));
        for (var i = 0; i < n; i++) {
          var x = r[0] + (i + 0.5) * (r[1] - r[0]) / n;
          plus(ctx, x, G.topY - 6, 3.5, th.fric); minus(ctx, x, BOT + 6, 3.5, th.disp);
        }
      });
      K.label(ctx, "+" + K.fmt(s.Q, 3) + " nC", G.x0 + G.w * 0.78, G.topY - 16, th.fric, { s: sim.u(1), bg: true });
      K.label(ctx, "−" + K.fmt(s.Q, 3) + " nC", G.x0 + G.w * 0.78, BOT + 36, th.disp, { s: sim.u(1), bg: true });
      // gap dimension, on the left
      var dx = G.x0 - 18;
      ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1);
      ctx.beginPath(); ctx.moveTo(dx - 5, G.topY); ctx.lineTo(dx + 5, G.topY); ctx.moveTo(dx, G.topY); ctx.lineTo(dx, BOT); ctx.moveTo(dx - 5, BOT); ctx.lineTo(dx + 5, BOT); ctx.stroke();
      K.label(ctx, "d = " + K.fmt(p.d, 1) + " mm", dx - 8, (G.topY + BOT) / 2 + 7, th.ink, { s: sim.u(0.9), align: "right" });
      K.label(ctx, "↕ drag the plate", G.x1 + 8, G.topY - 2, th.muted, { s: sim.u(0.8), align: "left" });
      if (p.f < 1) K.label(ctx, "↔ drag the slab", G.slabX + G.w / 2, BOT + 66, th.muted, { s: sim.u(0.8) });
      P.hud.innerHTML = "<span>" + (connected ? "V fixed by the battery" : "Q fixed: isolated") + "</span><span>C = " + K.fmt(s.C, 2) + " pF</span>";
    }
    function cap(ctx, x, y, label, q, v, vertical) {
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(4);
      ctx.beginPath();
      if (vertical) { ctx.moveTo(x - 22, y - 7); ctx.lineTo(x + 22, y - 7); ctx.moveTo(x - 22, y + 7); ctx.lineTo(x + 22, y + 7); }
      else { ctx.moveTo(x - 7, y - 22); ctx.lineTo(x - 7, y + 22); ctx.moveTo(x + 7, y - 22); ctx.lineTo(x + 7, y + 22); }
      ctx.stroke();
      ctx.fillStyle = th.surface;
      K.label(ctx, label, x, y - 30, th.ink, { s: sim.u(1), bg: true });
      K.label(ctx, "Q " + K.fmt(q, 1) + " μC", x, y + 46, th.fric, { s: sim.u(0.85) });
      K.label(ctx, "V " + K.fmt(v, 2) + " V", x, y + 62, th.grav, { s: sim.u(0.85) });
    }
    function wire(ctx, pts) { ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2); ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }
    function drawCombo(ctx) {
      var s = solveCombo(), k = chargeFrac(combo.t), q = s.Q.map(function (x) { return x * k; }), v = s.Vs.map(function (x) { return x * k; });
      var names = ["C₁ = " + s.C[0] + " μF", "C₂ = " + s.C[1] + " μF", "C₃ = " + s.C[2] + " μF"];
      battery(ctx, 140, 260, true);
      K.label(ctx, s.V + " V", 104, 266, th.grav, { s: sim.u(1), align: "right" });
      var T = 110, B = 400;
      wire(ctx, [[140, 242], [140, T], [200, T]]); wire(ctx, [[140, 276], [140, B], [860, B], [860, T]]);
      if (combo.topo === "series") {
        wire(ctx, [[200, T], [313, T]]); wire(ctx, [[327, T], [493, T]]); wire(ctx, [[507, T], [673, T]]); wire(ctx, [[687, T], [860, T]]);
        cap(ctx, 320, T, names[0], q[0], v[0]); cap(ctx, 500, T, names[1], q[1], v[1]); cap(ctx, 680, T, names[2], q[2], v[2]);
      } else if (combo.topo === "parallel") {
        wire(ctx, [[200, T], [860, T]]);
        [320, 520, 720].forEach(function (x, i) { wire(ctx, [[x, T], [x, 243]]); wire(ctx, [[x, 257], [x, B]]); cap(ctx, x, 250, names[i], q[i], v[i], true); });
      } else {
        wire(ctx, [[200, T], [293, T]]); wire(ctx, [[307, T], [520, T]]);
        cap(ctx, 300, T, names[0], q[0], v[0]);
        wire(ctx, [[520, 80], [520, 140]]); wire(ctx, [[520, 80], [613, 80]]); wire(ctx, [[627, 80], [760, 80], [760, 140]]);
        wire(ctx, [[520, 140], [520, 200], [613, 200]]); wire(ctx, [[627, 200], [760, 200], [760, 140]]); wire(ctx, [[760, T], [860, T]]);
        cap(ctx, 620, 80, names[1], q[1], v[1]); cap(ctx, 620, 200, names[2], q[2], v[2]);
      }
      K.label(ctx, "C_eq = " + K.fmt(s.Ceq, 2) + " μF · battery has sent " + K.fmt(s.Ceq * s.V * k, 1) + " μC", 500, 456, th.ink, { s: sim.u(1), bg: true });
      P.hud.innerHTML = "<span>" + (combo.topo === "series" ? "series: same Q on each" : combo.topo === "parallel" ? "parallel: same V on each" : "C₁ carries the total charge") + "</span>";
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-fric">Q</b> · <span class="cap-x"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">V</b> · <span class="cap-x"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-ten">U</b> · <span class="cap-x"></span></p></div>';
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".cap-x");
    var gQ = new K.Graph(cv[0], { yLabel: "Q (nC)", xMax: 10, yMin: 0, color: th.fric });
    var gV = new K.Graph(cv[1], { yLabel: "V (V)", xMax: 10, yMin: 0, color: th.grav });
    var gU = new K.Graph(cv[2], { yLabel: "U (nJ)", xMax: 10, yMin: 0, color: th.ten });
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      [gQ, gV, gU].forEach(function (g) { g.clear(); g.extra = null; });
      if (mode === "single") {
        var plates = action === "plates", xl = plates ? "d (mm)" : "slab in (%)", xm = plates ? 10 : 100;
        [gQ, gV, gU].forEach(function (g) { g.o.xLabel = xl; g.o.xMax = xm; g.o.xAuto = false; });
        gQ.o.yLabel = "Q (nC)"; gV.o.yLabel = "V (V)"; gU.o.yLabel = "U (nJ)";
        var base = params(), tq = [], tv = [], tu = [];
        for (var x = plates ? 1 : 0; x <= xm + 1e-9; x += plates ? 0.1 : 1) {
          var p = Object.assign({}, base); if (plates) { p.d = x; p.t = Math.min(base.t, x); } else p.f = x / 100;
          var s = solve(p, connected, Qfix); tq.push([x, s.Q]); tv.push([x, s.V]); tu.push([x, s.U]);
        }
        gQ.set("theory", { points: tq, color: th.fric, dash: [5, 5], width: 1.5 });
        gV.set("theory", { points: tv, color: th.grav, dash: [5, 5], width: 1.5 });
        gU.set("theory", { points: tu, color: th.ten, dash: [5, 5], width: 1.5 });
        var sorted = rec.slice();
        gQ.set("sim", { points: sorted.map(function (r) { return [r[0], r[1]]; }), color: th.fric, width: 2.5, dot: true });
        gV.set("sim", { points: sorted.map(function (r) { return [r[0], r[2]]; }), color: th.grav, width: 2.5, dot: true });
        gU.set("sim", { points: sorted.map(function (r) { return [r[0], r[3]]; }), color: th.ten, width: 2.5, dot: true });
        var cx = connected ? "battery connected: V fixed" : "battery cut off: Q fixed";
        setBold(2, "U", "c-ten");
        caps[0].textContent = "vs " + xl + " · " + cx; caps[1].textContent = "vs " + xl; caps[2].textContent = "vs " + xl + " · stored ½CV²";
      } else {
        var sc = solveCombo(), cols = [th.fric, th.acc, th.grav];
        [gQ, gV].forEach(function (g) { g.o.xLabel = "t (s)"; g.o.xMax = 8 * TAU; });
        gQ.o.yLabel = "Q (μC)"; gV.o.yLabel = "V (V)";
        [0, 1, 2].forEach(function (i) {
          gQ.set("s" + i, { points: combo.rec.map(function (r) { return [r[0], r[1][i]]; }), color: cols[i], width: 2.5, dot: true });
          gQ.set("f" + i, { points: [[0, sc.Q[i]], [8 * TAU, sc.Q[i]]], color: cols[i], dash: [5, 5], width: 1.2 });
          gV.set("s" + i, { points: combo.rec.map(function (r) { return [r[0], r[2][i]]; }), color: cols[i], width: 2.5, dot: true });
          gV.set("f" + i, { points: [[0, sc.Vs[i]], [8 * TAU, sc.Vs[i]]], color: cols[i], dash: [5, 5], width: 1.2 });
        });
        gU.o.xLabel = "C₁ (μF)"; gU.o.xMax = 12; gU.o.yLabel = "C_eq (μF)";
        var ce = [];
        for (var c1 = 0.2; c1 <= 12 + 1e-9; c1 += 0.1) ce.push([c1, ceqWith(c1)]);
        gU.set("theory", { points: ce, color: th.normal, dash: [5, 5], width: 1.5 });
        gU.extra = function (ctx, X, Y) { ring(ctx, X(sc.C[0]), Y(sc.Ceq)); };
        caps[0].textContent = "on C₁ (red), C₂ (orange), C₃ (purple) while charging; dashed: final";
        caps[1].textContent = "across each, same colours";
        caps[2].textContent = "as C₁ varies (others fixed); ring: yours"; setBold(2, "C_eq", "c-normal");
      }
      [gQ, gV, gU].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function setBold(i, text, cls) { var b = P.graphs.querySelectorAll(".graph-cap b")[i]; b.textContent = text; b.className = cls; }
    function ceqWith(c1) {
      var c2 = c2S.get(), c3 = c3S.get();
      if (combo.topo === "series") return 1 / (1 / c1 + 1 / c2 + 1 / c3);
      if (combo.topo === "parallel") return c1 + c2 + c3;
      return c1 * (c2 + c3) / (c1 + c2 + c3);
    }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'.repeat(4);
    var eqLabels = P.eqs.querySelectorAll(".eq-label"), eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "C", label: "capacitance", cls: "c-normal" }, { id: "Q", label: "charge", cls: "c-fric" }, { id: "V", label: "voltage", cls: "c-grav" },
      { id: "E", label: "field in the air", cls: "c-acc" }, { id: "E2", label: "field in the slab", cls: "c-acc" }, { id: "U", label: "stored energy", cls: "c-ten" },
      { id: "Wb", label: "work by battery" }, { id: "Wy", label: "work by you" }
    ]);
    function lab4(a) { a.forEach(function (t, i) { eqLabels[i].textContent = t; }); }
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      if (mode === "single") {
        var p = params(), s = state(), A = "(" + K.fmt(p.A, 0) + "\\times10^{-4})", d = "(" + K.fmt(p.d, 1) + "\\times10^{-3})";
        lab4(["Capacitance", connected ? "Battery connected: V is fixed" : "Battery cut off: Q is fixed", "Stored energy", "Where the energy went (since the last switch)"]);
        if (p.f <= 0 || p.t <= 0) K.tex(eqEls[0], "C = \\frac{\\varepsilon_0 A}{d} = \\frac{(8.85\\times10^{-12})" + A + "}{" + d + "} = \\mathbf{" + K.fmt(s.C, 2) + "}\\ \\text{pF}");
        else if (p.f >= 1) K.tex(eqEls[0], "C = \\frac{\\varepsilon_0 A}{d - t + t/K} = \\frac{(8.85\\times10^{-12})" + A + "}{(" + K.fmt(p.d, 1) + " - " + K.fmt(p.t, 1) + " + " + K.fmt(p.t, 1) + "/" + p.K + ")\\times10^{-3}} = \\mathbf{" + K.fmt(s.C, 2) + "}\\ \\text{pF}");
        else K.tex(eqEls[0], "C = \\frac{\\varepsilon_0 fA}{d - t + t/K} + \\frac{\\varepsilon_0 (1-f)A}{d} = " + K.fmt(s.C1, 2) + " + " + K.fmt(s.C2, 2) + " = \\mathbf{" + K.fmt(s.C, 2) + "}\\ \\text{pF}");
        if (connected) K.tex(eqEls[1], "Q = CV_0 = (" + K.fmt(s.C, 2) + "\\times10^{-12})(" + p.V0 + ") = \\mathbf{" + K.fmt(s.Q, 3) + "}\\ \\text{nC}");
        else K.tex(eqEls[1], "V = \\frac{Q}{C} = \\frac{" + K.fmt(Qfix, 3) + "\\times10^{-9}}{" + K.fmt(s.C, 2) + "\\times10^{-12}} = \\mathbf{" + K.fmt(s.V, 1) + "}\\ \\text{V}");
        K.tex(eqEls[2], "U = \\tfrac12 CV^2 = \\frac{Q^2}{2C} = \\tfrac12(" + K.fmt(s.C, 2) + "\\times10^{-12})(" + K.fmt(s.V, 1) + ")^2 = \\mathbf{" + K.fmt(s.U, 1) + "}\\ \\text{nJ}");
        var dU = s.U - book.U0, Wy = dU - book.Wb;
        K.tex(eqEls[3], "W_{you} = \\Delta U - W_{battery} = " + n(dU, 1) + " - " + n(book.Wb, 1) + " = \\mathbf{" + K.fmt(Wy, 1) + "}\\ \\text{nJ}");
        setR("C", K.fmt(s.C, 2) + " pF", "air only " + K.fmt(s.Cair, 2) + " pF (×" + K.fmt(s.C / s.Cair, 2) + ")");
        setR("Q", K.fmt(s.Q, 3) + " nC", connected ? "= CV₀" : "trapped");
        setR("V", K.fmt(s.V, 1) + " V", connected ? "the battery's" : "= Q/C");
        setR("E", K.fmt(p.f < 1 ? s.Eair : s.Egap, 1) + " kV/m", p.f > 0 && p.f < 1 ? "beside the slab · air over the slab " + K.fmt(s.Egap, 1) : p.f >= 1 && p.t < p.d ? "air above the slab" : "");
        setR("E2", p.f > 0 && p.t > 0 ? K.fmt(s.Eslab, 1) + " kV/m" : "—", p.f > 0 && p.t > 0 ? "= E_air / K" : "no slab");
        setR("U", K.fmt(s.U, 1) + " nJ", "½CV²");
        setR("Wb", K.fmt(book.Wb, 1) + " nJ", connected ? "V₀ΔQ" : "disconnected: 0");
        setR("Wy", K.fmt(Wy, 1) + " nJ", Wy >= 0 ? "you pulled against the attraction" : "the field pulled for you");
      } else {
        var c = solveCombo(), C = c.C;
        lab4(["Equivalent capacitance", "Charge from the battery", "How it shares out", "Energy"]);
        if (combo.topo === "series") K.tex(eqEls[0], "\\frac{1}{C_{eq}} = \\frac1{" + C[0] + "} + \\frac1{" + C[1] + "} + \\frac1{" + C[2] + "} \\Rightarrow C_{eq} = \\mathbf{" + K.fmt(c.Ceq, 2) + "}\\ \\mu\\text{F}");
        else if (combo.topo === "parallel") K.tex(eqEls[0], "C_{eq} = C_1 + C_2 + C_3 = " + C[0] + " + " + C[1] + " + " + C[2] + " = \\mathbf{" + K.fmt(c.Ceq, 2) + "}\\ \\mu\\text{F}");
        else K.tex(eqEls[0], "C_{eq} = \\frac{C_1(C_2 + C_3)}{C_1 + C_2 + C_3} = \\frac{" + C[0] + "(" + (C[1] + C[2]) + ")}{" + (C[0] + C[1] + C[2]) + "} = \\mathbf{" + K.fmt(c.Ceq, 2) + "}\\ \\mu\\text{F}");
        K.tex(eqEls[1], "Q = C_{eq}V = " + K.fmt(c.Ceq, 2) + "\\times" + c.V + " = \\mathbf{" + K.fmt(c.Ceq * c.V, 2) + "}\\ \\mu\\text{C}");
        K.tex(eqEls[2], [0, 1, 2].map(function (i) { return "Q_" + (i + 1) + " = " + K.fmt(c.Q[i], 2) + ",\\ V_" + (i + 1) + " = " + K.fmt(c.Vs[i], 2); }).join(";\\ ") + "\\ (\\mu\\text{C, V})");
        K.tex(eqEls[3], "U = \\tfrac12 C_{eq}V^2 = \\tfrac12(" + K.fmt(c.Ceq, 2) + ")(" + c.V + ")^2 = \\mathbf{" + K.fmt(c.Utot, 1) + "}\\ \\mu\\text{J} = \\textstyle\\sum \\tfrac12 Q_iV_i");
        var k = chargeFrac(combo.t);
        setR("C", K.fmt(c.Ceq, 2) + " μF", "equivalent");
        setR("Q", K.fmt(c.Ceq * c.V * k, 2) + " μC", "final " + K.fmt(c.Ceq * c.V, 2) + " μC");
        setR("V", c.V + " V", "battery");
        setR("E", "—", "see one capacitor"); setR("E2", "—");
        setR("U", K.fmt(c.Utot * k * k, 1) + " μJ", "final " + K.fmt(c.Utot, 1) + " μJ");
        setR("Wb", K.fmt(c.Ceq * c.V * c.V * k, 1) + " μJ", "QV: twice what's stored");
        setR("Wy", "—", "half the battery's work heats the wires");
      }
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A parallel-plate capacitor stores charge $\\pm Q$ on two plates; $C = Q/V = \\varepsilon_0A/d$ depends only on the geometry. A dielectric slab of constant $K$ and thickness $t$ acts like a thinner air gap: $C = \\dfrac{\\varepsilon_0A}{d - t + t/K}$. Slid in only part of the way, the two parts sit side by side, in parallel.</p>" +
      "<p>Every JEE problem starts with one question. <b>Battery connected?</b> Then $V$ is fixed and $Q = CV$ follows $C$. <b>Battery cut off?</b> Then $Q$ is fixed and $V = Q/C$ moves opposite to $C$.</p>" +
      "<p>Combinations: in <b>series</b> the same $Q$ flows onto each and $1/C_{eq} = \\sum 1/C_i$; in <b>parallel</b> they share $V$ and $C_{eq} = \\sum C_i$.</p>" +
      '<div class="trap"><b>JEE trap: energy goes opposite ways in the two cases.</b> Insert a slab with the battery cut off: $U = Q^2/2C$ falls by $K$ (the slab is pulled in). With the battery on: $U = \\tfrac12CV^2$ rises by $K$, because the battery supplies $V\\Delta Q$, twice the gain in stored energy.</div>');
    function apply(s) {
      setMode(s.mode || "single");
      if (s.mode === "combo") {
        combo.topo = s.topo; pressSeg(topoSeg, s.topo);
        c1S.set(s.c[0]); c2S.set(s.c[1]); c3S.set(s.c[2]); vbS.set(s.V); comboChanged(); return;
      }
      action = s.action || "plates"; pressSeg(actSeg, action);
      aS.set(s.A); dS.set(s.d); vS.set(s.V0); kS.set(s.K); tS.set(s.t); fS.set(s.f);
      connected = true; connBox.querySelector("input").checked = true;
      sim.pause(); sim.resetClock(); P.time.textContent = "t = 0.00 s";
      newBook(); newRec();
      if (s.connected === false) setConnected(false); else update(true);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "C = ε₀A/d", setup: { A: 100, d: 2, V0: 100, K: 4, t: 2, f: 0 }, watch: "Read C, then drag the gap to 1 mm",
        q: "A parallel-plate capacitor has plates of area 100 cm², 2 mm apart, with air between them. What is its capacitance? ($\\varepsilon_0 = 8.85\\times10^{-12}$ F/m)",
        options: ["44.3 pF", "442.5 pF", "88.5 pF", "22.1 pF"], answer: 0,
        explain: "$C = \\dfrac{8.85\\times10^{-12}\\times 100\\times10^{-4}}{2\\times10^{-3}} = 4.43\\times10^{-11}$ F = 44.3 pF. Remember 1 cm² = $10^{-4}$ m², not $10^{-2}$." },
      { level: "medium", tag: "slab, battery cut off", setup: { A: 100, d: 2, V0: 100, K: 4, t: 2, f: 0, connected: false, action: "slab" }, watch: "Press Play to slide the slab in; watch V and U",
        q: "That capacitor is charged to 100 V and the battery is removed. A slab with $K = 4$ is then slid in, filling the gap. What are the new voltage and stored energy?",
        options: ["25 V and 55.3 nJ", "100 V and 885 nJ", "25 V and 221 nJ", "400 V and 885 nJ"], answer: 0,
        hints: ["With the battery gone, which stays the same: $Q$ or $V$?", "$C$ becomes $4 \\times 44.25$ pF. Use $V = Q/C$ and $U = Q^2/2C$."],
        explain: "$Q = CV = 4.425$ nC stays put. $C$ rises to 177 pF, so $V = Q/C = 25$ V and $U = Q^2/2C$ drops from 221.25 nJ to 55.3 nJ. The missing energy is the work the field did pulling the slab in. With the battery connected you'd get 100 V and 885 nJ instead." },
      { level: "hard", tag: "slab of partial thickness", setup: { A: 200, d: 6, V0: 120, K: 3, t: 3, f: 100 }, watch: "Read the field in the air and in the slab",
        q: "A 200 cm² capacitor with a 6 mm gap holds a 3 mm slab ($K = 3$) resting on one plate, and is connected to a 120 V battery. What is the electric field in the air part of the gap?",
        options: ["30 kV/m", "20 kV/m", "40 kV/m", "10 kV/m"], answer: 0,
        hints: ["$D = \\sigma$ is the same in both layers, so $E_{air} = K E_{slab}$.", "The voltages add: $E_{air}(d - t) + E_{slab}t = V$, so $E_{air} = \\dfrac{V}{d - t + t/K}$."],
        explain: "$E_{air} = \\dfrac{120}{(6 - 3 + 3/3)\\times10^{-3}} = \\dfrac{120}{4\\times10^{-3}} = 30$ kV/m, and the slab holds $E/K = 10$ kV/m. $V/d = 20$ kV/m is the average, not the air field; 40 kV/m ignores the slab's share of the voltage. $C = \\varepsilon_0A/(4 \\text{ mm}) = 44.25$ pF." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = K.transport(P, sim, {
      playLabel: "Play",
      onPlay: function () { if (mode === "combo" && combo.t >= 8 * TAU) comboChanged(); },
      onReset: function () {
        if (mode === "combo") { comboChanged(); return; }
        sim.resetClock(); P.time.textContent = "t = 0.00 s";
        if (action === "plates") dS.set(2); else fS.set(0);
        if (fS.get() > 0 && tS.get() > dS.get()) tS.set(dS.get());
        newBook(); newRec(); update(true);
      }
    });
    newBook(); newRec(); update(true);

    if (location.hostname === "localhost") {
      window.__lab_capacitors = {
        apply: apply, state: state, combo: solveCombo, book: function () { return book; }, setMode: setMode, setConnected: setConnected,
        set: function (o) { if (o.d != null) dS.set(o.d); if (o.f != null) fS.set(o.f); if (o.t != null) tS.set(o.t); if (o.K != null) kS.set(o.K); if (o.A != null) aS.set(o.A); changed(); },
        topo: function (v) { combo.topo = v; pressSeg(topoSeg, v); comboChanged(); }, comboT: function () { return combo.t; }
      };
    }
    return function destroy() { sim.destroy(); [gQ, gV, gU].forEach(function (g) { g.destroy(); }); delete window.__lab_capacitors; };
  }
})();
