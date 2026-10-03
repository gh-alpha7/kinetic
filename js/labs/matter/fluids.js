/* Properties of matter, lab 2: pressure in a liquid, buoyancy and floating, and Pascal's hydraulic lift. */
(function () {
  "use strict";
  var G = 9.8, P0 = 1.013e5, PPM = 250;      // 250 px per metre on the stage
  var LIQS = { oil: { label: "Oil", rho: 800 }, water: { label: "Water", rho: 1000 }, glyc: { label: "Glycerine", rho: 1260 }, hg: { label: "Mercury", rho: 13600 } };
  var BLOCKS = [{ label: "Cork", rho: 240 }, { label: "Wood", rho: 600 }, { label: "Ice", rho: 917 }, { label: "Aluminium", rho: 2700 }, { label: "Iron", rho: 7870 }];
  var A_SIDE = 0.2;                            // the block is a 20 cm cube

  var lab = {
    id: "fluids", chapter: "matter", title: "Pressure & buoyancy", short: "p = p₀ + ρgh, Archimedes, Pascal",
    lede: "Drag a pressure gauge around oddly shaped vessels, lower blocks on a spring balance, cut the string and see what floats, then lift a car with one hand.",
    tries: [
      { id: "shape", title: "Same depth, different vessel",
        text: "Read the pressure at one depth in the wide tank, then at the same depth in the thin tube or the funnel.",
        why: "Pressure depends only on depth: $p = p_0 + \\rho g h$. The extra water in the wide tank or the funnel is held up by the walls, not by the liquid below." },
      { id: "float", title: "Float the same block in two liquids",
        text: "Cut the string on a block that floats, then change the liquid and do it again.",
        why: "Floating means buoyancy = weight, so $\\rho_f V_{sub} g = \\rho_b V g$ and the fraction under is $\\rho_b/\\rho_f$. A denser liquid needs less volume under to give the same push, so it floats higher." },
      { id: "archimedes", title: "Weigh a sinking block under the liquid",
        text: "Lower a block that sinks until it is completely under, without touching the bottom. Watch the spring balance.",
        why: "The balance reads less by exactly the weight of the liquid pushed aside: $T = W - \\rho_f V g$. That's Archimedes' principle, and it's how you measure density by weighing." },
      { id: "pascal", title: "Lift a car with under 200 N",
        text: "In the hydraulic lift, raise a load of 1000 kg or more by at least 5 mm, pushing with less than 200 N.",
        why: "Pascal: pressure is passed on equally, so $F_1/A_1 = Mg/A_2$. The price is distance: the small piston must travel $A_2/A_1$ times further, so the work $F_1 d_1 = Mg\\,d_2$ is the same." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: PPM, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "probe", liq = "water";
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Pressure probe", value: "probe" }, { label: "Float or sink", value: "float" }, { label: "Hydraulic lift", value: "lift" }], mode,
      function (v) { setMode(v); }, "Experiment");
    P.controls.appendChild(modeSeg);
    var liqBox = K.h("<div><h3>Liquid</h3></div>");
    var liqSeg = K.seg(Object.keys(LIQS).map(function (k) { return { label: LIQS[k].label + " " + LIQS[k].rho, value: k }; }), liq,
      function (v) { liq = v; reset(); }, "Liquid");
    liqBox.appendChild(liqSeg);
    liqBox.appendChild(K.h('<p class="control-hint">' + K.md("Densities in kg/m³. $p_0 = 1.013 \\times 10^5$ Pa above the surface.") + "</p>"));
    P.controls.appendChild(liqBox);

    var blockBox = K.h("<div><h3>The block (a 20 cm cube)</h3></div>");
    var rbS = K.slider({ label: "Block density $\\rho_b$", unit: "kg/m³", min: 100, max: 12000, step: 10, value: 600, onInput: reset });
    blockBox.appendChild(rbS.el);
    var presets = K.h('<div class="row"></div>');
    BLOCKS.forEach(function (b) {
      var btn = K.h('<button class="btn btn-sm" type="button">' + b.label + "</button>");
      btn.addEventListener("click", function () { rbS.set(b.rho); reset(); });
      presets.appendChild(btn);
    });
    blockBox.appendChild(presets);
    blockBox.appendChild(K.h('<p class="control-hint">Drag the block up and down on its spring balance. Press <b>Cut the string</b> to let it go.</p>'));
    P.controls.appendChild(blockBox);

    var liftBox = K.h("<div><h3>The lift</h3></div>");
    var r1S = K.slider({ label: "Small piston radius $r$", unit: "cm", min: 1, max: 5, step: 0.5, value: 2, onInput: reset });
    var r2S = K.slider({ label: "Big piston radius $R$", unit: "cm", min: 5, max: 30, step: 1, value: 20, onInput: reset });
    var MS = K.slider({ label: "Load $M$", unit: "kg", min: 100, max: 2000, step: 50, value: 1500, onInput: reset });
    [r1S, r2S, MS].forEach(function (s) { liftBox.appendChild(s.el); });
    liftBox.appendChild(K.h('<p class="control-hint">Drag the small piston\'s handle down, or press <b>Push</b>.</p>'));
    P.controls.appendChild(liftBox);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>buoyancy</span><span class="c-ten"><i></i>spring balance</span>' +
      '<span class="c-app"><i></i>your push</span><span class="c-disp"><i></i>depth</span></div>'));
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function rhoF() { return LIQS[liq].rho; }

    /* ---------- probe mode: three vessels joined at the bottom ---------- */
    var PS = 150, PB = 450, PCH = 490, VTOP = 100;        // surface, vessel bottoms, channel bottom, wall tops (px)
    function funnel(y) { var f = (PB - y) / (PB - VTOP); return { l: 600 - 80 * f, r: 660 + 240 * f }; }
    function vesselAt(x, y) {
      if (y < PS || y > PCH) return 0;
      if (y > PB) return x >= 70 && x <= 660 ? 4 : 0;            // the channel underneath
      if (x >= 70 && x <= 330) return 1;
      if (x >= 440 && x <= 480) return 2;
      var f = funnel(y);
      return x >= f.l && x <= f.r ? 3 : 0;
    }
    var VNAMES = { 1: "wide tank", 2: "thin tube", 3: "funnel", 4: "channel underneath" };
    var probe, readings, lowering;
    function depthOf(y) { return (y - PS) / PPM; }
    function pressureAt(x, y) { return vesselAt(x, y) ? P0 + rhoF() * G * depthOf(y) : y < PS ? P0 : null; }
    function moveProbe(x, y, rec) {
      x = K.clamp(x, 20, W - 20); y = K.clamp(y, 20, PCH - 4);
      if (y >= PS && !vesselAt(x, y)) return false;           // that's inside a wall
      probe.x = x; probe.y = y;
      if (rec && vesselAt(x, y)) {
        readings.push({ x: x, h: depthOf(y), p: pressureAt(x, y), v: vesselAt(x, y) });
        if (readings.length > 400) readings.shift();
        var last = readings[readings.length - 1];
        if (last.h > 0.05 && readings.some(function (r) { return r.v !== last.v && r.v !== 4 && last.v !== 4 && Math.abs(r.h - last.h) < 0.01; })) tries.mark("shape");
      }
      return true;
    }

    /* ---------- float mode: a block on a spring balance over a tank ---------- */
    var FS = 220, FD = 1.0, FB = FS + FD * PPM, FX = 450, AP = A_SIDE * PPM;   // surface px, liquid depth, bottom px, block x, block size px
    var blk, results = [];
    function weight() { return rbS.get() * Math.pow(A_SIDE, 3) * G; }
    function subDepth(z) { return K.clamp(z, 0, A_SIDE); }
    function buoy(z) { return rhoF() * G * A_SIDE * A_SIDE * subDepth(z); }
    function zFloat() { return A_SIDE * rbS.get() / rhoF(); }       // where it would float, if that's less than a
    // held on the string at hook depth zh: the string goes slack if the block would rather float higher
    function holdAt(zh) {
      zh = K.clamp(zh, -0.25, FD);
      blk.zh = zh;
      var z = zh;
      if (rbS.get() < rhoF() && zh > zFloat()) z = zFloat();
      blk.z = z; blk.v = 0;
      blk.T = Math.max(0, weight() - buoy(z));
      if (z >= 0) { blk.drag.push([subDepth(z) * 100, blk.T]); if (blk.drag.length > 600) blk.drag.shift(); }
      if (rbS.get() > rhoF() && z >= A_SIDE - 1e-9 && z < FD - 1e-9) tries.mark("archimedes");
    }
    function stepFree(dt) {
      var m = rbS.get() * Math.pow(A_SIDE, 3), kk = rhoF() * G * A_SIDE * A_SIDE;
      var c = 2 * 0.25 * Math.sqrt(kk * m), n = 20, h = dt / n;
      for (var i = 0; i < n; i++) {
        var d = subDepth(blk.z), a = G - buoy(blk.z) / m - (d > 0 ? c * blk.v / m : 0);
        blk.v += a * h; blk.z += blk.v * h;
        if (blk.z >= FD) { blk.z = FD; if (blk.v > 0) blk.v = 0; }
      }
      blk.T = 0;
      blk.N = blk.z >= FD - 1e-9 ? Math.max(0, weight() - buoy(blk.z)) : 0;
    }

    /* ---------- lift mode ---------- */
    var lift;
    function A1() { return Math.PI * Math.pow(r1S.get() / 100, 2); }
    function A2() { return Math.PI * Math.pow(r2S.get() / 100, 2); }
    function F1() { return MS.get() * G * A1() / A2(); }
    function pushTo(d1) {
      d1 = K.clamp(d1, 0, 1);
      lift.Win += F1() * (d1 - lift.d1);
      lift.d1 = d1; lift.d2 = d1 * A1() / A2();
      lift.rec.push([d1, lift.d2 * 100, lift.Win]);
      if (MS.get() >= 1000 && F1() <= 200 && lift.d2 >= 0.005) tries.mark("pascal");
    }

    /* ---------- reset + modes ---------- */
    var running = null;
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      P.time.textContent = "t = 0.00 s";
      lowering = false; running = null;
      if (mode === "probe") {
        probe = probe || { x: 200, y: 300 };
        readings = [];
        if (!moveProbe(probe.x, probe.y, true)) moveProbe(200, 300, true);
      } else if (mode === "float") {
        blk = { zh: -0.15, z: -0.15, v: 0, T: 0, N: 0, free: false, rec: [], drag: [], still: 0, settled: false };
        holdAt(-0.15);
      } else {
        lift = { d1: 0, d2: 0, Win: 0, rec: [[0, 0, 0]] };
      }
      theory(); update(true);
    }
    function setMode(v) {
      mode = v; setSeg(modeSeg, v);
      liqBox.hidden = v === "lift"; blockBox.hidden = v !== "float"; liftBox.hidden = v !== "lift";
      transportUI.setLabel({ probe: "Lower the probe", float: "Cut the string", lift: "Push" }[v]);
      buildPanels();
      reset();
    }

    sim.on("step", function (t) {
      if (mode === "probe" && lowering) {
        var y = probe.y + 0.12 * PPM * K.DT;                    // 12 cm every second
        if (!moveProbe(probe.x, y, true) || y >= PCH - 4) { lowering = false; sim.pause(); transportUI.render(); K.flash(P.note, "The probe reached the bottom"); }
      } else if (mode === "float" && blk.free) {
        stepFree(K.DT);
        blk.rec.push([t, blk.z * 100]);
        var settledNow = Math.abs(blk.v) < 2e-5 && (blk.z >= FD - 1e-9 || Math.abs(weight() - buoy(blk.z)) < 1e-3 * weight());
        blk.still = settledNow ? blk.still + K.DT : 0;
        if (blk.still > 0.5 && !blk.settled) settle();
        if (t > 30) { sim.pause(); transportUI.render(); }
      } else if (mode === "lift") {
        pushTo(lift.d1 + 0.2 * K.DT);                            // 20 cm every second
        if (lift.d1 >= 1) { sim.pause(); transportUI.render(); K.flash(P.note, "End of the stroke: the load rose " + K.fmt(lift.d2 * 100, 2) + " cm"); }
      }
      update(false);
    });
    function settle() {
      blk.settled = true; sim.pause(); transportUI.render();
      var floats = rbS.get() < rhoF();
      var frac = subDepth(blk.z) / A_SIDE;
      results.push({ rb: rbS.get(), rf: rhoF(), frac: frac, floats: floats });
      if (results.length > 60) results.shift();
      K.flash(P.note, floats ? "It floats with " + K.fmt(frac * 100, 1) + " % under: ρ_b/ρ_f = " + K.fmt(rbS.get() / rhoF(), 3)
        : "It sinks: the bottom holds up the last " + K.fmt(blk.N, 1) + " N", 4000);
      if (floats && results.some(function (r) { return r.floats && r.rb === rbS.get() && r.rf !== rhoF(); })) tries.mark("float");
      update(true);
    }

    /* ---------- dragging ---------- */
    var dragging = null;
    sim.pointer({
      down: function (pt) {
        var x = pt.px, y = pt.py;
        if (mode === "probe") {
          if (Math.hypot(x - probe.x, y - probe.y) > 26) { if (!moveProbe(x, y, true)) return false; update(true); }
          lowering = false; dragging = "probe"; return true;
        }
        if (mode === "float") {
          if (blk.free) return false;
          var top = blockTop();
          if (Math.abs(x - FX) < AP / 2 + 20 && y > top - 110 && y < top + AP + 10) { dragging = { off: y - top }; return true; }
          return false;
        }
        var py = 140 + lift.d1 * PPM;
        if (Math.abs(x - 220) < 50 && y > py - 70 && y < py + 20) { dragging = { off: y - py }; return true; }
        return false;
      },
      drag: function (pt) {
        if (!dragging) return;
        if (mode === "probe") moveProbe(pt.px, pt.py, true);
        else if (mode === "float") holdAt((pt.py - dragging.off + AP - FS) / PPM);
        else pushTo((pt.py - dragging.off - 140) / PPM);
        update(false);
      },
      up: function () { dragging = null; update(true); }
    });

    /* ---------- drawing ---------- */
    function liquidColor(a) { return liq === "hg" ? K.alpha("#9aa3ad", a) : liq === "oil" ? K.alpha("#d9a520", a * 0.8) : liq === "glyc" ? K.alpha("#7fb6d9", a) : K.alpha("#4a90d9", a); }
    function blockTop() { return FS + blk.z * PPM - AP; }
    sim.on("under", function (ctx) {
      var u = sim.u(1);
      if (mode === "probe") drawProbeStage(ctx, u);
      else if (mode === "float") drawFloatStage(ctx, u);
      else drawLiftStage(ctx, u);
    });
    function drawProbeStage(ctx, u) {
      // liquid: fill every point below the surface that is inside a vessel
      ctx.fillStyle = liquidColor(0.35);
      ctx.fillRect(70, PS, 260, PB - PS); ctx.fillRect(440, PS, 40, PB - PS); ctx.fillRect(70, PB, 590, PCH - PB);
      var f0 = funnel(PS);
      ctx.beginPath(); ctx.moveTo(f0.l, PS); ctx.lineTo(f0.r, PS); ctx.lineTo(660, PB); ctx.lineTo(600, PB); ctx.closePath(); ctx.fill();
      // walls
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3 * u; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(70, VTOP); ctx.lineTo(70, PCH); ctx.lineTo(660, PCH); ctx.lineTo(660, PB); ctx.lineTo(900, VTOP);
      ctx.moveTo(330, VTOP); ctx.lineTo(330, PB); ctx.lineTo(440, PB); ctx.lineTo(440, VTOP);
      ctx.moveTo(480, VTOP); ctx.lineTo(480, PB); ctx.lineTo(600, PB); ctx.lineTo(520, VTOP);
      ctx.stroke();
      // surface line and depth marks
      ctx.strokeStyle = liquidColor(0.9); ctx.lineWidth = 2 * u;
      [[70, 330], [440, 480], [f0.l, f0.r]].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s[0], PS); ctx.lineTo(s[1], PS); ctx.stroke(); });
      K.label(ctx, "same level everywhere", 200, PS - 6, th.muted, { s: u * 0.9 });
      ctx.fillStyle = th.muted; ctx.font = "600 " + 10 * u + "px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var d = 0; d <= 1.2 + 1e-9; d += 0.2) { var yy = PS + d * PPM; ctx.fillText(K.fmt(d, 1) + " m", 62, yy); ctx.fillRect(64, yy, 6, 1); }
      // level line through the probe
      if (probe.y > PS) {
        ctx.strokeStyle = K.alpha(th.disp, 0.5); ctx.setLineDash([5, 5]); ctx.lineWidth = u;
        ctx.beginPath(); ctx.moveTo(70, probe.y); ctx.lineTo(900, probe.y); ctx.stroke(); ctx.setLineDash([]);
        K.arrow(ctx, probe.x - 20, PS, probe.x - 20, probe.y, th.disp, { s: u, width: 2, label: "h = " + K.fmt(depthOf(probe.y), 3) + " m", lx: -112, ly: -14 });
      }
      // past readings
      readings.forEach(function (r) { ctx.fillStyle = K.alpha(th.disp, 0.35); ctx.beginPath(); ctx.arc(r.x, PS + r.h * PPM, 2.5, 0, Math.PI * 2); ctx.fill(); });
      // the probe: a gauge on a stalk
      var p = pressureAt(probe.x, probe.y);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(probe.x, probe.y); ctx.lineTo(probe.x, Math.min(probe.y, PS) - 40); ctx.stroke();
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(probe.x, probe.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(probe.x, probe.y, 4, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "p = " + K.fmt(p / 1000, 2) + " kPa", probe.x + 16, probe.y + 26, th.ink, { s: u, bg: true, align: "left" });
      [[200, "wide tank"], [460, "thin tube"], [760, "funnel"]].forEach(function (q) { K.label(ctx, q[1], q[0], VTOP - 8, th.muted, { s: u * 0.9 }); });
    }
    function drawFloatStage(ctx, u) {
      ctx.fillStyle = liquidColor(0.35); ctx.fillRect(150, FS, 600, FB - FS);
      ctx.strokeStyle = liquidColor(0.9); ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(150, FS); ctx.lineTo(750, FS); ctx.stroke();
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(150, 150); ctx.lineTo(150, FB); ctx.lineTo(750, FB); ctx.lineTo(750, 150); ctx.stroke();
      K.label(ctx, LIQS[liq].label + " · ρ_f = " + rhoF() + " kg/m³", 160, FB - 6, th.muted, { s: u * 0.9, align: "left" });
      // equilibrium marker for a floater
      if (rbS.get() < rhoF()) {
        var ye = FS + zFloat() * PPM;
        ctx.strokeStyle = K.alpha(th.normal, 0.6); ctx.setLineDash([4, 4]); ctx.lineWidth = u;
        ctx.beginPath(); ctx.moveTo(FX + AP / 2 + 60, ye); ctx.lineTo(FX + AP / 2 + 110, ye); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "floats here", FX + AP / 2 + 114, ye + 6, th.normal, { s: u * 0.85, align: "left" });
      }
      var top = blockTop(), x0 = FX - AP / 2;
      // crane, rope, spring balance (only while held)
      if (!blk.free) {
        var bt = top - 104, bb = top - 16;
        ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(FX, 0); ctx.lineTo(FX, bt); ctx.stroke();
        ctx.fillStyle = th.surface; ctx.fillRect(FX - 20, bt, 40, bb - bt - 10); ctx.strokeRect(FX - 20, bt, 40, bb - bt - 10);
        var full = Math.max(250, Math.ceil(weight() / 50) * 50), yT = bt + 8 + (bb - bt - 26) * Math.min(1, blk.T / full);
        ctx.fillStyle = th.muted; for (var q = 0; q <= 5; q++) ctx.fillRect(FX - 14, bt + 8 + (bb - bt - 26) * q / 5, 10, 1);
        ctx.fillStyle = th.ten; ctx.fillRect(FX - 18, yT - 2, 36, 4);
        ctx.beginPath(); ctx.moveTo(FX, bb - 10); ctx.lineTo(FX, top); ctx.stroke();
        K.label(ctx, "T = " + K.fmt(blk.T, 1) + " N", FX + 26, bt + 22, th.ten, { s: u, align: "left", bg: true });
        if (blk.T < 1e-9 && blk.zh > blk.z + 1e-6) K.label(ctx, "string slack", FX + 26, bt + 44, th.muted, { s: u * 0.85, align: "left" });
      }
      ctx.fillStyle = blockFill(); ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * u;
      ctx.fillRect(x0, top, AP, AP); ctx.strokeRect(x0, top, AP, AP);
      K.label(ctx, K.fmt(rbS.get(), 0), FX, top + AP / 2 + 2, th.ink, { s: u * 0.85 });
      K.label(ctx, "kg/m³", FX, top + AP / 2 + 15, th.muted, { s: u * 0.75 });
    }
    function blockFill() { var r = rbS.get(); return r < 1000 ? "#c9a46a" : r < 3000 ? "#b9c2cc" : "#6b7280"; }
    function drawLiftStage(ctx, u) {
      var w1 = 10 + r1S.get() * 4, w2 = 30 + r2S.get() * 5, y1 = 140 + lift.d1 * PPM, y2 = 330 - lift.d2 * PPM;
      ctx.fillStyle = K.alpha("#d9a520", 0.3);
      ctx.fillRect(220 - w1, y1, 2 * w1, 440 - y1); ctx.fillRect(640 - w2, y2, 2 * w2, 440 - y2); ctx.fillRect(220 - w1, 440, 420 + w1 + w2, 30);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(220 - w1, 110); ctx.lineTo(220 - w1, 470); ctx.lineTo(640 + w2, 470); ctx.lineTo(640 + w2, 150);
      ctx.moveTo(220 + w1, 110); ctx.lineTo(220 + w1, 440); ctx.lineTo(640 - w2, 440); ctx.lineTo(640 - w2, 150);
      ctx.stroke();
      // pistons
      ctx.fillStyle = th.body;
      ctx.fillRect(220 - w1 + 2, y1 - 10, 2 * w1 - 4, 10); ctx.fillRect(640 - w2 + 2, y2 - 12, 2 * w2 - 4, 12);
      ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(220, y1 - 10); ctx.lineTo(220, y1 - 50); ctx.stroke();
      ctx.fillRect(196, y1 - 58, 48, 10);                                          // handle
      sim.force(ctx, 220, y1 - 62, 0, -F1(), th.app, "F₁ = " + K.fmt(F1(), 1) + " N", Math.min(0.4, 60 / F1()), { lx: 26 });
      // load
      var bw = 40 + Math.sqrt(MS.get()) * 2.4, bh = 30 + Math.sqrt(MS.get()) * 1.2;
      ctx.fillStyle = th["surface-2"]; ctx.lineWidth = 2 * u; ctx.fillRect(640 - bw / 2, y2 - 12 - bh, bw, bh); ctx.strokeRect(640 - bw / 2, y2 - 12 - bh, bw, bh);
      K.label(ctx, MS.get() + " kg", 640, y2 - 12 - bh / 2 + 6, th.ink, { s: u });
      sim.force(ctx, 640 - bw / 2 - 14, y2 - 12 - bh / 2, 0, -MS.get() * G, th.grav, "Mg = " + K.fmt(MS.get() * G, 0) + " N", 60 / (MS.get() * G), { lx: -120, ly: 8 });
      // magnified rise gauge beside the big piston
      var gx = 640 + w2 + 40, mag = lift.d2 > 0 && A2() / A1() > 20 ? 20 : 1;
      ctx.strokeStyle = th.muted; ctx.lineWidth = u; ctx.strokeRect(gx, 130, 16, 200);
      ctx.fillStyle = th.disp; var hpx = Math.min(200, lift.d2 * PPM * mag); ctx.fillRect(gx + 2, 330 - hpx, 12, hpx);
      K.label(ctx, "rise " + K.fmt(lift.d2 * 100, 2) + " cm", gx + 8, 124, th.disp, { s: u * 0.9 });
      if (mag > 1) K.label(ctx, "(×" + mag + ")", gx + 8, 350, th.muted, { s: u * 0.8 });
      K.label(ctx, "push " + K.fmt(lift.d1 * 100, 1) + " cm", 220, 500, th.app, { s: u * 0.9 });
      K.label(ctx, "p = " + K.fmt(MS.get() * G / A2() / 1000, 1) + " kPa everywhere at this level", 430, 462, th.muted, { s: u * 0.85 });
    }
    sim.on("over", function (ctx) {
      if (mode !== "float") return;
      var u = sim.u(1), top = blockTop(), c = top + AP / 2, kpn = 60 / Math.max(weight(), 50);
      sim.force(ctx, FX - AP / 2 - 10, c, 0, -weight(), th.grav, "W " + K.fmt(weight(), 1) + " N", kpn, { lx: -100, ly: 10 });
      var Bf = buoy(blk.z);
      if (Bf > 0.05) sim.force(ctx, FX + AP / 2 + 10, c, 0, Bf, th.normal, "B " + K.fmt(Bf, 1) + " N", kpn, { lx: 8 });
      if (blk.N > 0.05) sim.force(ctx, FX - 30, top + AP, 0, blk.N, th.normal, "N", kpn, { lx: -24 });
      void u;
    });

    /* ---------- graphs ---------- */
    var CAPS = {
      probe: ['<b class="c-disp">gauge pressure vs depth</b> · a straight line of slope $\\rho g$; dots are your readings', '<b class="c-disp">gauge pressure along your level</b> · flat: every vessel agrees', '<b class="c-disp">gauge pressure vs depth</b> · your liquid against the other three'],
      float: ['<b class="c-normal">fraction under vs ρ_b/ρ_f</b> · dots are your drops', '<b class="c-ten">balance reading vs depth under</b> · falls by ρ_f g A per metre', '<b class="c-disp">depth of the block\'s base vs t</b> · after you cut the string'],
      lift: ['<b class="c-disp">load rise vs push</b> · $d_2 = d_1 A_1/A_2$', '<b class="c-acc">work in vs push</b> · equals the work out, $Mg\\,d_2$', '<b class="c-app">force needed vs R/r</b> · falls as $1/(R/r)^2$']
    };
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "", xMax: 1 }), g2 = new K.Graph(cv[1], { yLabel: "", xMax: 1 }), g3 = new K.Graph(cv[2], { yLabel: "", xMax: 1 });
    function opts(g, o) { g.o = o; g.clear(); g.extra = null; }

    function theory() {
      var rf = rhoF();
      CAPS[mode].forEach(function (c, i) { caps[i].innerHTML = K.md(c); });
      if (mode === "probe") {
        opts(g1, { yLabel: "p − p₀ (kPa)", xLabel: "h (m)", xMax: 1.36, yMin: 0, color: th.disp });
        opts(g2, { yLabel: "p − p₀ (kPa)", xLabel: "x across the stage (m)", xMax: W / PPM, yMin: 0, color: th.disp });
        opts(g3, { yLabel: "p − p₀ (kPa)", xLabel: "h (m)", xMax: 1.36, yMin: 0, color: th.disp });
        g1.set("theory", { points: [[0, 0], [1.36, rf * G * 1.36 / 1000]], color: th.disp, dash: [5, 5], width: 1.5 });
        Object.keys(LIQS).forEach(function (k) {
          var r = LIQS[k].rho;
          var cap = liq === "hg" ? 200 : 25, hEnd = Math.min(1.36, cap * 1000 / (r * G));
          g3.set(k, { points: [[0, 0], [hEnd, r * G * hEnd / 1000]], color: k === liq ? th.disp : K.alpha(th.muted, 0.5), dash: k === liq ? [5, 5] : [2, 4], width: k === liq ? 2 : 1.2 });
        });
      } else if (mode === "float") {
        opts(g1, { yLabel: "fraction under", xLabel: "ρ_b / ρ_f", xMax: 2, yMin: 0, yMax: 1, color: th.normal });
        opts(g2, { yLabel: "T (N)", xLabel: "depth under (cm)", xMax: 20, yMin: 0, color: th.ten });
        opts(g3, { yLabel: "depth (cm)", xLabel: "t (s)", xMax: 5, xAuto: true, color: th.disp });
        g1.set("theory", { points: [[0, 0], [1, 1], [2, 1]], color: th.normal, dash: [5, 5], width: 1.5 });
        var tp = [];
        for (var d = 0; d <= 20; d += 0.5) tp.push([d, Math.max(0, weight() - rf * G * A_SIDE * A_SIDE * d / 100)]);
        g2.set("theory", { points: tp, color: th.ten, dash: [5, 5], width: 1.5 });
        var zeq = rbS.get() < rf ? zFloat() : FD;
        g3.set("theory", { points: [[0, zeq * 100], [5, zeq * 100]], color: th.disp, dash: [5, 5], width: 1.5 });
      } else {
        var q = A1() / A2(), M = MS.get();
        opts(g1, { yLabel: "d₂ (cm)", xLabel: "d₁ (m)", xMax: 1, yMin: 0, color: th.disp });
        opts(g2, { yLabel: "W (J)", xLabel: "d₁ (m)", xMax: 1, yMin: 0, color: th.acc });
        opts(g3, { yLabel: "F₁ (N)", xLabel: "R / r", xMax: 30, yMin: 0, color: th.app });
        g1.set("theory", { points: [[0, 0], [1, q * 100]], color: th.disp, dash: [5, 5], width: 1.5 });
        g2.set("theory", { points: [[0, 0], [1, M * G * q]], color: th.acc, dash: [5, 5], width: 1.5 });
        var fp = [];
        for (var k = 1; k <= 30; k += 0.25) fp.push([k, M * G / (k * k)]);
        g3.set("theory", { points: fp, color: th.app, dash: [5, 5], width: 1.5 });
        g3.o.yMax = Math.min(M * G, Math.max(F1() * 3, 500));
      }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
    function update(force) {
      if (mode === "probe") {
        var pth = readings.filter(function () { return true; });
        g1.extra = function (ctx, X, Y) {
          dots(ctx, X, Y, pth.map(function (r) { return [r.h, (r.p - P0) / 1000]; }), K.alpha(th.disp, 0.6));
          if (probe.y > PS && vesselAt(probe.x, probe.y)) ring(ctx, X(depthOf(probe.y)), Y((pressureAt(probe.x, probe.y) - P0) / 1000));
        };
        var h = depthOf(probe.y), level = readings.filter(function (r) { return Math.abs(r.h - h) < 0.01; });
        var gp = rhoF() * G * Math.max(0, h) / 1000; g2.set("theory", { points: [[0, gp], [W / PPM, gp]], color: th.disp, dash: [5, 5], width: 1.5 });
        g2.o.yMax = rhoF() * G * 1.4 / 1000;
        g2.extra = function (ctx, X, Y) { dots(ctx, X, Y, level.map(function (r) { return [r.x / PPM, (r.p - P0) / 1000]; }), th.disp); };
        g3.extra = function (ctx, X, Y) { if (probe.y > PS) ring(ctx, X(h), Y(rhoF() * G * h / 1000)); };
      } else if (mode === "float") {
        g1.extra = function (ctx, X, Y) {
          dots(ctx, X, Y, results.map(function (r) { return [Math.min(2, r.rb / r.rf), r.frac]; }), th.normal);
          ring(ctx, X(Math.min(2, rbS.get() / rhoF())), Y(Math.min(1, rbS.get() / rhoF())));
        };
        g2.set("sim", { points: blk.drag, color: th.ten, width: 2.5, dot: true });
        g3.set("sim", { points: blk.rec, color: th.disp, width: 2.5, dot: true });
        var zq = (rbS.get() < rhoF() ? zFloat() : FD) * 100, tl = blk.rec.length ? Math.max(5, blk.rec[blk.rec.length - 1][0]) : 5;
        g3.set("theory", { points: [[0, zq], [tl, zq]], color: th.disp, dash: [5, 5], width: 1.5 });
      } else {
        g1.set("sim", { points: lift.rec.map(function (r) { return [r[0], r[1]]; }), color: th.disp, width: 2.5, dot: true });
        g2.set("sim", { points: lift.rec.map(function (r) { return [r[0], r[2]]; }), color: th.acc, width: 2.5, dot: true });
        g3.extra = function (ctx, X, Y) { ring(ctx, X(r2S.get() / r1S.get()), Y(F1())); };
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var LABELS = {
      probe: ["Pressure at depth h", "Gauge pressure: what the liquid adds", "Same depth, same pressure", "Top-to-bottom difference across a 20 cm block"],
      float: ["Weight of the block", "Buoyancy = weight of liquid displaced", "The spring balance reads the apparent weight", "Floating: what fraction is under?"],
      lift: ["Pascal: the same pressure on both pistons", "The force multiplier", "Volume in = volume out", "No free lunch: work in = work out"]
    };
    var READ = {
      probe: [{ id: "h", label: "depth h", cls: "c-disp" }, { id: "p", label: "pressure p" }, { id: "g", label: "gauge p − p₀" }, { id: "v", label: "where" }, { id: "rho", label: "liquid density" }],
      float: [{ id: "W", label: "weight W", cls: "c-grav" }, { id: "B", label: "buoyancy B", cls: "c-normal" }, { id: "T", label: "spring balance T", cls: "c-ten" },
        { id: "f", label: "fraction under" }, { id: "r", label: "ρ_b / ρ_f" }, { id: "s", label: "state" }],
      lift: [{ id: "F1", label: "push needed F₁", cls: "c-app" }, { id: "Mg", label: "load Mg", cls: "c-grav" }, { id: "p", label: "oil pressure" },
        { id: "d1", label: "push distance d₁", cls: "c-app" }, { id: "d2", label: "load rise d₂", cls: "c-disp" }, { id: "Wi", label: "work in", cls: "c-acc" }, { id: "Wo", label: "work out", cls: "c-acc" }]
    };
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label"), setR = null;
    function buildPanels() {
      LABELS[mode].forEach(function (l, i) { eqLabels[i].textContent = l; eqEls[i]._tex = null; });
      setR = K.readout(P.readouts, READ[mode]);
    }
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function sciT(v, d) { var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e); if (Number(m.toFixed(d)) >= 10) { e++; m /= 10; } return m.toFixed(d) + "\\times 10^{" + e + "}"; }
    function renderMaths() {
      var rf = rhoF();
      if (mode === "probe") {
        var inL = probe.y > PS && vesselAt(probe.x, probe.y), h = inL ? depthOf(probe.y) : 0, p = P0 + rf * G * h;
        K.tex(eqEls[0], "p = p_0 + \\rho g h = 1.013\\times10^5 + " + B(rf, 0) + B(G) + B(h, 3) + " = \\mathbf{" + K.fmt(p / 1000, 2) + "}\\ \\text{kPa}");
        K.tex(eqEls[1], "p - p_0 = \\rho g h = \\mathbf{" + K.fmt(rf * G * h, 0) + "}\\ \\text{Pa}");
        K.tex(eqEls[2], "h_{\\text{tank}} = h_{\\text{tube}} = h_{\\text{funnel}} = " + K.fmt(h, 3) + "\\ \\text{m} \\;\\Rightarrow\\; p = \\mathbf{" + K.fmt(p / 1000, 2) + "}\\ \\text{kPa in all three}");
        K.tex(eqEls[3], "\\Delta p = \\rho g (0.2) = " + B(rf, 0) + B(G) + "(0.2) = \\mathbf{" + K.fmt(rf * G * 0.2, 0) + "}\\ \\text{Pa} \\;\\Rightarrow\\; B = \\Delta p \\cdot A");
        setR("h", inL ? K.fmt(h, 3) + " m" : "above the surface");
        setR("p", K.fmt(p / 1000, 2) + " kPa", inL ? "gauge reading" : "just air: p₀");
        setR("g", K.fmt(rf * G * h, 0) + " Pa", "ρgh = " + K.fmt(rf * G * h, 0) + " Pa");
        setR("v", inL ? VNAMES[vesselAt(probe.x, probe.y)] : "in the air", "the shape doesn't enter");
        setR("rho", rf + " kg/m³", LIQS[liq].label);
      } else if (mode === "float") {
        var Wt = weight(), Bf = buoy(blk.z), frac = subDepth(blk.z) / A_SIDE, rb = rbS.get(), floats = rb < rf;
        K.tex(eqEls[0], "W = \\rho_b a^3 g = " + B(rb, 0) + "(0.2)^3" + B(G) + " = \\mathbf{" + K.fmt(Wt, 1) + "}\\ \\text{N}");
        K.tex(eqEls[1], "B = \\rho_f V_{sub} g = " + B(rf, 0) + "(0.2)^2" + B(subDepth(blk.z), 3) + B(G) + " = \\mathbf{" + K.fmt(Bf, 1) + "}\\ \\text{N}");
        K.tex(eqEls[2], blk.free ? "\\text{string cut: } T = 0,\\ \\ " + (blk.N > 0.05 ? "N = W - B = \\mathbf{" + K.fmt(blk.N, 1) + "}\\ \\text{N}" : "ma = W - B - F_{drag}")
          : "T = W - B = " + K.fmt(Wt, 1) + " - " + K.fmt(Bf, 1) + " = \\mathbf{" + K.fmt(blk.T, 1) + "}\\ \\text{N}" + (blk.T < 1e-9 ? "\\ \\text{(slack: it floats)}" : ""));
        K.tex(eqEls[3], floats ? "\\frac{V_{sub}}{V} = \\frac{\\rho_b}{\\rho_f} = \\frac{" + rb + "}{" + rf + "} = \\mathbf{" + K.fmt(rb / rf, 3) + "}"
          : "\\rho_b = " + rb + " \\ge \\rho_f = " + rf + " \\;\\Rightarrow\\; \\text{even fully under, } B_{max} = " + K.fmt(rf * G * Math.pow(A_SIDE, 3), 1) + "\\ \\text{N} < W: \\textbf{it sinks}");
        setR("W", K.fmt(Wt, 1) + " N"); setR("B", K.fmt(Bf, 1) + " N", "ρ_f V_sub g");
        setR("T", blk.free ? "—" : K.fmt(blk.T, 1) + " N", blk.free ? "string cut" : "W − B = " + K.fmt(Math.max(0, Wt - Bf), 1));
        setR("f", K.fmt(frac, 3), floats ? "formula ρ_b/ρ_f = " + K.fmt(rb / rf, 3) : "fully under once it sinks");
        setR("r", K.fmt(rb / rf, 3)); setR("s", blk.settled ? (blk.z >= FD - 1e-9 ? "on the bottom" : "floating") : blk.free ? "moving" : "on the string");
      } else {
        var a1 = A1(), a2 = A2(), M = MS.get(), f1 = F1(), r = r1S.get(), R = r2S.get();
        K.tex(eqEls[0], "\\frac{F_1}{A_1} = \\frac{Mg}{A_2} = \\frac{" + B(M, 0) + B(G) + "}{\\pi" + B(R / 100, 2) + "^2} = \\mathbf{" + sciT(M * G / a2, 3) + "}\\ \\text{Pa}");
        K.tex(eqEls[1], "F_1 = Mg\\left(\\frac{r}{R}\\right)^2 = " + K.fmt(M * G, 0) + "\\left(\\frac{" + K.fmt(r, 1) + "}{" + K.fmt(R, 0) + "}\\right)^2 = \\mathbf{" + K.fmt(f1, 1) + "}\\ \\text{N}");
        K.tex(eqEls[2], "A_1 d_1 = A_2 d_2 \\Rightarrow d_2 = d_1\\left(\\frac{r}{R}\\right)^2 = " + B(lift.d1 * 100, 1) + B(a1 / a2, 4) + " = \\mathbf{" + K.fmt(lift.d2 * 100, 2) + "}\\ \\text{cm}");
        K.tex(eqEls[3], "F_1 d_1 = " + B(f1, 1) + B(lift.d1, 3) + " = \\mathbf{" + K.fmt(f1 * lift.d1, 1) + "}\\ \\text{J} = Mg\\,d_2 = " + K.fmt(M * G * lift.d2, 1) + "\\ \\text{J}");
        setR("F1", K.fmt(f1, 1) + " N", "Mg × A₁/A₂"); setR("Mg", K.fmt(M * G, 0) + " N", "× " + K.fmt(a2 / a1, 0) + " multiplier");
        setR("p", K.fmt(M * G / a2 / 1000, 1) + " kPa", "same under both pistons");
        setR("d1", K.fmt(lift.d1 * 100, 1) + " cm"); setR("d2", K.fmt(lift.d2 * 100, 2) + " cm", "d₁ A₁/A₂ = " + K.fmt(lift.d1 * a1 / a2 * 100, 2));
        setR("Wi", K.fmt(lift.Win, 1) + " J", "Σ F₁ Δd₁"); setR("Wo", K.fmt(M * G * lift.d2, 1) + " J", "Mg d₂");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>In a liquid at rest, pressure grows with depth only: <b>$p = p_0 + \\rho g h$</b>. Points at the same depth in one connected liquid are at the same pressure, whatever the shape of the vessel.</p>" +
      "<p>A body in the liquid feels more pressure on its bottom than its top. The difference, $\\rho g a \\times a^2$, is the <b class=\"c-normal\">buoyant force</b>: $B = \\rho_f V_{sub} g$, the weight of the liquid it pushes aside (Archimedes). On a spring balance it reads <b class=\"c-ten\">$W - B$</b>. Cut the string and it floats if $\\rho_b < \\rho_f$, with a fraction $\\rho_b/\\rho_f$ under.</p>" +
      "<p>Push on a closed liquid and the extra pressure reaches every part of it equally (<b>Pascal's law</b>). A small force on a small piston makes a big force on a big piston: $F_2 = F_1 A_2/A_1$, paid for in distance.</p>" +
      '<div class="trap"><b>JEE trap: buoyancy is not about how deep the body is.</b> Once it\'s fully under, $B = \\rho_f V g$ stays the same at any depth, even though the pressure keeps rising: top and bottom pressures rise together. And the pressure at the base of a narrow vessel is not smaller just because it holds less liquid.</div>');
    function apply(s) {
      if (s.rho) { liq = Object.keys(LIQS).filter(function (k) { return LIQS[k].rho === s.rho; })[0]; setSeg(liqSeg, liq); }
      if (s.rhoB) rbS.set(s.rhoB);
      if (s.r1) { r1S.set(s.r1); r2S.set(s.r2); MS.set(s.M); }
      setMode(s.mode);
      if (s.mode === "probe") { moveProbe(s.x, PS + s.h * PPM, true); update(true); }
      if (s.mode === "float" && s.z != null) { holdAt(s.z); update(true); }
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "p = p₀ + ρgh", setup: { mode: "probe", rho: 1000, x: 460, h: 0.8 }, watch: "Predict p, then drag the probe across to the wide tank at the same depth",
        q: "The thin tube holds far less water than the wide tank beside it. What is the absolute pressure 0.8 m below the surface <i>inside the thin tube</i>? ($p_0 = 1.013 \\times 10^5$ Pa, $g = 9.8$)",
        options: ["$7.84 \\times 10^3$ Pa", "$1.09 \\times 10^5$ Pa", "$1.01 \\times 10^5$ Pa: the tube holds too little water to add much", "$1.79 \\times 10^5$ Pa"], answer: 1,
        explain: "$p = p_0 + \\rho g h = 1.013 \\times 10^5 + 1000 \\times 9.8 \\times 0.8 = 1.091 \\times 10^5$ Pa, exactly as in the wide tank at that depth. $7.84 \\times 10^3$ Pa is only the gauge part $\\rho g h$." },
      { level: "medium", tag: "hydraulic lift", setup: { mode: "lift", r1: 2, r2: 20, M: 1500 }, watch: "Predict F₁ and the push, then press Push and watch the rise",
        q: "A hydraulic lift has pistons of radius 2 cm and 20 cm. What force on the small piston holds a 1500 kg car ($g = 9.8$), and how far must it be pushed to raise the car 1 cm?",
        options: ["147 N and 1 m", "1470 N and 10 cm", "147 N and 1 cm", "14.7 N and 10 m"], answer: 0,
        hints: ["Pascal: $F_1/A_1 = Mg/A_2$. Areas go as the radius <i>squared</i>.", "The oil pushed out of the small cylinder fills the big one: $A_1 d_1 = A_2 d_2$."],
        explain: "$A_2/A_1 = (20/2)^2 = 100$, so $F_1 = 1500 \\times 9.8/100 = 147$ N. The same factor works against you in distance: $d_1 = 100 \\times 1$ cm = 1 m. Check: $147 \\times 1 = 14700 \\times 0.01 = 147$ J in and out. Using the radius ratio (10) instead of the area ratio gives 1470 N." },
      { level: "hard", tag: "density by weighing", setup: { mode: "float", rho: 800, rhoB: 2700, z: 0.5 }, watch: "Read the balance here in oil, then switch to water and read it again",
        q: "A metal block weighs 211.7 N in air and 133.3 N when fully under water. Fully under a certain oil it weighs 149.0 N. What is the density of the oil? ($\\rho_{water} = 1000$ kg/m³)",
        options: ["704 kg/m³", "800 kg/m³", "1120 kg/m³", "1250 kg/m³"], answer: 1,
        hints: ["The loss of weight in a liquid is the buoyancy, $\\rho_{liq} V g$. The block's volume $V$ is the same in both.", "So $\\rho_{oil}/\\rho_{water} = \\dfrac{\\text{loss in oil}}{\\text{loss in water}}$."],
        explain: "Loss in water $= 211.7 - 133.3 = 78.4$ N $= \\rho_w V g$, so $V = 8 \\times 10^{-3}$ m³ (a 20 cm cube). Loss in oil $= 211.7 - 149.0 = 62.7$ N. Ratio $62.7/78.4 = 0.80$, so $\\rho_{oil} = 800$ kg/m³. Bonus: $\\rho_{block} = 211.7/78.4 \\times 1000 = 2700$ kg/m³, aluminium. 1250 is the ratio upside down." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = K.transport(P, sim, { playLabel: "Lower the probe", onReset: reset,
      onPlay: function () {
        if (mode === "probe") { if (probe.y >= PCH - 6 || !vesselAt(probe.x, Math.max(probe.y, PS + 1))) moveProbe(200, PS + 2, true); lowering = true; }
        else if (mode === "float") { if (blk.free) reset(); blk.free = true; blk.rec = [[0, blk.z * 100]]; sim.resetClock(); }
        else if (lift.d1 >= 1) reset();
      } });
    // the play button's label depends on the experiment
    transportUI.setLabel = function (l) { transportUI.label = l; transportUI.render(); };
    var baseRender = transportUI.render;
    transportUI.render = function () { baseRender(); if (!sim.running && transportUI.label) P.playBtn.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>' + transportUI.label; };
    P.playBtn.addEventListener("click", function () { transportUI.render(); });
    setMode("probe");

    if (location.hostname === "localhost") {
      window.__lab_fluids = {
        apply: apply, probeTo: function (x, h) { var ok = moveProbe(x, PS + h * PPM, true); update(true); return ok; },
        pressure: function () { return pressureAt(probe.x, probe.y); }, blk: function () { return blk; }, lift: function () { return lift; },
        holdAt: function (z) { holdAt(z); update(true); }, pushTo: function (d) { pushTo(d); update(true); }, F1: F1, weight: weight, results: function () { return results; },
        setLiquid: function (k) { liq = k; setSeg(liqSeg, k); reset(); },
        // drag with real pointer events from one stage point to another
        drag: function (x0, y0, x1, y1) {
          var r = P.canvas.getBoundingClientRect(), ev = function (type, x, y) { P.canvas.dispatchEvent(new PointerEvent(type, { clientX: r.left + x * sim.scale, clientY: r.top + y * sim.scale, pointerId: 2, bubbles: true })); };
          ev("pointerdown", x0, y0); for (var i = 1; i <= 10; i++) ev("pointermove", x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); ev("pointerup", x1, y1);
        },
        PS: PS, FS: FS, PPM: PPM, blockTop: blockTop
      };
    }

    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_fluids) delete window.__lab_fluids; };
  }
})();
