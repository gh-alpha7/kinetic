/* Properties of matter, lab 1: a wire under load. Stress, strain, Young's modulus, the stress–strain curve and elastic energy. */
(function () {
  "use strict";
  var G = 9.8, M_MAX = 150;
  // Y: Young's modulus, sp: proportional limit, sy: yield point (elastic limit), sb: breaking stress, all in Pa
  var MATS = {
    steel:  { label: "Steel", Y: 2.0e11, sp: 2.5e8, sy: 3.0e8, sb: 4.0e8 },
    copper: { label: "Copper", Y: 1.1e11, sp: 1.2e8, sy: 1.5e8, sb: 2.2e8 },
    brass:  { label: "Brass", Y: 0.9e11, sp: 1.5e8, sy: 1.9e8, sb: 3.4e8 },
    alu:    { label: "Aluminium", Y: 0.7e11, sp: 0.6e8, sy: 0.8e8, sb: 1.1e8 }
  };
  // strain at each landmark: P (proportional limit), Y (yield), B (breaking). The plastic part is drawn shorter
  // than a real ductile wire's (they stretch 20 % or more), so the elastic part stays visible.
  Object.keys(MATS).forEach(function (k) { var m = MATS[k]; m.ep = m.sp / m.Y; m.ey = m.sy / m.Y + 0.3 * m.ep; m.eb = 6 * m.ey; });

  // the loading curve: Hooke's straight line, a gentle bend up to yield, then the plastic region flattening out at the breaking stress
  function epsLoad(m, s) {
    if (s <= m.sp) return s / m.Y;
    if (s <= m.sy) { var u = (s - m.sp) / (m.sy - m.sp); return s / m.Y + 0.3 * m.ep * u * u; }
    var v = Math.min(1, (s - m.sy) / (m.sb - m.sy));
    return m.ey + (m.eb - m.ey) * (1 - Math.sqrt(1 - v));
  }
  function sigLoad(m, e) {
    if (e <= m.ep) return e * m.Y;
    if (e <= m.ey) {
      var lo = m.sp, hi = m.sy;
      for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (epsLoad(m, mid) < e) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    var w = Math.min(1, (e - m.ey) / (m.eb - m.ey));
    return m.sy + (m.sb - m.sy) * (1 - (1 - w) * (1 - w));
  }
  // with history: once a wire has gone past yield it unloads along a line of slope Y and keeps a permanent set
  function strainFor(w, s) {
    var top = sigLoad(w.m, w.emax);
    if (s >= top || w.emax <= w.m.ey) return epsLoad(w.m, s);
    return w.emax - (top - s) / w.m.Y;
  }
  function stressFor(w, e) {
    if (e >= w.emax || w.emax <= w.m.ey) return sigLoad(w.m, Math.max(0, e));
    return Math.max(0, sigLoad(w.m, w.emax) - w.m.Y * (w.emax - e));   // below the set it goes slack
  }
  // ∫σ dε along the wire's current curve (exact on straight parts)
  function integ(w, e1, e2) {
    var n = 16, s = 0, h = (e2 - e1) / n;
    for (var i = 0; i <= n; i++) s += (i === 0 || i === n ? 0.5 : 1) * stressFor(w, e1 + i * h);
    return s * h;
  }

  // "1.25 × 10^8" for TeX, and the same with superscripts for readouts
  function sciParts(v, d) {
    if (!v) return { m: K.fmt(0, d), e: 0 };
    var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
    if (Number(m.toFixed(d)) >= 10) { e++; m /= 10; }
    return { m: m.toFixed(d), e: e };
  }
  function sci(v, d) { var p = sciParts(v, d === undefined ? 2 : d); return p.e === 0 ? p.m : p.m + "\\times 10^{" + p.e + "}"; }
  var SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sciTxt(v, d) {
    var p = sciParts(v, d === undefined ? 2 : d);
    return p.e === 0 ? p.m : p.m + "×10" + String(p.e).split("").map(function (c) { return SUP[c]; }).join("");
  }

  var lab = {
    id: "elasticity", chapter: "matter", title: "Stress, strain & Young's modulus", short: "Hooke's law, stress–strain curve",
    lede: "Hang masses on a wire and watch it stretch (magnified, with a scale to read it). Load it gently and it springs back; load it hard and it never quite does, and then it snaps.",
    tries: [
      { id: "hooke", title: "Double the load, double the stretch",
        text: "Hang a load, note $\\Delta L$, then hang exactly twice that load. Stay below the proportional limit.",
        why: "Below the proportional limit stress ∝ strain (Hooke's law), so $\\Delta L = \\dfrac{FL}{AY}$ grows in step with $F$. The F–ΔL graph is a straight line of slope $k = YA/L$." },
      { id: "set", title: "Give the wire a permanent set",
        text: "Load it past the yield point (but not to breaking), then take every mass off.",
        why: "Past the elastic limit the atoms slide past each other. Unloading follows a line parallel to the elastic one, so at zero load the wire stays longer: a permanent set." },
      { id: "length", title: "Break the same wire at two lengths",
        text: "Snap a wire, then change only its length and snap it again. Compare the breaking loads.",
        why: "A wire breaks at a fixed <i>stress</i> $\\sigma_b$, so the breaking load is $\\sigma_b A$. Length doesn't enter: a longer wire stretches more, but snaps at the same load." },
      { id: "thin", title: "Same load, thinner wire",
        text: "Join two wires of the same metal in series, one with twice the radius of the other, and hang a load.",
        why: "Both carry the same $F$, but $\\Delta L \\propto 1/r^2$: the thin wire stretches 4× as much and stores 4× the energy ($U = \\tfrac12 F\\Delta L$)." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 600, TOP = 46;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "single", matA = "steel", matB = "copper";
    var matOpts = Object.keys(MATS).map(function (k) { return { label: MATS[k].label, value: k }; });
    var LS = K.slider({ label: "Length $L$ (each wire)", unit: "m", min: 0.5, max: 3, step: 0.1, value: 2, onInput: rebuild });
    var rAS = K.slider({ label: "Radius $r_A$", unit: "mm", min: 0.2, max: 1, step: 0.05, value: 0.5, onInput: rebuild });
    var rBS = K.slider({ label: "Radius $r_B$", unit: "mm", min: 0.2, max: 1, step: 0.05, value: 0.5, onInput: rebuild });
    var mS = K.slider({ label: "Load $m$", unit: "kg", min: 0, max: M_MAX, step: 0.5, value: 10, onInput: function (v) { userLoad(v); },
      hint: "Or click the slotted masses on the stage. Click the hanger to take one off." });
    P.controls.innerHTML = "<h3>Setup</h3>";
    var modeSeg = K.seg([{ label: "One wire", value: "single" }, { label: "Two in series", value: "series" }, { label: "Side by side", value: "parallel" }], mode,
      function (v) { mode = v; wireB.hidden = v === "single"; rebuild(); }, "Setup");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h('<h3><span class="c-ten">Wire A</span></h3>'));
    var segA = K.seg(matOpts, matA, function (v) { matA = v; rebuild(); }, "Wire A material");
    P.controls.appendChild(segA);
    P.controls.appendChild(rAS.el);
    var wireB = K.h('<div><h3><span class="c-app">Wire B</span></h3></div>');
    var segB = K.seg(matOpts, matB, function (v) { matB = v; rebuild(); }, "Wire B material");
    wireB.appendChild(segB); wireB.appendChild(rBS.el);
    wireB.hidden = true;
    P.controls.appendChild(wireB);
    P.controls.appendChild(K.h("<h3>Both</h3>"));
    [LS, mS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-ten"><i></i>wire A</span><span class="c-app"><i></i>wire B</span><span class="c-grav"><i></i>load mg</span>' +
      '<span class="c-disp"><i></i>extension ΔL</span><span class="c-acc"><i></i>stored energy</span></div>'));
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }

    /* ---------- the wires ---------- */
    var wires = [], st, path, stack = [], breaks = [], elasticLoads = [];
    function makeWire(key, rmm) {
      var r = rmm / 1000;
      return { key: key, m: MATS[key], r: r, A: Math.PI * r * r, L: LS.get(), e: 0, s: 0, emax: 0, W: 0 };
    }
    function k(w) { return w.m.Y * w.A / w.L; }
    function kEff() {
      if (mode === "single") return k(wires[0]);
      if (mode === "series") return 1 / (1 / k(wires[0]) + 1 / k(wires[1]));
      return k(wires[0]) + k(wires[1]);
    }
    function ext() {
      if (mode === "series") return wires[0].e * wires[0].L + wires[1].e * wires[1].L;
      return wires[0].e * wires[0].L;
    }
    function totalW() { return wires.reduce(function (s, w) { return s + w.W; }, 0); }
    function elastic() { return wires.every(function (w) { return w.s <= w.m.sp * (1 + 1e-12) && w.emax <= w.m.ep * (1 + 1e-12); }); }
    // extension of the whole setup when the first wire reaches a given landmark stress ("sp", "sy" or "sb")
    function extAt(which) {
      if (mode === "single") { var w = wires[0]; return epsLoad(w.m, w.m[which]) * w.L; }
      if (mode === "series") {
        var F = Math.min(wires[0].A * wires[0].m[which], wires[1].A * wires[1].m[which]);
        return wires.reduce(function (s, w) { return s + epsLoad(w.m, F / w.A) * w.L; }, 0);
      }
      return Math.min(epsLoad(wires[0].m, wires[0].m[which]), epsLoad(wires[1].m, wires[1].m[which])) * wires[0].L;
    }
    function breakLoad() {
      if (mode !== "parallel") return Math.min.apply(null, wires.map(function (w) { return w.A * w.m.sb; }));
      var e = Math.min(wires[0].m.eb, wires[1].m.eb);
      return wires[0].A * sigLoad(wires[0].m, e) + wires[1].A * sigLoad(wires[1].m, e);
    }

    // put the setup in equilibrium under a load F (newtons); returns false if a wire snaps
    function settle(F) {
      if (st.broken) return false;
      var news;
      if (mode !== "parallel") {
        for (var i = 0; i < wires.length; i++) if (F / wires[i].A >= wires[i].m.sb) { snap(i, F); return false; }
        news = wires.map(function (w) { return { s: F / w.A, e: strainFor(w, F / w.A) }; });
      } else {
        var emin = Math.min(wires[0].m.eb, wires[1].m.eb);
        var load = function (e) { return wires[0].A * stressFor(wires[0], e) + wires[1].A * stressFor(wires[1], e); };
        if (F >= load(emin)) { snap(wires[0].m.eb <= wires[1].m.eb ? 0 : 1, F); return false; }
        var lo = 0, hi = emin;
        for (var j = 0; j < 80; j++) { var mid = (lo + hi) / 2; if (load(mid) <= F) lo = mid; else hi = mid; }
        var e = (lo + hi) / 2;
        news = wires.map(function (w) { return { s: stressFor(w, e), e: e }; });
      }
      wires.forEach(function (w, n) {
        w.W += w.A * w.L * integ(w, w.e, news[n].e);
        w.e = news[n].e; w.s = news[n].s; w.emax = Math.max(w.emax, w.e);
      });
      st.F = F;
      return true;
    }
    function snap(i, F) {
      st.broken = { wire: i, F: F }; st.ramp = false;
      st.fall = { y: 0, v: 0 };
      if (mode === "single") breaks.push({ key: wires[0].key, r: wires[0].r, L: wires[0].L, F: F });
      if (breaks.length > 1) {
        var last = breaks[breaks.length - 1];
        if (breaks.some(function (b) { return b !== last && b.key === last.key && Math.abs(b.r - last.r) < 1e-9 && Math.abs(b.L - last.L) > 0.05; })) tries.mark("length");
      }
      K.flash(P.note, (mode === "parallel" ? "A wire snapped and the bar tipped" : "Snap! Wire " + (i ? "B" : "A") + " broke") +
        " at F = " + K.fmt(F, 1) + " N (σ_b·A = " + K.fmt(mode === "parallel" ? breakLoad() : wires[i].A * wires[i].m.sb, 1) + " N)", 4000);
      if (!sim.running) { sim.play(); transportUI.render(); }
    }
    // move the load from where it is to m (kg) in n small steps, so the graphs follow the real curve
    function goTo(m, n) {
      var m0 = st.m;
      for (var i = 1; i <= n; i++) {
        var mi = m0 + (m - m0) * i / n;
        if (!settle(mi * G)) { st.m = mi; return false; }
        st.m = mi;
        record();
      }
      return true;
    }
    function record() {
      var x = ext() * 1000;
      wires.forEach(function (w, i) { path.ss[i].push([w.e * 1000, w.s / 1e6]); });
      path.fx.push([x, st.F]); path.wx.push([x, totalW()]);
    }

    function rebuild() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      wires = [makeWire(matA, rAS.get())];
      if (mode !== "single") wires.push(makeWire(matB, rBS.get()));
      st = { m: 0, F: 0, broken: null, fall: null, ramp: false };
      path = { ss: wires.map(function () { return [[0, 0]]; }), fx: [[0, 0]], wx: [[0, 0]] };
      elasticLoads = [];
      scale = null;
      P.time.textContent = "t = 0.00 s";
      stack = decompose(mS.get());
      goTo(mS.get(), 40);
      theory(); afterLoad(); update(true);
    }
    function userLoad(m, newStack) {
      if (st.broken) { rebuild(); return; }
      st.ramp = false;
      m = K.clamp(Math.round(m * 2) / 2, 0, M_MAX);
      mS.set(m); stack = newStack && Math.abs(newStack.reduce(function (a, d) { return a + d; }, 0) - m) < 1e-9 ? newStack : decompose(m);
      goTo(m, 20);
      afterLoad(); update(true);
    }
    // the experiments that depend on where the load has been
    function afterLoad() {
      if (st.broken) return;
      if (elastic() && st.m > 0) {
        if (elasticLoads.some(function (q) { return Math.abs(st.m - 2 * q) < 1e-9 || Math.abs(q - 2 * st.m) < 1e-9; })) tries.mark("hooke");
        elasticLoads.push(st.m);
      }
      if (st.m === 0 && wires.some(function (w) { return w.emax > w.m.ey && w.e > 1e-9; })) tries.mark("set");
      if (mode === "series" && st.m > 0 && elastic() && wires[0].key === wires[1].key) {
        var q = wires[0].r / wires[1].r;
        if (Math.abs(q - 2) < 1e-6 || Math.abs(q - 0.5) < 1e-6) tries.mark("thin");
      }
    }

    /* ---------- slotted masses ---------- */
    var DISCS = [50, 20, 10, 5, 1, 0.5];
    function decompose(m) {
      var out = [], left = Math.round(m * 2) / 2;
      DISCS.forEach(function (d) { while (left >= d - 1e-9) { out.push(d); left -= d; } });
      return out;
    }
    function discH(d) { return { 50: 17, 20: 14, 10: 11, 5: 8, 1: 5, 0.5: 4 }[d]; }
    function discW(d) { return { 50: 70, 20: 62, 10: 54, 5: 46, 1: 38, 0.5: 32 }[d]; }
    var SHELF = [20, 10, 5, 1].map(function (d, i) { return { d: d, x: 890, y: 190 + i * 62 }; });

    sim.pointer({
      down: function (pt) {
        var x = pt.px, y = pt.py;
        for (var i = 0; i < SHELF.length; i++) {
          var s = SHELF[i];
          if (Math.abs(x - s.x) < 40 && Math.abs(y - s.y) < 20) { userLoad(st.m + s.d, stack.concat([s.d])); K.flash(P.note, "+" + s.d + " kg: load is now " + K.fmt(mS.get(), 1) + " kg"); return false; }
        }
        var hb = st.hangerBox;
        if (hb && x > hb.x0 && x < hb.x1 && y > hb.y0 && y < hb.y1 && stack.length) {
          var top = stack[stack.length - 1];
          userLoad(st.m - top, stack.slice(0, -1)); K.flash(P.note, "−" + top + " kg: load is now " + K.fmt(mS.get(), 1) + " kg");
        }
        return false;
      }
    });

    /* ---------- play: load it up slowly ---------- */
    sim.on("step", function () {
      if (st.fall) {
        st.fall.v += 300 * G * K.DT; st.fall.y += st.fall.v * K.DT;
        if (st.fall.y > H) { st.fall.done = true; sim.pause(); transportUI.render(); }
        return;
      }
      if (!st.ramp) return;
      var rate = breakLoad() / G / 8;          // reaches the breaking load in about 8 s
      var m = st.m + rate * K.DT;
      if (m > M_MAX) { st.ramp = false; sim.pause(); transportUI.render(); K.flash(P.note, M_MAX + " kg is all the hanger takes"); return; }
      goTo(m, 1);
      mS.set(Math.round(st.m * 2) / 2); stack = decompose(st.m);
      update(false);
    });

    /* ---------- drawing ---------- */
    var scale = null;   // px per mm of stretch
    function nice(v) { var L = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02]; for (var i = 0; i < L.length; i++) if (L[i] <= v) return L[i]; return 0.01; }
    function pxPerMm() {
      if (!scale) scale = nice(110 / (extAt("sy") * 1000));
      var x = ext() * 1000;
      if (x * scale > 150) scale = nice(150 / x);
      return scale;
    }
    function lpx() { return 110 + 60 * LS.get(); }

    sim.on("under", function (ctx) {
      var s = pxPerMm(), u = sim.u(1);
      // ceiling
      ctx.fillStyle = th["ground-top"]; ctx.fillRect(120, TOP - 16, 560, 12);
      ctx.strokeStyle = th.muted; ctx.lineWidth = u;
      for (var hx = 124; hx < 680; hx += 14) { ctx.beginPath(); ctx.moveTo(hx, TOP - 16); ctx.lineTo(hx + 10, TOP - 26); ctx.stroke(); }
      var fall = st.fall ? st.fall.y : 0, bottom, rulerX, i0 = lpx();
      if (mode === "single") {
        var w = wires[0], yEnd = TOP + i0 + w.e * w.L * 1000 * s;
        drawWire(ctx, 300, TOP, yEnd, th.ten, w, 0);
        bottom = { x: 300, y: yEnd }; rulerX = 420;
      } else if (mode === "series") {
        var a = wires[0], b = wires[1], yA = TOP + i0 / 2 + a.e * a.L * 1000 * s, yB = yA + i0 / 2 + b.e * b.L * 1000 * s;
        drawWire(ctx, 300, TOP, yA, th.ten, a, 0);
        drawWire(ctx, 300, yA + (st.broken && st.broken.wire === 0 ? fall : 0), yB + (st.broken && st.broken.wire === 0 ? fall : 0), th.app, b, 1, true);
        ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(300, yA + (st.broken && st.broken.wire === 0 ? fall : 0), 5 * u, 0, Math.PI * 2); ctx.fill();
        K.label(ctx, "A", 286, TOP + 30, th.ten, { s: u }); K.label(ctx, "B", 286, yA + 30 + (st.broken && st.broken.wire === 0 ? fall : 0), th.app, { s: u });
        bottom = { x: 300, y: yB }; rulerX = 420;
      } else {
        var y = TOP + i0 + wires[0].e * wires[0].L * 1000 * s;
        drawWire(ctx, 200, TOP, y, th.ten, wires[0], 0);
        drawWire(ctx, 500, TOP, y, th.app, wires[1], 1);
        K.label(ctx, "A", 186, TOP + 30, th.ten, { s: u }); K.label(ctx, "B", 486, TOP + 30, th.app, { s: u });
        // the rigid bar, with the load hung where the torques balance
        var by = y + fall;
        ctx.fillStyle = th.body; ctx.fillRect(192, by, 316, 8 * u);
        var pos = loadPos();
        bottom = { x: 200 + 300 * pos, y: by + 8 * u };
        if (!st.broken) {
          K.label(ctx, "a = " + K.fmt(pos, 3) + " m", (200 + bottom.x) / 2, by - 4, th.muted, { s: u * 0.9 });
          ctx.strokeStyle = th.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(200, by - 2); ctx.lineTo(bottom.x, by - 2); ctx.stroke(); ctx.setLineDash([]);
        }
        rulerX = 580;
      }
      // the mm scale beside the wire, zero at the unstretched end
      var y0 = TOP + i0;
      drawRuler(ctx, rulerX, y0, s);
      if (!st.broken) {
        var yb = mode === "parallel" ? TOP + i0 + ext() * 1000 * s : bottom.y;
        ctx.strokeStyle = th.disp; ctx.lineWidth = 2 * u; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(mode === "parallel" ? 500 : 300, yb); ctx.lineTo(rulerX - 2, yb); ctx.stroke(); ctx.setLineDash([]);
        K.arrow(ctx, rulerX + 54, y0, rulerX + 54, yb, th.disp, { s: u, width: 2.5 });
        K.label(ctx, "ΔL = " + K.fmt(ext() * 1000, 3) + " mm", rulerX + 64, (y0 + yb) / 2 + 8, th.disp, { s: u, align: "left", bg: true });
      }
      drawHanger(ctx, bottom.x, bottom.y + (mode === "parallel" ? 0 : fall));
      drawShelf(ctx);
    });

    function drawWire(ctx, x, y0, y1, color, w, i, below) {
      var u = sim.u(1), broken = st.broken && st.broken.wire === i;
      var thick = 1.5 + w.r * 1000 * 4;
      ctx.strokeStyle = color; ctx.lineWidth = thick * u; ctx.lineCap = "round";
      if (broken) {
        var mid = y0 + (y1 - y0) * 0.55;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, mid); ctx.lineTo(x - 4, mid + 5); ctx.stroke();
        if (st.fall) {           // the lower piece goes with the falling load
          var f = st.fall.y;
          ctx.beginPath(); ctx.moveTo(x + 4, mid + 9 + f); ctx.lineTo(x, mid + 14 + f); ctx.lineTo(x, y1 + f); ctx.stroke();
          if (f < 30) K.label(ctx, "snap!", x + 14, mid + 6, th.bad, { s: u, align: "left" });
        }
      } else if (st.broken && !below && mode === "parallel") {
        // the unbroken partner relaxes to its unloaded length (plus any set)
        var set = w.emax > w.m.ey ? strainFor(w, 0) : 0;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + lpx() + set * w.L * 1000 * pxPerMm()); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      }
      ctx.lineCap = "butt";
    }
    function drawRuler(ctx, x, y0, s) {
      var u = sim.u(1), len = 165;
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.line; ctx.lineWidth = u;
      ctx.fillRect(x, y0 - 8, 46, len + 16); ctx.strokeRect(x, y0 - 8, 46, len + 16);
      var steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50], tick = 50;
      for (var i = 0; i < steps.length; i++) if (steps[i] * s >= 7) { tick = steps[i]; break; }
      var d = tick < 0.1 ? 2 : tick < 1 ? 1 : 0;
      ctx.strokeStyle = th.ink; ctx.fillStyle = th.muted; ctx.font = "600 " + 9 * u + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var n = 0; n * tick * s <= len + 1e-6; n++) {
        var y = y0 + n * tick * s, major = n % 5 === 0;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (major ? 14 : 7), y); ctx.stroke();
        if (major) ctx.fillText(K.fmt(n * tick, d), x + 44, y);
      }
      K.label(ctx, "mm", x + 23, y0 - 10, th.muted, { s: u * 0.9 });
      K.label(ctx, "stretch magnified", x + 23, y0 + len + 26, th.muted, { s: u * 0.8 });
    }
    function drawHanger(ctx, x, y) {
      var u = sim.u(1), sh = stack.reduce(function (a, d) { return a + discH(d) + 1; }, 0), rod = Math.max(26, sh + 12);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(x, y + 5, 5, Math.PI * 0.1, Math.PI * 1.9, true); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 10 + rod); ctx.stroke();
      ctx.fillStyle = th.body; ctx.fillRect(x - 30, y + 10 + rod, 60, 4);
      var yy = y + 10 + rod;
      stack.forEach(function (d) {
        var h = discH(d), w = discW(d);
        yy -= h + 1;
        ctx.fillStyle = th.grav; ctx.globalAlpha = 0.25 + Math.min(0.6, d / 60); ctx.fillRect(x - w / 2, yy, w, h); ctx.globalAlpha = 1;
        ctx.strokeStyle = th.grav; ctx.lineWidth = u; ctx.strokeRect(x - w / 2, yy, w, h);
      });
      st.hangerBox = { x0: x - 40, x1: x + 40, y0: y, y1: y + 14 + rod };
      if (!st.fall || st.fall.y < 20) {
        K.label(ctx, K.fmt(st.m, 1) + " kg", x - 44, y + 10 + rod, th.ink, { s: u, align: "right" });
        if (st.F > 0.05 && !st.broken) sim.force(ctx, x, y + 14 + rod, 0, -Math.min(st.F, 400), th.grav, "mg " + K.fmt(st.F, 1) + " N", 0.15, { lx: 8, ly: 4 });
      }
    }
    function drawShelf(ctx) {
      var u = sim.u(1);
      K.label(ctx, "slotted masses", 890, 150, th.muted, { s: u * 0.9 });
      K.label(ctx, "click to hang", 890, 164, th.muted, { s: u * 0.8 });
      SHELF.forEach(function (sl) {
        var h = discH(sl.d) * 1.6, w = discW(sl.d);
        ctx.fillStyle = K.alpha(th.grav, 0.3); ctx.fillRect(sl.x - w / 2, sl.y - h / 2, w, h);
        ctx.strokeStyle = th.grav; ctx.lineWidth = u; ctx.strokeRect(sl.x - w / 2, sl.y - h / 2, w, h);
        K.label(ctx, "+" + sl.d + " kg", sl.x, sl.y + h / 2 + 19, th.ink, { s: u * 0.9 });
      });
    }
    // where the load must hang on a 1 m bar, measured from wire A, so the bar stays level: F_A a = F_B (d − a)
    function loadPos() {
      if (mode !== "parallel" || st.F <= 0) return 0.5;
      var FA = wires[0].A * wires[0].s, FB = wires[1].A * wires[1].s;
      return FA + FB > 0 ? FB / (FA + FB) : 0.5;
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-ten">stress–strain</b> · P proportional limit, Y yield point, B breaking</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">load vs extension</b> · straight while Hooke\'s law holds, slope $k = YA/L$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">energy vs extension</b> · work done stretching; dashed is ½kΔL²</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gs = new K.Graph(cv[0], { yLabel: "σ (MPa)", xLabel: "strain (×10⁻³)", xMax: 10, yMin: 0, color: th.ten });
    var gf = new K.Graph(cv[1], { yLabel: "F (N)", xLabel: "ΔL (mm)", xMax: 1, xAuto: true, yMin: 0, color: th.grav });
    var gw = new K.Graph(cv[2], { yLabel: "U (J)", xLabel: "ΔL (mm)", xMax: 1, xAuto: true, yMin: 0, color: th.acc });
    var WCOL = function (i) { return i ? th.app : th.ten; };

    function theory() {
      gs.clear(); gf.clear(); gw.clear();
      var seen = {};
      gs.o.xMax = Math.max.apply(null, wires.map(function (w) { return w.m.eb * 1000; })) * 1.05;
      wires.forEach(function (w, i) {
        if (seen[w.key]) return; seen[w.key] = true;
        var pts = [];
        for (var n = 0; n <= 200; n++) { var e = w.m.eb * n / 200; pts.push([e * 1000, sigLoad(w.m, e) / 1e6]); }
        gs.set("curve" + i, { points: pts, color: WCOL(i), dash: [5, 5], width: 1.5 });
      });
      var xP = extAt("sp") * 1000, kk = kEff(), fp = [], wp = [];
      for (var q = 0; q <= 60; q++) { var x = xP * 1.3 * q / 60; fp.push([x, kk * x / 1000]); wp.push([x, 0.5 * kk * Math.pow(x / 1000, 2)]); }
      gf.o.xMax = gw.o.xMax = xP * 1.5;
      gf.set("hooke", { points: fp, color: th.grav, dash: [5, 5], width: 1.5 });
      gw.set("half", { points: wp, color: th.acc, dash: [5, 5], width: 1.5 });
      gs.extra = function (ctx, X, Y) {
        var done = {};
        wires.forEach(function (w, i) {
          if (!done[w.key]) {
            done[w.key] = true;
            [["P", w.m.ep, w.m.sp], ["Y", w.m.ey, w.m.sy], ["B", w.m.eb, w.m.sb]].forEach(function (mk) {
              ctx.fillStyle = WCOL(i); ctx.beginPath(); ctx.arc(X(mk[1] * 1000), Y(mk[2] / 1e6), 3.5, 0, Math.PI * 2); ctx.fill();
              ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
              ctx.fillText(mk[0], X(mk[1] * 1000) + 4, Y(mk[2] / 1e6) - 2);
            });
          }
          if (!st.broken) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(w.e * 1000), Y(w.s / 1e6), 6, 0, Math.PI * 2); ctx.stroke(); }
        });
      };
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      wires.forEach(function (w, i) { gs.set("path" + i, { points: path.ss[i], color: WCOL(i), width: 2.5, dot: !st.broken }); });
      gf.set("sim", { points: path.fx, color: th.grav, width: 2.5, dot: true });
      gw.set("sim", { points: path.wx, color: th.acc, width: 2.5, dot: true, fill: K.alpha(th.acc, 0.12) });
      [gs, gf, gw].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var LABELS = {
      single: ["Stress: force on each square metre", "Strain: stretch per metre of wire", "Young's modulus, while Hooke's law holds", "Elastic energy: area under F–ΔL"],
      series: ["Same force through both wires", "Each stretches by its own FL/AY", "In series the stretches add", "Energy splits like the stretch"],
      parallel: ["Each wire acts like a spring, k = YA/L", "Same stretch for both: the stiffnesses add", "Each wire's share of the load", "Hang the load where the torques balance"]
    };
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "F", label: "load F = mg", cls: "c-grav" }, { id: "s", label: "stress σ", cls: "c-ten" }, { id: "e", label: "strain ε" },
      { id: "dL", label: "extension ΔL", cls: "c-disp" }, { id: "U", label: "work done stretching", cls: "c-acc" },
      { id: "Fb", label: "breaking load", cls: "c-fric" }, { id: "set", label: "permanent set" }
    ]);
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function Bs(v, d) { return "(" + sci(v, d) + ")"; }
    function renderMaths() {
      LABELS[mode].forEach(function (l, i) { eqLabels[i].textContent = l; });
      var F = st.F, L = LS.get(), a = wires[0], hooke = elastic(), note = hooke ? "" : "\\quad\\text{(past the proportional limit: Hooke's law fails)}";
      if (mode === "single") {
        var dLf = F * L / (a.A * a.m.Y);
        K.tex(eqEls[0], "\\sigma = \\frac{F}{A} = \\frac{mg}{\\pi r^2} = \\frac{" + B(st.m) + B(G) + "}{\\pi" + Bs(a.r, 2) + "^2} = \\mathbf{" + sci(a.s, 2) + "}\\ \\text{Pa}");
        K.tex(eqEls[1], "\\varepsilon = \\frac{\\Delta L}{L} = \\frac{" + sci(a.e * L, 3) + "}{" + K.fmt(L, 1) + "} = \\mathbf{" + sci(a.e, 3) + "}");
        K.tex(eqEls[2], "\\Delta L = \\frac{FL}{AY} = \\frac{" + B(F) + B(L) + "}{" + Bs(a.A, 3) + Bs(a.m.Y, 1) + "} = \\mathbf{" + K.fmt(dLf * 1000, 3) + "}\\ \\text{mm}" + note);
        K.tex(eqEls[3], hooke
          ? "U = \\tfrac12 F\\Delta L = \\tfrac12" + B(F) + Bs(a.e * L, 3) + " = \\mathbf{" + K.fmt(0.5 * F * a.e * L, 4) + "}\\ \\text{J}"
          : "W = \\int F\\,d(\\Delta L) = \\mathbf{" + K.fmt(totalW(), 4) + "}\\ \\text{J}\\;\\ne\\;\\tfrac12F\\Delta L = " + K.fmt(0.5 * F * a.e * L, 4) + "\\ \\text{J}");
      } else if (mode === "series") {
        var b = wires[1], dA = F * L / (a.A * a.m.Y), dB = F * L / (b.A * b.m.Y);
        K.tex(eqEls[0], "\\sigma_A = \\frac{F}{A_A} = \\mathbf{" + sci(F / a.A, 2) + "}\\ \\text{Pa},\\quad \\sigma_B = \\frac{F}{A_B} = \\mathbf{" + sci(F / b.A, 2) + "}\\ \\text{Pa}");
        K.tex(eqEls[1], "\\Delta L_A = \\frac{FL}{A_AY_A} = \\mathbf{" + K.fmt(dA * 1000, 3) + "}\\ \\text{mm},\\quad \\Delta L_B = \\frac{FL}{A_BY_B} = \\mathbf{" + K.fmt(dB * 1000, 3) + "}\\ \\text{mm}");
        K.tex(eqEls[2], "\\Delta L = \\Delta L_A + \\Delta L_B = \\mathbf{" + K.fmt((dA + dB) * 1000, 3) + "}\\ \\text{mm},\\quad \\tfrac1k = \\tfrac1{k_A} + \\tfrac1{k_B}" + note);
        var ua = 0.5 * F * a.e * a.L, ub = 0.5 * F * b.e * b.L, base = Math.min(ua, ub) || 1;
        K.tex(eqEls[3], "U_A : U_B = \\tfrac12F\\Delta L_A : \\tfrac12F\\Delta L_B = " + K.fmt(ua, 4) + " : " + K.fmt(ub, 4) + " = \\mathbf{" + K.fmt(ua / base, 2) + " : " + K.fmt(ub / base, 2) + "}");
      } else {
        var c = wires[1], kA = k(a), kB = k(c), x = F / (kA + kB);
        K.tex(eqEls[0], "k_A = \\frac{Y_AA_A}{L} = \\mathbf{" + sci(kA, 3) + "}\\ \\text{N/m},\\quad k_B = \\mathbf{" + sci(kB, 3) + "}\\ \\text{N/m}");
        K.tex(eqEls[1], "\\Delta L = \\frac{F}{k_A + k_B} = \\frac{" + B(F) + "}{" + sci(kA + kB, 3) + "} = \\mathbf{" + K.fmt(x * 1000, 3) + "}\\ \\text{mm}" + note);
        K.tex(eqEls[2], "F_A = k_A\\Delta L = \\mathbf{" + K.fmt(kA * x, 1) + "}\\ \\text{N},\\quad F_B = k_B\\Delta L = \\mathbf{" + K.fmt(kB * x, 1) + "}\\ \\text{N}");
        K.tex(eqEls[3], "F_A\\,a = F_B(d - a) \\Rightarrow a = \\frac{F_B}{F}d = \\frac{k_B}{k_A + k_B}(1\\ \\text{m}) = \\mathbf{" + K.fmt(kB / (kA + kB), 3) + "}\\ \\text{m from A}");
      }
      var dL = ext(), dLform = F / kEff();
      setR("F", K.fmt(F, 1) + " N", K.fmt(st.m, 1) + " kg × 9.8");
      setR("s", wires.map(function (w) { return sciTxt(w.s, 2); }).join(" / ") + " Pa", wires.length > 1 ? "A / B" : "F / A");
      setR("e", wires.map(function (w) { return sciTxt(w.e, 3); }).join(" / "), wires.length > 1 ? "A / B" : "ΔL / L");
      setR("dL", st.broken ? "snapped" : K.fmt(dL * 1000, 3) + " mm", hooke ? "formula F/k = " + K.fmt(dLform * 1000, 3) + " mm" : "past P: formula would say " + K.fmt(dLform * 1000, 3));
      setR("U", K.fmt(totalW(), 4) + " J", hooke ? "½FΔL = " + K.fmt(0.5 * F * dL, 4) + " J" : "beyond P, not ½FΔL");
      setR("Fb", K.fmt(breakLoad(), 1) + " N", "= " + K.fmt(breakLoad() / G, 1) + " kg · set by A, not L");
      var set = wires.map(function (w) { return w.emax > w.m.ey ? strainFor(w, 0) * w.L : 0; });
      setR("set", K.fmt(set.reduce(function (s, v) { return s + v; }, 0) * 1000, 3) + " mm", set.some(function (v) { return v > 0; }) ? "went past yield" : "springs right back");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Hang a load $F$ on a wire of cross-section $A$. The <b class=\"c-ten\">stress</b> $\\sigma = F/A$ is the force on each square metre; the <b class=\"c-disp\">strain</b> $\\varepsilon = \\Delta L/L$ is the stretch per metre. Up to the <b>proportional limit</b> they're proportional, and the ratio is the material's <b>Young's modulus</b>: $Y = \\sigma/\\varepsilon$, so $\\Delta L = \\dfrac{FL}{AY}$.</p>" +
      "<p>Up to the <b>yield point</b> the wire springs back. Past it, it flows: unload and it keeps a <b>permanent set</b>. Keep loading and it snaps at the <b>breaking stress</b>, so the breaking load is $\\sigma_b A$, whatever the length.</p>" +
      "<p>A wire is a stiff spring with $k = YA/L$, so the energy it stores is the triangle under the F–ΔL line: <b class=\"c-acc\">$U = \\tfrac12 F\\Delta L$</b> $= \\tfrac12\\,\\text{stress}\\times\\text{strain}\\times\\text{volume}$. Wires in series add stretches; side by side they add stiffness.</p>" +
      '<div class="trap"><b>JEE trap: Y belongs to the material, not the wire.</b> Halve the radius and the same load stretches the wire 4× more, but $Y$ is unchanged; it\'s $k = YA/L$ that changes. And the energy is $\\tfrac12F\\Delta L$, not $F\\Delta L$: the load did $F\\Delta L$ of work going down, and half of it was lost as heat and swinging.</div>');
    function apply(s) {
      mode = s.mode; setSeg(modeSeg, mode); wireB.hidden = mode === "single";
      matA = s.matA; setSeg(segA, matA); rAS.set(s.rA);
      if (s.matB) { matB = s.matB; setSeg(segB, matB); }
      if (s.rB) rBS.set(s.rB);
      LS.set(s.L); mS.set(s.m);
      rebuild();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "ΔL = FL/AY", setup: { mode: "single", matA: "steel", rA: 0.5, L: 2, m: 10 }, watch: "Predict ΔL, then read the scale",
        q: "A steel wire ($Y = 2.0 \\times 10^{11}$ Pa) is 2 m long with a <i>diameter</i> of 1 mm. How much does it stretch under a 10 kg load ($g = 9.8$)?",
        options: ["0.31 mm", "0.62 mm", "1.25 mm", "2.50 mm"], answer: 2,
        explain: "The radius is 0.5 mm, so $A = \\pi(5 \\times 10^{-4})^2 = 7.85 \\times 10^{-7}$ m². Then $\\Delta L = \\dfrac{FL}{AY} = \\dfrac{98 \\times 2}{7.85 \\times 10^{-7} \\times 2 \\times 10^{11}} = 1.25$ mm. Using the diameter as the radius gives 0.31 mm." },
      { level: "medium", tag: "wires in series", setup: { mode: "series", matA: "steel", matB: "steel", rA: 0.4, rB: 0.8, L: 1, m: 5 }, watch: "Predict the ratio, then read the energy equation",
        q: "Two steel wires of equal length are joined end to end. Wire A has radius 0.4 mm and wire B has radius 0.8 mm. A 5 kg load hangs from the bottom. What is the ratio of elastic energy stored, $U_A : U_B$?",
        options: ["1 : 4", "1 : 2", "2 : 1", "4 : 1"], answer: 3,
        hints: ["In series both wires carry the same force $F$.", "$U = \\tfrac12 F\\Delta L$ and $\\Delta L = FL/(AY) \\propto 1/r^2$."],
        explain: "Same $F$ in both, and $\\Delta L \\propto 1/A \\propto 1/r^2$, so the thin wire stretches $(0.8/0.4)^2 = 4$ times as much. With the same $F$, $U = \\tfrac12F\\Delta L$ follows the stretch: $U_A : U_B = 4 : 1$. The thinner wire stores more." },
      { level: "hard", tag: "rigid bar on two wires", setup: { mode: "parallel", matA: "steel", matB: "copper", rA: 0.5, rB: 0.5, L: 1, m: 20 }, watch: "Predict a and ΔL, then compare with the bar on the stage",
        q: "A light rigid bar 1 m long hangs level from a steel wire at one end and a copper wire at the other. Both are 1 m long with radius 0.5 mm ($Y_{steel} = 2.0 \\times 10^{11}$ Pa, $Y_{Cu} = 1.1 \\times 10^{11}$ Pa). Where must a 20 kg load hang so the bar stays level, and how far do the wires stretch ($g = 9.8$)?",
        options: ["0.355 m from the steel wire; 0.805 mm", "0.645 m from the steel wire; 0.805 mm", "0.5 m (the middle); 0.805 mm", "0.355 m from the steel wire; 1.61 mm"], answer: 0,
        hints: ["Level bar means equal extensions, so each wire's tension is $F_i = k_i\\Delta L$ with $k = YA/L$. The stiffer steel wire carries more.", "Take torques about the load: $F_s\\,a = F_{Cu}(1 - a)$, so $a = \\dfrac{Y_{Cu}}{Y_s + Y_{Cu}}$ m."],
        explain: "Equal $A$ and $L$ give $F_s : F_{Cu} = Y_s : Y_{Cu} = 2 : 1.1$. Torques about the load: $a = \\dfrac{1.1}{3.1} = 0.355$ m from the steel end. The stiffnesses add: $\\Delta L = \\dfrac{FL}{A(Y_s + Y_{Cu})} = \\dfrac{196}{7.85 \\times 10^{-7} \\times 3.1 \\times 10^{11}} = 0.805$ mm. 1.61 mm comes from forgetting the copper wire shares the load." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Load it up", onReset: rebuild,
      onPlay: function () { if (st.broken) { mS.set(0); rebuild(); } if (!st.fall) st.ramp = true; } });
    rebuild();

    if (location.hostname === "localhost") {
      window.__lab_elasticity = {
        apply: apply, setLoad: userLoad, wires: function () { return wires; }, st: function () { return st; },
        ext: ext, kEff: kEff, work: totalW, breakLoad: breakLoad, loadPos: loadPos, tries: function () { return tries.count(); },
        clickShelf: function (d) { var s = SHELF.filter(function (q) { return q.d === d; })[0]; return clickAt(s.x, s.y); },
        clickHanger: function () { sim.draw(); var b = st.hangerBox; return clickAt((b.x0 + b.x1) / 2, b.y1 - 4); }
      };
    }
    // a real pointer event at stage px (x, y), for tests
    function clickAt(x, y) {
      var r = P.canvas.getBoundingClientRect(), o = { clientX: r.left + x * sim.scale, clientY: r.top + y * sim.scale, pointerId: 1, bubbles: true };
      P.canvas.dispatchEvent(new PointerEvent("pointerdown", o));
      P.canvas.dispatchEvent(new PointerEvent("pointerup", o));
    }

    return function destroy() { sim.destroy(); [gs, gf, gw].forEach(function (g) { g.destroy(); }); if (window.__lab_elasticity) delete window.__lab_elasticity; };
  }
})();
