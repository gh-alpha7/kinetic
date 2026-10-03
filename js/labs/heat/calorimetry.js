/* Thermal properties, lab 2: calorimetry and phase change. Mix things in a calorimeter, or heat ice to steam under a steady heater. */
(function () {
  "use strict";
  var CW = 4200, CI = 2100, CS = 2010, LF = 3.36e5, LV = 2.268e6, CCAN = 390;   // J/kg·K and J/kg (1 cal/g = 4200 J/kg)
  var METALS = {
    copper: { name: "Copper", c: 390, rho: 8900, col: "#c2703d" },
    alu:    { name: "Aluminium", c: 900, rho: 2700, col: "#b8c4d6" },
    iron:   { name: "Iron", c: 460, rho: 7900, col: "#8a8f98" },
    lead:   { name: "Lead", c: 130, rho: 11300, col: "#6b7280" }
  };

  var lab = {
    id: "calorimetry", chapter: "heat", title: "Calorimetry & phase change", short: "heat lost = heat gained, latent heat",
    lede: "Drop ice, hot water or a hot metal block into a calorimeter and watch heat flow from hot to cold until everything shares one temperature. Then heat ice to steam and see the temperature stop dead while it melts and boils.",
    tries: [
      { id: "ice0", title: "Leave some ice floating at 0 °C",
        text: "In <b>Mixing</b>, add enough cold ice that it can't all melt.",
        why: "The water can only give up $(m_w c_w + m_c c_c)(T_w - 0)$ before it reaches 0 °C itself. If that's less than $m_i c_i|T_i| + m_i L_f$, melting stops part way and the whole mixture sits at 0 °C." },
      { id: "half", title: "Land exactly halfway",
        text: "Mix equal masses of water at two temperatures, with no calorimeter can, and get a final temperature that's the average.",
        why: "Heat lost = heat gained: $mc(T_1 - T_f) = mc(T_f - T_2)$, so $T_f = (T_1 + T_2)/2$. Unequal masses or a can with its own heat capacity pull it off centre." },
      { id: "melt", title: "Time the melting plateau",
        text: "In <b>Heating curve</b>, start with ice and heat it until it has all melted.",
        why: "While it melts the heater's power goes into breaking the ice apart, not into raising the temperature: the plateau lasts $mL_f/P$. Doubling the power halves it." },
      { id: "boil", title: "Boil it dry",
        text: "Keep heating until every gram has turned to steam.",
        why: "$L_v$ is about 6.75 times $L_f$, so the boiling plateau is 6.75 times longer than the melting one. Only then does the steam get hotter than 100 °C." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- water substance with phase changes (enthalpy H = 0 for all ice at 0 °C) ---------- */
  // body: { mw: kg of water substance, C: J/K of anything else (can, metal) }
  function caps(b) { return { s: b.mw * CI + b.C, l: b.mw * CW + b.C, g: b.mw * CS + b.C }; }
  function state(b, H) {
    var c = caps(b), H1 = b.mw * LF, H2 = H1 + 100 * c.l, H3 = H2 + b.mw * LV;
    if (H < 0) return { T: H / c.s, ice: b.mw, steam: 0, C: c.s };
    if (H <= H1 && b.mw > 0) return { T: 0, ice: b.mw - H / LF, steam: 0, C: Infinity };
    if (H <= H2) return { T: (H - H1) / c.l, ice: 0, steam: 0, C: c.l };
    if (H <= H3 && b.mw > 0) return { T: 100, ice: 0, steam: (H - H2) / LV, C: Infinity };
    return { T: 100 + (H - H3) / c.g, ice: 0, steam: b.mw, C: c.g };
  }
  function Hsolid(b, T) { return caps(b).s * T; }                    // all ice, T ≤ 0
  function Hliquid(b, T) { return b.mw * LF + caps(b).l * T; }       // all liquid, 0 ≤ T ≤ 100

  // the textbook route: heat lost = heat gained, checking first whether the ice can all melt
  function textbook(p) {
    var Cb = p.mw * CW + p.mc * CCAN, r = { Cb: Cb };
    if (p.item !== "ice") {
      var Ci = p.item === "water" ? p.mi * CW : p.mi * METALS[p.metal].c;
      r.Ci = Ci; r.Tf = (Cb * p.Tw + Ci * p.Ti) / (Cb + Ci); r.kind = "mix"; r.ice = 0; r.steam = 0;
      if (r.Tf > 100) {   // the water boils: the heat beyond 100 °C turns some of it to steam
        var extra = Cb * (p.Tw - 100) + Ci * (p.Ti - 100);
        r.Tf = 100; r.steam = Math.min(extra / LV, p.mw + (p.item === "water" ? p.mi : 0)); r.kind = "boil";
      }
      r.Q = Math.abs(Cb * (r.Tf - p.Tw) + (r.kind === "boil" ? r.steam * LV : 0));
      return r;
    }
    var Qa = Cb * p.Tw, Qw = p.mi * CI * (0 - p.Ti), Qm = p.mi * LF;
    r.Qavail = Qa; r.Qwarm = Qw; r.Qmelt = Qm; r.steam = 0;
    if (Qa >= Qw + Qm) { r.kind = "melt"; r.Tf = (Qa - Qw - Qm) / (Cb + p.mi * CW); r.ice = 0; }
    else if (Qa >= Qw) { r.kind = "ice0"; r.Tf = 0; r.ice = p.mi - (Qa - Qw) / LF; }
    else if (Qa + p.mw * LF >= Qw) { r.kind = "freeze0"; r.Tf = 0; r.ice = p.mi + (Qw - Qa) / LF; }
    else { r.kind = "frozen"; r.Tf = (Qa + p.mw * LF + p.mi * CI * p.Ti) / (p.mi * CI + p.mw * CI + p.mc * CCAN); r.ice = p.mi + p.mw; }
    r.Q = r.kind === "melt" ? Cb * (p.Tw - r.Tf) : r.kind === "ice0" ? Qa : Qw;
    return r;
  }
  // heating curve breakpoints: the times each stage ends under power P
  function curve(p) {
    var m = p.m, P = p.P, t = 0, pts = [];
    var ice = p.T0 <= 0;
    if (ice) { pts.push([0, p.T0]); t += m * CI * (0 - p.T0) / P; pts.push([t, 0]); var tm0 = t; t += m * LF / P; pts.push([t, 0]); var tm1 = t; }
    else pts.push([0, p.T0]);
    t += m * CW * (100 - (ice ? 0 : p.T0)) / P; pts.push([t, 100]); var tb0 = t;
    t += m * LV / P; pts.push([t, 100]); var tb1 = t;
    t += m * CS * 30 / P; pts.push([t, 130]);
    return { pts: pts, melt: ice ? [tm0, tm1] : null, boil: [tb0, tb1], end: t };
  }
  function sig(n, s) {
    if (!isFinite(n)) return "—";
    if (n === 0) return "0";
    var d = Math.max(0, (s || 3) - 1 - Math.floor(Math.log10(Math.abs(n))));
    return K.fmt(n, Math.min(d, 6));
  }
  function tempRGB(T) {
    var stops = [[-40, [70, 120, 235]], [0, [120, 175, 235]], [20, [150, 160, 175]], [60, [235, 150, 60]], [100, [235, 70, 40]], [300, [200, 30, 30]]];
    if (T <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (T <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], f = (T - a[0]) / (b[0] - a[0]);
        return a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * f); });
      }
    }
    return stops[stops.length - 1][1];
  }
  function tempCol(T, al) { var c = tempRGB(T); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (al === undefined ? 1 : al) + ")"; }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 420;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "mix", item = "ice", metal = "alu";
    var itemT = { ice: -10, water: 80, metal: 150 };
    var mwS = K.slider({ label: "Water in the calorimeter $m_w$", unit: "g", min: 50, max: 1000, step: 10, value: 200, onInput: reset });
    var TwS = K.slider({ label: "Its temperature $T_w$", unit: "°C", min: 0, max: 100, step: 1, value: 30, onInput: reset });
    var mcS = K.slider({ label: "Copper can $m_c$", unit: "g", min: 0, max: 500, step: 10, value: 0, onInput: reset,
      hint: "$c_{Cu} = 390$ J/kg·K. 0 means an ideal, massless calorimeter." });
    var miS = K.slider({ label: "Mass dropped in $m$", unit: "g", min: 5, max: 1000, step: 5, value: 100, onInput: reset });
    var TiS = K.slider({ label: "Its temperature $T_i$", unit: "°C", min: -40, max: 0, step: 1, value: -10, onInput: function (v) { itemT[item] = v; reset(); } });
    var mS = K.slider({ label: "Mass of the sample $m$", unit: "g", min: 5, max: 200, step: 5, value: 20, onInput: reset });
    var T0S = K.slider({ label: "Start temperature", unit: "°C", min: -40, max: 90, step: 1, value: -20, onInput: reset, hint: "At or below 0 °C it starts as ice." });
    var PS = K.slider({ label: "Heater power $P$", unit: "W", min: 100, max: 2000, step: 50, value: 1000, onInput: reset });
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Mixing", value: "mix" }, { label: "Heating curve", value: "heat" }], mode, function (v) { mode = v; show(); reset(); }, "Experiment");
    P.controls.appendChild(modeSeg);
    var grpMix = K.h("<div><h3>Calorimeter</h3></div>"), grpItem = K.h("<div><h3>Drop in</h3></div>"), grpHeat = K.h("<div><h3>Sample and heater</h3></div>");
    [mwS, TwS, mcS].forEach(function (s) { grpMix.appendChild(s.el); });
    var itemSeg = K.seg([{ label: "Ice", value: "ice" }, { label: "Hot water", value: "water" }, { label: "Metal block", value: "metal" }], item,
      function (v) { item = v; itemRange(); reset(); }, "Item");
    var metalSeg = K.seg(Object.keys(METALS).map(function (k) { return { label: METALS[k].name, value: k }; }), metal, function (v) { metal = v; reset(); }, "Metal");
    grpItem.appendChild(itemSeg); grpItem.appendChild(metalSeg);
    [miS, TiS].forEach(function (s) { grpItem.appendChild(s.el); });
    [mS, T0S, PS].forEach(function (s) { grpHeat.appendChild(s.el); });
    [grpMix, grpItem, grpHeat].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h('<div class="legend"><span style="color:' + tempCol(-30) + '"><i></i>cold</span><span style="color:' + tempCol(20) + '"><i></i>20 °C</span>' +
      '<span style="color:' + tempCol(100) + '"><i></i>100 °C</span><span class="c-acc"><i></i>heat flow</span><span class="c-disp"><i></i>calorimeter water</span><span class="c-app"><i></i>what you dropped in</span></div>'));
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function itemRange() {
      var r = { ice: [-40, 0], water: [0, 100], metal: [0, 300] }[item];
      TiS.input.min = r[0]; TiS.input.max = r[1]; TiS.set(itemT[item]);
      metalSeg.hidden = item !== "metal";
    }
    function show() { grpMix.hidden = grpItem.hidden = mode !== "mix"; grpHeat.hidden = mode !== "heat"; }
    itemRange(); show();

    function params() {
      return { mode: mode, item: item, metal: metal, mw: mwS.get() / 1000, Tw: TwS.get(), mc: mcS.get() / 1000, mi: miS.get() / 1000, Ti: TiS.get(),
        m: mS.get() / 1000, T0: T0S.get(), P: PS.get() };
    }

    /* ---------- the model ---------- */
    var st, rec, CUP = { x: 420, top: 170, bot: 380, w: 240 }, HOVER = { x: 420, y: 95 };
    function bodies(p) {
      var A = { mw: p.mw, C: p.mc * CCAN };
      var B = p.item === "metal" ? { mw: 0, C: p.mi * METALS[p.metal].c } : { mw: p.mi, C: 0 };
      return { A: A, B: B };
    }
    var transOpts = { playLabel: "Drop it in", onReset: function () { reset(); }, onPlay: function () { if (st.done) reset(); if (st.mix) st.dropping = true; } };
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      if (p.mode === "mix") {
        var b = bodies(p);
        var HB = p.item === "ice" ? Hsolid(b.B, p.Ti) : p.item === "water" ? Hliquid(b.B, p.Ti) : b.B.C * p.Ti;
        st = { mix: true, A: b.A, B: b.B, HA: Hliquid(b.A, p.Tw), HB: HB, HB0: HB, inCup: false, dropping: false, y: HOVER.y, x: HOVER.x, done: false, power: 0, t: 0 };
        // rate constant: big enough that it settles in a few seconds whatever the sizes
        var ca = caps(b.A).l, cb = p.item === "ice" ? caps(b.B).s : caps(b.B).l;
        st.k = 2.5 * Math.max(ca, cb);
        st.book = textbook(p);
        transOpts.playLabel = "Drop it in";
      } else {
        var s = { mw: p.m, C: 0 }, H0 = p.T0 <= 0 ? Hsolid(s, p.T0) : Hliquid(s, p.T0), cv = curve(p);
        // time-lapse so the whole curve takes about 20 s on screen
        var lapse = 1;
        [1, 2, 5, 10, 20, 50, 100].forEach(function (v) { if (cv.end / v >= 18) lapse = v; });
        st = { mix: false, S: s, H: H0, H0: H0, t: 0, lapse: lapse, cv: cv, marks: {}, done: false };
        transOpts.playLabel = "Heat";
      }
      rec = [];
      record(p);
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }
    function record(p) {
      if (st.mix) {
        var a = state(st.A, st.HA), b = state(st.B, st.HB);
        rec.push({ t: st.t, TA: a.T, TB: b.T, Q: Math.abs(st.HB0 - st.HB), ice: (a.ice + b.ice) * 1000 });
      } else {
        var s = state(st.S, st.H);
        rec.push({ t: st.t, T: s.T, Q: (st.H - st.H0) / 1000, ice: s.ice * 1000, water: (st.S.mw - s.ice - s.steam) * 1000, steam: s.steam * 1000 });
      }
      if (rec.length > 3000) rec.splice(1, 1);
    }

    sim.on("step", function () {
      if (st.done) return;
      var p = params();
      if (st.mix) stepMix(p); else stepHeat(p);
      update(st.done);
    });
    function stepMix(p) {
      if (!st.inCup) {
        st.y += 12;   // fall into the cup
        st.x += (HOVER.x - st.x) * 0.3;
        if (st.y >= landY()) { st.y = landY(); st.inCup = true; }
        return;
      }
      st.t += K.DT;
      var n = 20, h = K.DT / n, q = 0;
      for (var i = 0; i < n; i++) {
        var a = state(st.A, st.HA), b = state(st.B, st.HB), dT = b.T - a.T;
        // relax the two temperatures exactly over one substep (a plateau has infinite capacity)
        var inv = (isFinite(a.C) ? 1 / a.C : 0) + (isFinite(b.C) ? 1 / b.C : 0);
        var Q = inv > 0 ? dT * (1 - Math.exp(-st.k * inv * h)) / inv : st.k * dT * h;
        st.HA += Q; st.HB -= Q; q += Q;
      }
      st.power = q / K.DT;
      record(p);
      var A = state(st.A, st.HA), B = state(st.B, st.HB);
      if (Math.abs(A.T - B.T) < 0.001 || st.t > 90) finishMix(p, A, B);
    }
    function finishMix(p, A, B) {
      st.done = true; sim.pause(); transportUI.render();
      var ice = (A.ice + B.ice) * 1000;
      K.flash(P.note, "Settled at " + K.fmt(A.T, 2) + " °C" + (ice > 0.05 ? ", " + K.fmt(ice, 1) + " g of ice left" : ""), 3500);
      if (Math.abs(A.T) < 0.01 && ice >= 1 && p.item === "ice" && (A.ice + B.ice) < p.mi + p.mw - 1e-6) tries.mark("ice0");
      if (p.item === "water" && p.mc === 0 && Math.abs(p.mw - p.mi) < 1e-9 && p.Tw !== p.Ti && Math.abs(A.T - (p.Tw + p.Ti) / 2) <= 0.05) tries.mark("half");
    }
    function stepHeat(p) {
      var dt = K.DT * st.lapse, H0 = st.H, before = state(st.S, H0);
      st.H += p.P * dt;
      var t0 = st.t;
      st.t += dt;
      var now = state(st.S, st.H), c = caps(st.S), H1 = st.S.mw * LF, H2 = H1 + 100 * c.l, H3 = H2 + st.S.mw * LV;
      // when did each threshold get crossed inside this step? P is steady, so interpolate exactly
      [["meltStart", 0], ["meltEnd", H1], ["boilStart", H2], ["boilEnd", H3]].forEach(function (k) {
        if (st.marks[k[0]] === undefined && H0 < k[1] + 1e-9 && st.H >= k[1] - 1e-9 && st.H0 <= k[1] + 1e-9) st.marks[k[0]] = t0 + (k[1] - H0) / p.P;
      });
      if (p.T0 <= 0 && before.ice > 0 && now.ice === 0) tries.mark("melt");
      if (before.steam < st.S.mw && now.steam >= st.S.mw) tries.mark("boil");
      record(p);
      if (now.T >= 130) {
        st.done = true; sim.pause(); transportUI.render();
        K.flash(P.note, "Steam at 130 °C: that's the whole curve");
      }
    }
    function landY() {
      var p = params();
      if (p.item === "ice") return waterTop() - 6;
      if (p.item === "metal") return CUP.bot - 14 - size(p) / 2;
      return CUP.bot - 30 - size(p);
    }
    function waterTop() { var p = params(); return CUP.bot - 30 - Math.min(170, (p.mw + (p.item === "water" ? p.mi : 0)) * 1000 * 0.17); }
    function size(p) {   // drawn size of the dropped thing, px
      if (p.item === "metal") return 18 + 60 * Math.cbrt(p.mi / METALS[p.metal].rho / 3.7e-4);
      return 14 + 46 * Math.cbrt(p.mi);
    }

    /* ---------- direct manipulation: drag the item into the cup ---------- */
    var drag = false;
    sim.pointer({
      down: function (q) {
        if (!st.mix || st.inCup || st.dropping) return false;
        var s = size(params());
        if (Math.abs(q.px - st.x) > s / 2 + 14 || Math.abs(q.py - st.y) > s / 2 + 14) return false;
        drag = true;
      },
      drag: function (q) { if (drag) { st.x = K.clamp(q.px, 40, 960); st.y = K.clamp(q.py, 30, 360); } },
      up: function (q) {
        if (!drag) return; drag = false;
        if (Math.abs(q.px - CUP.x) < CUP.w / 2 && q.py > 40) { st.dropping = true; st.y = Math.min(st.y, landY()); sim.play(); transportUI.render(); }
        else { st.x = HOVER.x; st.y = HOVER.y; }
      }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) { var p = params(); if (st.mix) drawMix(ctx, p); else drawHeat(ctx, p); });
    function cupShape(ctx, x0, x1, top, bot) { ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.lineTo(x1, bot); ctx.lineTo(x1, top); }
    function drawMix(ctx, p) {
      var A = state(st.A, st.HA), B = state(st.B, st.HB), x0 = CUP.x - CUP.w / 2, x1 = CUP.x + CUP.w / 2;
      // insulating jacket, then the can
      ctx.fillStyle = th["surface-2"]; ctx.fillRect(x0 - 26, CUP.top - 16, CUP.w + 52, CUP.bot - CUP.top + 34);
      ctx.strokeStyle = th.line; ctx.lineWidth = sim.u(1.5); ctx.strokeRect(x0 - 26, CUP.top - 16, CUP.w + 52, CUP.bot - CUP.top + 34);
      K.label(ctx, "insulated jacket", CUP.x, CUP.bot + 34, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      var wt = waterTop();
      ctx.fillStyle = tempCol(A.T, 0.75); ctx.fillRect(x0, wt, CUP.w, CUP.bot - wt);
      ctx.strokeStyle = p.mc > 0 ? "#c2703d" : th.ink; ctx.lineWidth = p.mc > 0 ? 4 + p.mc * 12 : 2;
      cupShape(ctx, x0, x1, CUP.top, CUP.bot); ctx.stroke();
      // stirrer and thermometer
      ctx.strokeStyle = th.muted; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1 - 30, CUP.top - 40); ctx.lineTo(x1 - 30, CUP.bot - 20); ctx.stroke();
      K.label(ctx, "bath " + K.fmt(A.T, 2) + " °C", x1 + 40, CUP.top + 20, th.disp, { align: "left", bg: true });
      var s = size(p);
      if (p.item === "ice") {
        var f = Math.cbrt(Math.max(B.ice, 0) / Math.max(p.mi, 1e-9)), sz = s * f;
        if (sz > 1) {
          ctx.fillStyle = "rgba(210,235,255,0.9)"; ctx.strokeStyle = "#7fb0e0"; ctx.lineWidth = 1.5;
          ctx.fillRect(st.x - sz / 2, st.y - sz / 2, sz, sz); ctx.strokeRect(st.x - sz / 2, st.y - sz / 2, sz, sz);
          ctx.fillStyle = tempCol(B.T, 0.35); ctx.fillRect(st.x - sz / 2, st.y - sz / 2, sz, sz);
        }
        if (A.ice > 1e-6) { ctx.fillStyle = "rgba(210,235,255,0.6)"; ctx.fillRect(x0, wt, CUP.w, Math.min(CUP.bot - wt, (CUP.bot - wt) * A.ice / p.mw)); }
      } else if (p.item === "metal") {
        ctx.fillStyle = METALS[p.metal].col; ctx.fillRect(st.x - s / 2, st.y - s / 2, s, s);
        ctx.fillStyle = tempCol(B.T, 0.5); ctx.fillRect(st.x - s / 2, st.y - s / 2, s, s);
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.strokeRect(st.x - s / 2, st.y - s / 2, s, s);
      } else {
        ctx.fillStyle = tempCol(B.T, 0.9); ctx.strokeStyle = th.app; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(st.x, st.y, s / 2 + 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!st.inCup) K.label(ctx, "in a thin bag, so you can see both temperatures", st.x, st.y - s / 2 - 12, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      }
      K.label(ctx, (p.item === "ice" ? "ice " : p.item === "metal" ? METALS[p.metal].name + " " : "water ") + K.fmt(B.T, 2) + " °C", x0 - 40, CUP.top + 20, th.app, { align: "right", bg: true });
      if (!st.inCup && !st.dropping) K.label(ctx, "drag it into the cup", st.x + s / 2 + 14, st.y + 4, th.muted, { align: "left" });
      // heat flow arrow, thickness by power
      if (st.inCup && Math.abs(st.power) > 1) {
        var w = K.clamp(Math.log10(Math.abs(st.power)) * 2, 2, 10), dir = st.power > 0 ? 1 : -1;
        var ax = st.x + (p.item === "water" ? 6 : 0) + size(p) / 2 + 10, ay = st.y;
        // heat flows from hot to cold: out of the item when it is hotter, into it when it is colder
        if (dir > 0) K.arrow(ctx, ax, ay, ax + 70, ay, th.acc, { width: w, label: sig(Math.abs(st.power), 3) + " W", ly: -14 });
        else K.arrow(ctx, ax + 70, ay, ax, ay, th.acc, { width: w, label: sig(Math.abs(st.power), 3) + " W", lx: 76, ly: -14 });
      }
      // heat ledger: lost by the hot side vs gained by the cold side
      var bx = 720, by = 360, hmax = 230, Qf = Math.max(st.book.Q, 1), Qn = Math.abs(st.HB0 - st.HB);
      var lost = Qn, gained = Qn;
      [[bx, lost, th.fric, "lost by hot"], [bx + 110, gained, th.disp, "gained by cold"]].forEach(function (b) {
        var hgt = hmax * Math.min(1.05, b[1] / Qf);
        ctx.fillStyle = K.alpha(b[2], 0.8); ctx.fillRect(b[0], by - hgt, 70, hgt);
        K.label(ctx, b[3], b[0] + 35, by + 20, th.ink, { font: "600 11px 'JetBrains Mono', monospace" });
        K.label(ctx, sig(b[1], 3) + " J", b[0] + 35, by - hgt - 4, b[2]);
      });
      ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 10, by - hmax); ctx.lineTo(bx + 190, by - hmax); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "formula: " + sig(st.book.Q, 3) + " J", bx + 90, by - hmax - 6, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
    }
    var bubbles = [];
    function drawHeat(ctx, p) {
      var s = state(st.S, st.H), x0 = 320, x1 = 520, top = 140, bot = 370, liquid = st.S.mw - s.ice - s.steam;
      // hot plate glows with the power
      ctx.fillStyle = th.ground; ctx.fillRect(x0 - 40, bot + 4, x1 - x0 + 80, 22);
      ctx.fillStyle = "rgba(255,80,30," + (st.done || !sim.running ? 0.25 : 0.35 + 0.5 * p.P / 2000) + ")"; ctx.fillRect(x0 - 30, bot + 4, x1 - x0 + 60, 8);
      K.label(ctx, "heater " + p.P + " W", (x0 + x1) / 2, bot + 44, th.acc);
      var maxH = bot - top - 20, scale = maxH / Math.max(st.S.mw * 1000, 1) * 0.8;
      var lh = liquid * 1000 * scale, ih = s.ice * 1000 * scale * 1.09;
      ctx.fillStyle = tempCol(s.T, 0.8); ctx.fillRect(x0, bot - lh, x1 - x0, lh);
      // ice cubes stacked on (and floating in) the water
      var n = Math.ceil(s.ice / st.S.mw * 12), side = Math.sqrt(ih * (x1 - x0) / Math.max(n, 1)) * 0.95;
      for (var i = 0; i < n; i++) {
        var cx = x0 + 8 + (i % 4) * ((x1 - x0 - 16) / 4), row = Math.floor(i / 4), cy = bot - lh - (row + 0.6) * side;
        var sd = Math.min(side, (x1 - x0 - 16) / 4 - 4);
        ctx.fillStyle = "rgba(210,235,255,0.92)"; ctx.strokeStyle = "#7fb0e0"; ctx.lineWidth = 1.2;
        ctx.fillRect(cx, cy, sd, sd); ctx.strokeRect(cx, cy, sd, sd);
        if (s.T < 0) { ctx.fillStyle = tempCol(s.T, 0.3); ctx.fillRect(cx, cy, sd, sd); }
      }
      // bubbles while boiling, steam above
      if (s.T >= 100 && liquid > 1e-6 && sim.running) bubbles.push({ x: x0 + 10 + Math.random() * (x1 - x0 - 20), y: bot - 4, r: 2 + Math.random() * 3 });
      bubbles = bubbles.filter(function (b) { b.y -= 3; return b.y > bot - lh; });
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.2;
      bubbles.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); });
      if (s.steam > 0) {
        ctx.fillStyle = K.alpha(th.muted, 0.12 + 0.3 * s.steam / st.S.mw);
        for (var k = 0; k < 6; k++) { var yy = top - 20 - ((st.t * 20 + k * 30) % 120); ctx.beginPath(); ctx.arc(x0 + 30 + k * 30, yy, 16 + k % 3 * 5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2); cupShape(ctx, x0, x1, top, bot); ctx.stroke();
      K.label(ctx, K.fmt(s.T, 1) + " °C", x1 + 30, top + 30, th.ink, { align: "left", bg: true });
      K.label(ctx, s.T < 0 ? "warming the ice" : s.ice > 0 ? "melting: T stuck at 0 °C" : s.T < 100 ? "warming the water" : s.steam < st.S.mw ? "boiling: T stuck at 100 °C" : "heating the steam", x1 + 30, top + 60, th.acc, { align: "left" });
      // phase bar
      var bx = 700, bw = 240, by = 300, tot = st.S.mw;
      [[s.ice, "rgba(150,200,245,0.95)", "ice"], [liquid, th.disp, "water"], [s.steam, th.muted, "steam"]].reduce(function (x, seg) {
        var w = bw * seg[0] / tot; ctx.fillStyle = seg[1]; ctx.fillRect(x, by, w, 26);
        return x + w;
      }, bx);
      ctx.strokeStyle = th.line; ctx.strokeRect(bx, by, bw, 26);
      K.label(ctx, "ice " + K.fmt(s.ice * 1000, 1) + " g · water " + K.fmt(liquid * 1000, 1) + " g · steam " + K.fmt(s.steam * 1000, 1) + " g", bx + bw / 2, by + 50, th.ink, { font: "600 11px 'JetBrains Mono', monospace" });
      K.label(ctx, "time-lapse ×" + st.lapse + " · t = " + K.fmt(st.t, 1) + " s", bx + bw / 2, by - 10, th.muted, { font: "600 12px 'JetBrains Mono', monospace" });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), caps3 = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "T (°C)", xMax: 5, xAuto: true, color: th.disp });
    var g2 = new K.Graph(cv[1], { yLabel: "Q (J)", xMax: 5, xAuto: true, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "mass (g)", xMax: 5, xAuto: true, yMin: 0, color: th.disp });
    var CAP = {
      mix: ['<b class="c-disp">bath</b> and <b class="c-app">item</b> temperatures · dashed: the formula\'s final $T_f$',
        '<b class="c-acc">heat that has crossed</b> · dashed: $|Q|$ from heat lost = heat gained', '<b class="c-disp">ice in the cup</b> · dashed: the formula\'s ice left'],
      heat: ['<b class="c-disp">heating curve T–t</b> · flat while melting and boiling', '<b class="c-acc">T vs heat supplied</b> · slopes $1/mc$, plateaus $mL$',
        '<b class="c-disp">ice, water and steam</b> · dashed: from $mL/P$']
    };
    function theory() {
      var p = params();
      [g1, g2, g3].forEach(function (g) { g.clear(); });
      CAP[p.mode].forEach(function (c, i) { caps3[i].innerHTML = K.md(c); });
      if (st.mix) {
        var tEnd = 8, b = st.book;
        [g1, g2, g3].forEach(function (g) { g.o.xMax = tEnd; g.o.xLabel = "t (s)"; });
        g2.o.yLabel = "Q (J)"; g1.o.yLabel = "T (°C)";
        g1.set("f", { points: [[0, b.Tf], [tEnd, b.Tf]], color: th.acc, dash: [5, 5], width: 1.5 });
        g2.set("f", { points: [[0, b.Q], [tEnd, b.Q]], color: th.acc, dash: [5, 5], width: 1.5 });
        g3.set("f", { points: [[0, b.ice * 1000], [tEnd, b.ice * 1000]], color: th.disp, dash: [5, 5], width: 1.5 });
      } else {
        var c = st.cv;
        g1.o.xMax = g3.o.xMax = c.end; g1.o.xLabel = g3.o.xLabel = "t (s)";
        var Qend = c.end * p.P / 1000;
        g2.o.xMax = Qend; g2.o.xLabel = "Q (kJ)"; g2.o.yLabel = "T (°C)";
        g1.set("f", { points: c.pts, color: th.disp, dash: [5, 5], width: 1.5 });
        g2.set("f", { points: c.pts.map(function (q) { return [q[0] * p.P / 1000, q[1]]; }), color: th.acc, dash: [5, 5], width: 1.5 });
        // phase masses from the formula: linear in time across each plateau
        var m = p.m * 1000, ice = [], wat = [], stm = [];
        var mt = c.melt || [0, 0], bt = c.boil;
        [0, mt[0], mt[1], bt[0], bt[1], c.end].forEach(function (t) {
          var iceM = c.melt ? (t <= mt[0] ? m : t >= mt[1] ? 0 : m * (mt[1] - t) / (mt[1] - mt[0])) : 0;
          var stM = t <= bt[0] ? 0 : t >= bt[1] ? m : m * (t - bt[0]) / (bt[1] - bt[0]);
          ice.push([t, iceM]); stm.push([t, stM]); wat.push([t, m - iceM - stM]);
        });
        g3.set("fi", { points: ice, color: th.normal, dash: [5, 5], width: 1.5 });
        g3.set("fw", { points: wat, color: th.disp, dash: [5, 5], width: 1.5 });
        g3.set("fs", { points: stm, color: th.muted, dash: [5, 5], width: 1.5 });
      }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      if (st.mix) {
        g1.set("A", { points: rec.map(function (r) { return [r.t, r.TA]; }), color: th.disp, width: 2.5, dot: true });
        g1.set("B", { points: rec.map(function (r) { return [r.t, r.TB]; }), color: th.app, width: 2.5, dot: true });
        g2.set("Q", { points: rec.map(function (r) { return [r.t, r.Q]; }), color: th.acc, width: 2.5, dot: true });
        g3.set("ice", { points: rec.map(function (r) { return [r.t, r.ice]; }), color: th.disp, width: 2.5, dot: true });
        P.hud.innerHTML = "<span>bath " + K.fmt(rec[rec.length - 1].TA, 2) + " °C</span><span>item " + K.fmt(rec[rec.length - 1].TB, 2) + " °C</span>";
        [g1, g2, g3].forEach(function (g) { if (g.series.f) g.series.f.points[1][0] = Math.max(8, st.t); });   // keep the formula line as long as the run
      } else {
        g1.set("T", { points: rec.map(function (r) { return [r.t, r.T]; }), color: th.disp, width: 2.5, dot: true });
        g2.set("T", { points: rec.map(function (r) { return [r.Q, r.T]; }), color: th.acc, width: 2.5, dot: true });
        g3.set("i", { points: rec.map(function (r) { return [r.t, r.ice]; }), color: th.normal, width: 2.5 });
        g3.set("w", { points: rec.map(function (r) { return [r.t, r.water]; }), color: th.disp, width: 2.5 });
        g3.set("s", { points: rec.map(function (r) { return [r.t, r.steam]; }), color: th.muted, width: 2.5 });
        var l = rec[rec.length - 1];
        P.hud.innerHTML = "<span>T = " + K.fmt(l.T, 1) + " °C</span><span>t = " + K.fmt(st.t, 1) + " s (×" + st.lapse + ")</span>";
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLbl = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [{ id: "a", label: "" }, { id: "b", label: "" }, { id: "c", label: "" }, { id: "d", label: "" }, { id: "e", label: "" }, { id: "f", label: "" }]);
    var rl = P.readouts.querySelectorAll(".readout > span"), rb = P.readouts.querySelectorAll(".readout > b");
    function R(i, label, cls, value, note) { rl[i].textContent = label; rb[i].className = cls || ""; setR("abcdef"[i], value, note); }
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function eq(i, label, s) { eqLbl[i].textContent = label; eqEls[i].parentNode.hidden = !label; if (label) K.tex(eqEls[i], s); }
    function renderMaths() { var p = params(); if (st.mix) mathsMix(p); else mathsHeat(p); }
    function mathsMix(p) {
      var b = st.book, A = state(st.A, st.HA), Bs = state(st.B, st.HB), Cb = b.Cb;
      eq(0, "Heat capacity of the calorimeter side", "C = m_w c_w + m_c c_c = " + B(p.mw, 3) + B(CW, 0) + " + " + B(p.mc, 3) + B(CCAN, 0) + " = \\mathbf{" + K.fmt(Cb, 0) + "}\\ \\text{J/K}");
      if (p.item === "ice") {
        eq(1, "Can the water melt all the ice?", "\\underbrace{C(T_w - 0)}_{\\text{available}} = " + K.fmt(b.Qavail, 0) + "\\ \\text{J} \\quad \\underbrace{m c_i (0 - T_i) + m L_f}_{\\text{needed}} = " + K.fmt(b.Qwarm, 0) + " + " + K.fmt(b.Qmelt, 0) + " = " + K.fmt(b.Qwarm + b.Qmelt, 0) + "\\ \\text{J}");
        if (b.kind === "melt") {
          eq(2, "Yes: heat lost = heat gained", "C(T_w - T_f) = m c_i(0 - T_i) + mL_f + m c_w T_f \\Rightarrow T_f = \\frac{" + K.fmt(b.Qavail - b.Qwarm - b.Qmelt, 0) + "}{" + K.fmt(Cb, 0) + " + " + K.fmt(p.mi * CW, 0) + "} = \\mathbf{" + K.fmt(b.Tf, 2) + "}\\ ^\\circ\\text{C}");
          eq(3, "Ice left", "\\mathbf{0}\\ \\text{g: it all melts}");
        } else if (b.kind === "ice0") {
          eq(2, "No: it stops at 0 °C", "T_f = \\mathbf{0}\\ ^\\circ\\text{C}");
          eq(3, "Ice that melts, and ice left", "m_{melt} = \\frac{" + K.fmt(b.Qavail, 0) + " - " + K.fmt(b.Qwarm, 0) + "}{" + K.fmt(LF, 0) + "} = " + K.fmt((p.mi - b.ice) * 1000, 1) + "\\ \\text{g},\\quad \\text{left} = \\mathbf{" + K.fmt(b.ice * 1000, 1) + "}\\ \\text{g}");
        } else {
          eq(2, "Not even enough to warm the ice to 0 °C: the water freezes", "T_f = \\mathbf{" + K.fmt(b.Tf, 2) + "}\\ ^\\circ\\text{C}");
          eq(3, "Ice at the end", "\\mathbf{" + K.fmt(b.ice * 1000, 1) + "}\\ \\text{g}");
        }
      } else {
        var c = p.item === "water" ? CW : METALS[p.metal].c;
        eq(1, "Heat capacity of what you dropped in", "C_i = mc = " + B(p.mi, 3) + B(c, 0) + " = \\mathbf{" + K.fmt(b.Ci, 0) + "}\\ \\text{J/K}");
        if (b.kind === "boil") {
          eq(2, "Too much heat: the water boils", "T_f = \\mathbf{100}\\ ^\\circ\\text{C}");
          eq(3, "Steam made", "m_s = \\frac{C(T_w - 100) + C_i(T_i - 100)}{L_v} = \\mathbf{" + K.fmt(b.steam * 1000, 1) + "}\\ \\text{g}");
        } else {
          eq(2, "Heat lost = heat gained", "C_i(T_i - T_f) = C(T_f - T_w) \\Rightarrow T_f = \\frac{" + K.fmt(b.Ci, 0) + B(p.Ti, 0) + " + " + K.fmt(Cb, 0) + B(p.Tw, 0) + "}{" + K.fmt(b.Ci, 0) + " + " + K.fmt(Cb, 0) + "} = \\mathbf{" + K.fmt(b.Tf, 2) + "}\\ ^\\circ\\text{C}");
          eq(3, "Heat that crosses", "Q = C|T_f - T_w| = " + K.fmt(Cb, 0) + "\\times" + K.fmt(Math.abs(b.Tf - p.Tw), 2) + " = \\mathbf{" + sig(b.Q, 4) + "}\\ \\text{J}");
        }
      }
      var ice = (A.ice + Bs.ice) * 1000;
      R(0, "bath temperature", "c-disp", K.fmt(A.T, 2) + " °C");
      R(1, "item temperature", "c-app", K.fmt(Bs.T, 2) + " °C");
      R(2, "final, formula", "", K.fmt(b.Tf, 2) + " °C", st.done ? "measured " + K.fmt(A.T, 2) : "");
      R(3, "ice in the cup", "", K.fmt(ice, 1) + " g", "formula " + K.fmt(b.ice * 1000, 1) + " g at the end");
      R(4, "heat crossed", "c-acc", sig(Math.abs(st.HB0 - st.HB), 4) + " J", "formula " + sig(b.Q, 4) + " J");
      R(5, "heat flow now", "c-acc", sig(Math.abs(st.power), 3) + " W", "∝ temperature difference");
    }
    function mathsHeat(p) {
      var c = st.cv, s = state(st.S, st.H), m = p.m, mk = st.marks;
      eq(0, "Warming: Q = mcΔT", p.T0 <= 0 ? "t_{ice} = \\frac{m c_i (0 - T_0)}{P} = \\frac{" + B(m, 3) + B(CI, 0) + B(-p.T0, 0) + "}{" + p.P + "} = \\mathbf{" + K.fmt(c.melt[0], 2) + "}\\ \\text{s}"
        : "t = \\frac{m c_w (100 - T_0)}{P} = \\frac{" + B(m, 3) + B(CW, 0) + B(100 - p.T0, 0) + "}{" + p.P + "} = \\mathbf{" + K.fmt(c.boil[0], 2) + "}\\ \\text{s}");
      eq(1, p.T0 <= 0 ? "Melting plateau: Q = mL_f" : "", "t_{melt} = \\frac{mL_f}{P} = \\frac{" + B(m, 3) + "(3.36\\times10^5)}{" + p.P + "} = \\mathbf{" + K.fmt(m * LF / p.P, 2) + "}\\ \\text{s}");
      eq(2, "Boiling plateau: Q = mL_v", "t_{boil} = \\frac{mL_v}{P} = \\frac{" + B(m, 3) + "(2.268\\times10^6)}{" + p.P + "} = \\mathbf{" + K.fmt(m * LV / p.P, 2) + "}\\ \\text{s}");
      eq(3, "Slope while the water warms", "\\frac{dT}{dt} = \\frac{P}{mc_w} = \\frac{" + p.P + "}{" + B(m, 3) + B(CW, 0) + "} = \\mathbf{" + K.fmt(p.P / (m * CW), 2) + "}\\ ^\\circ\\text{C/s}");
      var melt = mk.meltStart !== undefined && mk.meltEnd !== undefined ? mk.meltEnd - mk.meltStart : null;
      var boil = mk.boilStart !== undefined && mk.boilEnd !== undefined ? mk.boilEnd - mk.boilStart : null;
      R(0, "temperature", "c-disp", K.fmt(s.T, 1) + " °C", s.ice > 0 && s.T === 0 ? "melting" : s.T === 100 && s.steam < m ? "boiling" : "");
      R(1, "heat supplied", "c-acc", K.fmt((st.H - st.H0) / 1000, 2) + " kJ", "Q = Pt");
      R(2, "melting took", "", p.T0 > 0 ? "—" : melt != null ? K.fmt(melt, 2) + " s" : "…", p.T0 > 0 ? "starts as water" : "formula " + K.fmt(m * LF / p.P, 2) + " s");
      R(3, "boiling took", "", boil != null ? K.fmt(boil, 2) + " s" : "…", "formula " + K.fmt(m * LV / p.P, 2) + " s");
      R(4, "ice · water · steam", "", K.fmt(s.ice * 1000, 1) + " · " + K.fmt((m - s.ice - s.steam) * 1000, 1) + " · " + K.fmt(s.steam * 1000, 1) + " g");
      R(5, "time-lapse", "", "×" + st.lapse, "model time " + K.fmt(st.t, 1) + " s");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Heat flows from hot to cold until the temperatures match. In an insulated calorimeter nothing escapes, so <b>heat lost by the hot side = heat gained by the cold side</b>. Warming takes $Q = mc\\Delta T$; changing phase takes $Q = mL$ at a fixed temperature.</p>" +
      "<p>That's why a steady heater draws a staircase: sloped while a single phase warms (slope $P/mc$), flat while it melts ($mL_f/P$) or boils ($mL_v/P$). With $L_f = 336$ J/g and $L_v = 2268$ J/g, boiling takes far longer than melting.</p>" +
      '<div class="trap"><b>JEE trap: check whether all the ice melts before you write T<sub>f</sub>.</b> Compare the heat the water can give up cooling to 0 °C with the heat needed to warm the ice to 0 °C and melt it. If it falls short, the answer is 0 °C with ice left over, and the "heat lost = heat gained" equation with an unknown $T_f$ gives nonsense.</div>');
    function apply(s) {
      mode = s.mode; segSet(modeSeg, mode); show();
      if (mode === "mix") {
        item = s.item; segSet(itemSeg, item); if (s.metal) { metal = s.metal; segSet(metalSeg, metal); }
        itemT[item] = s.Ti; itemRange();
        mwS.set(s.mw); TwS.set(s.Tw); mcS.set(s.mc || 0); miS.set(s.mi);
      } else { mS.set(s.m); T0S.set(s.T0); PS.set(s.P); }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "mixing water", setup: { mode: "mix", item: "water", mw: 300, Tw: 20, mc: 0, mi: 200, Ti: 80 }, watch: "Predict T_f, then drop the hot water in",
        q: "200 g of water at 80 °C is mixed with 300 g of water at 20 °C in a container of negligible heat capacity. What is the final temperature?",
        options: ["50 °C", "44 °C", "56 °C", "36 °C"], answer: 1,
        explain: "Heat lost = heat gained: $0.2c(80 - T_f) = 0.3c(T_f - 20)$, so $T_f = (16 + 6)/0.5 = 44$ °C. It's closer to 20 °C because there's more cold water. 50 °C is the plain average; 56 °C swaps the masses." },
      { level: "medium", tag: "metal in a calorimeter", setup: { mode: "mix", item: "metal", metal: "alu", mw: 500, Tw: 20, mc: 100, mi: 200, Ti: 150 }, watch: "Predict T_f, then drop the block in",
        q: "A 200 g aluminium block ($c = 900$ J/kg·K) at 150 °C is dropped into 500 g of water at 20 °C in a 100 g copper calorimeter ($c = 390$ J/kg·K). What is the final temperature? ($c_w = 4200$ J/kg·K)",
        options: ["30.1 °C", "30.3 °C", "28.7 °C", "85.0 °C"], answer: 0,
        hints: ["The can starts at 20 °C too and warms with the water, so add its $mc$ to the cold side.", "$T_f = \\dfrac{\\sum mcT}{\\sum mc}$ over the block, the water and the can."],
        explain: "Cold side: $0.5(4200) + 0.1(390) = 2139$ J/K at 20 °C. Block: $0.2(900) = 180$ J/K at 150 °C. $T_f = (2139 \\times 20 + 180 \\times 150)/2319 = 30.1$ °C. Leaving out the can gives 30.3 °C; treating the can as extra water gives 28.7 °C." },
      { level: "hard", tag: "ice that doesn't all melt", setup: { mode: "mix", item: "ice", mw: 200, Tw: 30, mc: 0, mi: 100, Ti: -10 }, watch: "Predict the final state, then drop the ice in and read the ice left",
        q: "100 g of ice at −10 °C is put into 200 g of water at 30 °C (no heat lost to the container). Take $c_{ice} = 2100$, $c_w = 4200$ J/kg·K and $L_f = 3.36\\times10^5$ J/kg. What is the final state?",
        options: ["0 °C, with about 31 g of ice left", "0 °C, with about 25 g of ice left", "22 °C, all the ice melted", "0 °C, all the ice just melted"], answer: 0,
        hints: ["Find the most heat the water can give: cooling 200 g from 30 °C to 0 °C.", "Spend it first warming the ice to 0 °C, then on melting. Whatever ice is left can't melt."],
        explain: "The water can give $0.2(4200)(30) = 25\\,200$ J. Warming the ice to 0 °C takes $0.1(2100)(10) = 2100$ J, leaving 23 100 J, which melts $23\\,100/336\\,000 = 68.75$ g. So 31.25 g of ice is left and everything sits at 0 °C. Forgetting to warm the ice first gives 25 g; ignoring latent heat gives 22 °C." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, transOpts);
    reset();

    if (location.hostname === "localhost") window.__lab_calorimetry = {
      apply: apply, params: params, textbook: textbook,
      state: function () {
        if (st.mix) { var a = state(st.A, st.HA), b = state(st.B, st.HB); return { done: st.done, TA: a.T, TB: b.T, ice: a.ice + b.ice, steam: a.steam + b.steam, Q: Math.abs(st.HB0 - st.HB), book: st.book, t: st.t }; }
        var s = state(st.S, st.H); return { done: st.done, T: s.T, ice: s.ice, steam: s.steam, marks: st.marks, lapse: st.lapse, t: st.t, cv: st.cv };
      }
    };
    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_calorimetry) delete window.__lab_calorimetry; };
  }
})();
