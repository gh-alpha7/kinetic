/* Ray optics, lab 1: reflection, refraction and total internal reflection, apparent depth, and a glass slab.
   Rays are traced with the vector form of Snell's law; the textbook formulas are only used for the dashed curves. */
(function () {
  "use strict";
  var DEG = Math.PI / 180;
  var NAMES = [[1, "air"], [1.33, "water"], [1.5, "glass"], [1.65, "flint glass"], [2.42, "diamond"]];

  var lab = {
    id: "refraction", chapter: "rays", title: "Reflection, refraction & TIR", short: "Snell's law, critical angle, apparent depth",
    lede: "Drag the torch and watch one beam split in two at the boundary. Send it from glass into air at a steep enough angle and the escaping ray vanishes completely.",
    tries: [
      { id: "critical", title: "Make the refracted ray skim the surface",
        text: "With a denser medium on top ($n_1 \\gt n_2$), find the angle where the refracted ray runs along the boundary.",
        why: "That's the critical angle: $\\theta_2 = 90°$, so $n_1\\sin\\theta_c = n_2$ and $\\sin\\theta_c = n_2/n_1$. For water into air it's $48.8°$, for glass into air $41.8°$." },
      { id: "tir", title: "Trap the light",
        text: "Push the angle past the critical angle so no light gets out.",
        why: "Snell's law would need $\\sin\\theta_2 \\gt 1$, which no angle has. All the light reflects: total internal reflection. Optical fibres and the sparkle of diamonds ($\\theta_c = 24.4°$) both rely on it." },
      { id: "slant", title: "Look at the fish from a slant",
        text: "In apparent depth, view from at least 40° and compare the apparent depth with $d/n$.",
        why: "$d' = d/n$ is only for looking straight down. At a slant the image rises further: $d' = \\dfrac{d\\cos^3\\beta}{n\\cos^3\\alpha}$, which is why a pool looks shallower the farther away you stand." },
      { id: "slab", title: "Double the slab, double the shift",
        text: "With the glass slab, keep the angle and $n$ fixed and compare the shift at two thicknesses, one twice the other.",
        why: "$d = t\\sin(\\theta_1 - \\theta_2)/\\cos\\theta_2$ is proportional to $t$: the angles depend only on $n$ and $\\theta_1$. The ray always comes out parallel to the way it went in." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- vector optics ---------- */
  function norm(x, y) { var l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
  // d: unit direction, nr: unit normal pointing back towards where the light came from
  function refract(d, nr, n1, n2) {
    var c = -(d.x * nr.x + d.y * nr.y), eta = n1 / n2, k = 1 - eta * eta * (1 - c * c);
    if (k < 0) return null;
    var s = eta * c - Math.sqrt(k);
    return { x: eta * d.x + s * nr.x, y: eta * d.y + s * nr.y, cos: Math.sqrt(k) };
  }
  function reflect(d, nr) { var c = -(d.x * nr.x + d.y * nr.y); return { x: d.x + 2 * c * nr.x, y: d.y + 2 * c * nr.y }; }
  // share of the light reflected (unpolarised Fresnel), 1 for total internal reflection
  function fresnel(ci, n1, n2) {
    var si2 = (n1 / n2) * (n1 / n2) * (1 - ci * ci);
    if (si2 >= 1) return 1;
    var ct = Math.sqrt(1 - si2);
    var rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
    return (rs * rs + rp * rp) / 2;
  }
  function meet(p1, d1, p2, d2) {      // where two lines cross
    var den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 1e-14) return null;
    var s = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
    return { x: p1.x + s * d1.x, y: p1.y + s * d1.y };
  }
  function name(n) {
    for (var i = 0; i < NAMES.length; i++) if (Math.abs(n - NAMES[i][0]) < 0.006) return NAMES[i][1];
    return "";
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520;
    var VIEW = { snell: { ppm: 10, o: { x: 500, y: 260 } }, depth: { ppm: 12, o: { x: 380, y: 235 } }, slab: { ppm: 12, o: { x: 470, y: 200 } } };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 10, origin: { x: 500, y: 260 }, g: 0, gridStep: 1, gridMajor: 5, labels: false });

    // the state; sliders only display it, so practice setups can use exact values like 4/3 and √3
    var S = { mode: "snell", n1: 1, n2: 1.5, th1: 40, d: 12, beta: 0, t: 6 };

    /* ---------- controls ---------- */
    function sl(o, key) { o.onInput = function (v) { S[key] = v; changed(); }; return K.slider(o); }
    var n1S = sl({ label: "Top medium $n_1$", min: 1, max: 2.42, step: 0.01, value: S.n1 }, "n1");
    var n2S = sl({ label: "Bottom medium $n_2$", min: 1, max: 2.42, step: 0.01, value: S.n2 }, "n2");
    var thS = sl({ label: "Angle of incidence $\\theta_1$", unit: "°", min: 0, max: 89.5, step: 0.5, value: S.th1,
      hint: "Or drag the torch on the stage." }, "th1");
    var dS = sl({ label: "Real depth $d$", unit: "cm", min: 2, max: 20, step: 0.5, value: S.d, hint: "Or drag the fish up and down." }, "d");
    var bS = sl({ label: "Viewing angle $\\beta$ (from vertical)", unit: "°", min: 0, max: 75, step: 1, value: S.beta,
      hint: "Or drag the eye." }, "beta");
    var tS = sl({ label: "Slab thickness $t$", unit: "cm", min: 1, max: 15, step: 0.5, value: S.t }, "t");
    var modeSeg = K.seg([{ label: "Snell & TIR", value: "snell" }, { label: "Apparent depth", value: "depth" }, { label: "Glass slab", value: "slab" }], "snell",
      function (v) { setMode(v); }, "Experiment");
    P.controls.innerHTML = "<h3>Experiment</h3>";
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>Media</h3>"));
    [n1S, n2S].forEach(function (s) { P.controls.appendChild(s.el); });
    var presets = K.h('<div class="row"></div>');
    [["Air → glass", 1, 1.5], ["Glass → air", 1.5, 1], ["Water → air", 1.33, 1], ["Air → water", 1, 1.33], ["Diamond → air", 2.42, 1]].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p[0] + "</button>");
      b.addEventListener("click", function () { S.n1 = p[1]; S.n2 = p[2]; syncSliders(); changed(); });
      presets.appendChild(b);
    });
    P.controls.appendChild(presets);
    P.controls.appendChild(K.h("<h3>The ray</h3>"));
    [thS, dS, bS, tS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-ten"><i></i>incident light</span><span class="c-app"><i></i>reflected</span><span class="c-disp"><i></i>refracted</span>' +
      '<span class="c-grav"><i></i>image</span><span style="color:var(--muted)"><i></i>normal</span></div>'));

    function syncSliders() { n1S.set(S.n1); n2S.set(S.n2); thS.set(S.th1); dS.set(S.d); bS.set(S.beta); tS.set(S.t); }
    function showSliders() {
      thS.el.hidden = S.mode === "depth";
      dS.el.hidden = bS.el.hidden = S.mode !== "depth";
      tS.el.hidden = S.mode !== "slab";
      presets.hidden = S.mode !== "snell";
    }
    function setMode(m) {
      S.mode = m;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); });
      if (m === "depth" && S.n2 <= S.n1) { S.n1 = 1; S.n2 = 4 / 3; }
      if (m === "slab" && S.n2 <= S.n1) { S.n1 = 1; S.n2 = 1.5; }
      sim.ppm = VIEW[m].ppm; sim.origin = { x: VIEW[m].o.x, y: VIEW[m].o.y };
      sweep = null; sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      syncSliders(); showSliders(); buildPanels(); changed();
    }

    /* ---------- the three traces ---------- */
    // Snell: a ray from the top-left hits the boundary (y = 0) at the origin.
    function traceSnell(th1, n1, n2) {
      var a = th1 * DEG, d = { x: Math.sin(a), y: -Math.cos(a) }, nr = { x: 0, y: 1 };
      var t = refract(d, nr, n1, n2), r = reflect(d, nr), R = fresnel(Math.cos(a), n1, n2);
      return { d: d, r: r, t: t, R: R, th2: t ? Math.atan2(t.x, -t.y) / DEG : null, thr: Math.atan2(r.x, r.y) / DEG,
        crit: n1 > n2 ? Math.asin(n2 / n1) / DEG : null };
    }
    // Apparent depth: a fish at (0, -d) in medium n2, seen from medium n1 above.
    function fishRay(X, d, n1, n2) {
      var dir = norm(X, d), out = refract(dir, { x: 0, y: -1 }, n2, n1);   // normal points down, back into the water
      return out ? { p: { x: X, y: 0 }, o: out } : null;
    }
    function aimX(beta, d, n1, n2) {          // where the ray to an eye at angle beta leaves the water
      var s = n1 * Math.sin(beta * DEG) / n2;
      return d * s / Math.sqrt(1 - s * s);
    }
    function traceDepth(beta, d, n1, n2) {
      var X = aimX(beta, d, n1, n2), dX = 1e-4 * Math.max(d, 1);
      var r1 = fishRay(X, d, n1, n2), r2 = fishRay(X + dX, d, n1, n2);
      var img = meet(r1.p, r1.o, r2.p, r2.o);                // back-extend a thin pencil of two traced rays
      var al = Math.atan2(X, d), b = Math.atan2(r1.o.x, r1.o.y);
      return { X: X, img: img, dApp: -img.y, out: r1.o, alpha: al / DEG, beta: b / DEG,
        oblique: d * Math.pow(Math.cos(b), 3) / ((n2 / n1) * Math.pow(Math.cos(al), 3)) };
    }
    // Slab: top face y = 0, bottom face y = -t.
    function traceSlab(th1, t, n1, n2) {
      var a = th1 * DEG, d = { x: Math.sin(a), y: -Math.cos(a) }, nr = { x: 0, y: 1 };
      var t1 = refract(d, nr, n1, n2);
      if (!t1) return { d: d, tir: true };
      var P1 = { x: t1.x * t / -t1.y, y: -t };
      var t2 = refract(t1, nr, n2, n1);
      return { d: d, t1: t1, P: P1, t2: t2, th2: Math.atan2(t1.x, -t1.y) / DEG, e: Math.atan2(t2.x, -t2.y) / DEG,
        shift: Math.abs(d.x * P1.y - d.y * P1.x), L: Math.hypot(P1.x, P1.y), R: fresnel(Math.cos(a), n1, n2) };
    }
    function formulaShift(th1, t, n1, n2) {
      var s = n1 * Math.sin(th1 * DEG) / n2;
      if (s >= 1) return null;
      var t2 = Math.asin(s);
      return t * Math.sin(th1 * DEG - t2) / Math.cos(t2);
    }
    function current() {
      if (S.mode === "snell") return traceSnell(S.th1, S.n1, S.n2);
      if (S.mode === "depth") return traceDepth(S.beta, S.d, S.n1, S.n2);
      return traceSlab(S.th1, S.t, S.n1, S.n2);
    }

    /* ---------- tries ---------- */
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    var slabSeen = [];
    function checkTries(c) {
      if (S.mode === "snell" && c.crit !== null) {
        if (Math.abs(S.th1 - c.crit) <= 0.5) tries.mark("critical");
        if (S.th1 > c.crit + 0.2) tries.mark("tir");
      }
      if (S.mode === "depth" && S.beta >= 40 && c.dApp < 0.85 * S.d * S.n1 / S.n2) tries.mark("slant");
      if (S.mode === "slab" && !c.tir) {
        var key = S.th1 + "|" + S.n1 + "|" + S.n2;
        slabSeen.forEach(function (o) {
          if (o.key !== key || o.shift < 1e-6) return;
          var rt = S.t / o.t, rs = c.shift / o.shift;
          if ((Math.abs(rt - 2) < 1e-6 || Math.abs(rt - 0.5) < 1e-6) && Math.abs(rs - rt) < 0.01 * rt) tries.mark("slab");
        });
        slabSeen.push({ key: key, t: S.t, shift: c.shift });
        if (slabSeen.length > 60) slabSeen.shift();
      }
    }

    /* ---------- pointer: drag the torch, the eye or the fish ---------- */
    var dragging = null, SRC = 24;
    function torchPos() { var a = S.th1 * DEG; return { x: -SRC * Math.sin(a), y: SRC * Math.cos(a) }; }
    function eyePos(c) { var L = 14; return { x: c.X + L * Math.sin(c.beta * DEG), y: L * Math.cos(c.beta * DEG) }; }
    sim.pointer({
      down: function (pt) {
        var m = pt.m, near = 34 / sim.ppm;
        if (S.mode === "depth") {
          var c = current(), e = eyePos(c);
          if (Math.hypot(m.x - e.x, m.y - e.y) < near * 1.4) dragging = "eye";
          else if (Math.abs(m.x) < 5 && m.y < 0) dragging = "fish";
          else if (m.y > 0) dragging = "eye";
          else return false;
        } else {
          if (m.y <= 0) return false;
          dragging = "torch";
        }
        this.drag(pt);
        return true;
      },
      drag: function (pt) {
        var m = pt.m;
        if (dragging === "torch") {
          var a = Math.atan2(-m.x, Math.max(m.y, 0.01)) / DEG;
          S.th1 = K.clamp(Math.round(a * 2) / 2, 0, 89.5);
        } else if (dragging === "eye") {
          // find the surface point whose refracted ray reaches the eye, then read off beta
          var ex = Math.max(m.x, 0), ey = Math.max(m.y, 2), lo = 0, hi = ex;
          for (var i = 0; i < 50; i++) {
            var X = (lo + hi) / 2, sa = X / Math.hypot(X, S.d), sb = (ex - X) / Math.hypot(ex - X, ey);
            if (S.n2 * sa - S.n1 * sb > 0) hi = X; else lo = X;
          }
          var sbeta = S.n2 * lo / Math.hypot(lo, S.d) / S.n1;
          S.beta = K.clamp(Math.round(Math.asin(Math.min(1, sbeta)) / DEG), 0, 75);
        } else if (dragging === "fish") {
          S.d = K.clamp(Math.round(-m.y * 2) / 2, 2, 20);
        }
        syncSliders(); changed();
      },
      up: function () { dragging = null; }
    });

    /* ---------- Play: sweep the angle and let the graphs trace themselves ---------- */
    var sweep = null;
    function startSweep() { sweep = { pts1: [], pts2: [] }; if (S.mode === "depth") S.beta = 0; else S.th1 = 0; syncSliders(); changed(true); }
    sim.on("step", function () {
      if (!sweep) return;
      var c;
      if (S.mode === "depth") {
        S.beta = Math.min(75, S.beta + 12 * K.DT);
        c = current(); sweep.pts1.push([S.beta, c.dApp]);
      } else {
        S.th1 = Math.min(89.5, S.th1 + 15 * K.DT);
        c = current();
        if (S.mode === "snell") {
          if (c.t) { sweep.pts1.push([S.th1, c.th2]); sweep.pts2.push([Math.sin(S.th1 * DEG), Math.sin(c.th2 * DEG)]); }
        } else if (!c.tir) { sweep.pts1.push([S.th1, c.shift]); sweep.pts2.push([S.th1, c.e]); }
      }
      thS.set(S.th1); bS.set(S.beta);
      var end = S.mode === "depth" ? S.beta >= 75 : S.th1 >= 89.5;
      if (end) { sim.pause(); transportUI.render(); sweep.done = true; K.flash(P.note, "Sweep done: the solid curve is what the traced rays did"); }
      changed(true);
    });

    /* ---------- drawing ---------- */
    function P2(p) { return sim.px(p.x, p.y); }
    function tint(n) { return K.alpha(th.disp, Math.min(0.32, 0.03 + (n - 1) * 0.2)); }
    // a beam: a soft line plus bright dashes flowing along it, so you can see which way the light goes
    function beam(ctx, a, b, color, op, w) {
      var A = P2(a), B = P2(b);
      ctx.save(); ctx.globalAlpha = Math.max(0.12, op); ctx.strokeStyle = color; ctx.lineCap = "round";
      ctx.lineWidth = sim.u(w || 3); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.globalAlpha = Math.max(0.2, op); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = sim.u(1.4);
      ctx.setLineDash([sim.u(6), sim.u(18)]); ctx.lineDashOffset = -(performance.now() / 1000 * 50) % sim.u(24);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.restore();
      var len = Math.hypot(B.x - A.x, B.y - A.y);
      if (len > 60) {                                    // an arrowhead at mid-way
        var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
        ctx.save(); ctx.globalAlpha = Math.max(0.2, op);
        K.arrow(ctx, mx - ux * sim.u(8), my - uy * sim.u(8), mx + ux * sim.u(8), my + uy * sim.u(8), color, { s: sim.u(1), width: 2, head: 11 });
        ctx.restore();
      }
    }
    function along(p, d, L) { return { x: p.x + d.x * L, y: p.y + d.y * L }; }
    function dashed(ctx, a, b, color, w) {
      var A = P2(a), B = P2(b);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sim.u(w || 1.5); ctx.setLineDash([sim.u(5), sim.u(5)]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.restore();
    }
    function arc(ctx, c, from, to, r, color, text) {   // angles in canvas radians
      var C = P2(c);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.arc(C.x, C.y, sim.u(r), Math.min(from, to), Math.max(from, to)); ctx.stroke(); ctx.restore();
      var mid = (from + to) / 2;
      K.label(ctx, text, C.x + Math.cos(mid) * sim.u(r + 34), C.y + Math.sin(mid) * sim.u(r + 26) + sim.u(6), color, { s: sim.u(1) });
    }
    function mediumLabel(ctx, n, x, y, align) {
      var nm = name(n);
      K.label(ctx, "n = " + K.fmt(n, 2) + (nm ? " (" + nm + ")" : ""), x, y, th.muted, { s: sim.u(1), align: align || "left" });
    }
    function torch(ctx, p, dir) {
      var c = P2(p), a = Math.atan2(-dir.y, dir.x);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a);
      ctx.fillStyle = th.body; ctx.fillRect(-sim.u(30), -sim.u(7), sim.u(30), sim.u(14));
      ctx.fillStyle = th.ten; ctx.fillRect(-sim.u(4), -sim.u(9), sim.u(6), sim.u(18));
      ctx.restore();
    }

    sim.on("under", function (ctx) {
      var v = sim.view(), y0 = sim.px(0, 0).y;
      if (S.mode === "snell") {
        ctx.fillStyle = tint(S.n1); ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, y0 - v.y0);
        ctx.fillStyle = tint(S.n2); ctx.fillRect(v.x0, y0, v.x1 - v.x0, v.y1 - y0);
      } else if (S.mode === "depth") {
        ctx.fillStyle = tint(S.n1); ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, y0 - v.y0);
        ctx.fillStyle = th.water; ctx.fillRect(v.x0, y0, v.x1 - v.x0, v.y1 - y0);
        ctx.fillStyle = th.bank; ctx.fillRect(v.x0, sim.px(0, -S.d - 1.2).y, v.x1 - v.x0, v.y1);
      } else {
        ctx.fillStyle = tint(S.n1); ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
        var bot = sim.px(0, -S.t).y;
        ctx.fillStyle = K.alpha(th.normal, 0.18); ctx.fillRect(v.x0 + 60, y0, v.x1 - v.x0 - 120, bot - y0);
        ctx.strokeStyle = K.alpha(th.normal, 0.7); ctx.lineWidth = sim.u(1.5); ctx.strokeRect(v.x0 + 60, y0, v.x1 - v.x0 - 120, bot - y0);
      }
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(v.x0, y0); ctx.lineTo(v.x1, y0); ctx.stroke();
    });

    sim.on("over", function (ctx) {
      var c = current(), O = { x: 0, y: 0 };
      if (S.mode === "snell") drawSnell(ctx, c, O);
      else if (S.mode === "depth") drawDepth(ctx, c);
      else drawSlab(ctx, c, O);
    });

    function drawSnell(ctx, c, O) {
      var v = sim.view(), L = 60, top = sim.m(0, v.y0).y;
      dashed(ctx, { x: 0, y: top }, { x: 0, y: -L }, th.muted, 1.2);
      if (c.crit !== null) {             // the escape cone: only light inside it gets out
        var s = Math.sin(c.crit * DEG), co = Math.cos(c.crit * DEG);
        dashed(ctx, O, { x: -L * s, y: L * co }, K.alpha(th.ten, 0.45), 1);
        dashed(ctx, O, { x: L * s, y: L * co }, K.alpha(th.ten, 0.45), 1);
        var cp = sim.px(L * 0.42 * s, L * 0.42 * co);
        K.label(ctx, "θc = " + K.fmt(c.crit, 1) + "°", cp.x + sim.u(8), cp.y, th.ten, { s: sim.u(1), align: "left", bg: true });
      }
      var src = torchPos();
      beam(ctx, src, O, th.ten, 1, 3.5);
      beam(ctx, O, along(O, c.r, L), th.app, c.R, 3);
      if (c.t) beam(ctx, O, along(O, c.t, L), th.disp, 1 - c.R, 3.5);
      torch(ctx, src, c.d);
      var up = -Math.PI / 2, dn = Math.PI / 2;
      arc(ctx, O, up, up - S.th1 * DEG, 46, th.ten, "θ₁ " + K.fmt(S.th1, 1) + "°");
      arc(ctx, O, up, up + c.thr * DEG, 30, th.app, "θr");
      if (c.t) arc(ctx, O, dn, dn - c.th2 * DEG, 46, th.disp, "θ₂ " + K.fmt(c.th2, 1) + "°");
      var Op = P2(O);
      mediumLabel(ctx, S.n1, v.x0 + sim.u(12), Op.y - sim.u(10));
      mediumLabel(ctx, S.n2, v.x0 + sim.u(12), Op.y + sim.u(26));
      if (!c.t) K.label(ctx, "total internal reflection: no light gets out", Op.x + sim.u(20), Op.y + sim.u(60), th.app, { s: sim.u(1), align: "left", bg: true });
      else K.label(ctx, Math.round(c.R * 100) + "% reflected · " + Math.round((1 - c.R) * 100) + "% refracted", v.x1 - sim.u(12), v.y1 - sim.u(10), th.muted, { s: sim.u(1), align: "right" });
      if (!sweep && !dragging) K.label(ctx, "drag the torch", P2(src).x + sim.u(16), P2(src).y - sim.u(14), th.muted, { s: sim.u(1), align: "left" });
    }

    function drawFish(ctx, p, color, op) {
      var c = P2(p), s = sim.u(1) * 1.1;
      ctx.save(); ctx.globalAlpha = op; ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 22 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x - 18 * s, c.y); ctx.lineTo(c.x - 34 * s, c.y - 10 * s); ctx.lineTo(c.x - 34 * s, c.y + 10 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = th["canvas-bg"]; ctx.beginPath(); ctx.arc(c.x + 12 * s, c.y - 2 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawDepth(ctx, c) {
      var F = { x: 0, y: -S.d }, e = eyePos(c), v = sim.view();
      dashed(ctx, { x: 0, y: 2 }, { x: 0, y: -S.d - 1 }, th.muted, 1);
      // a visible pencil of light: two rays a little either side of the one that reaches the eye
      [-2.5, 2.5].forEach(function (db) {
        var bb = Math.max(-75, Math.min(80, c.beta + db)), X = aimX(Math.abs(bb), S.d, S.n1, S.n2) * (bb < 0 ? -1 : 1);
        var r = fishRay(X, S.d, S.n1, S.n2), Lr = Math.hypot(e.x - X, e.y) * 1.02;
        beam(ctx, F, r.p, th.ten, 0.9, 2.5);
        beam(ctx, r.p, along(r.p, r.o, Lr), th.disp, 0.9, 2.5);
        dashed(ctx, r.p, c.img, K.alpha(th.grav, 0.8), 1.2);
      });
      drawFish(ctx, c.img, th.grav, 0.45);
      drawFish(ctx, F, th.acc, 1);
      // the eye
      var E = P2(e), a = Math.atan2(c.out.y, -c.out.x);
      ctx.save(); ctx.translate(E.x, E.y); ctx.rotate(-a + Math.PI);
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.ellipse(0, 0, sim.u(16), sim.u(9), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(-sim.u(6), 0, sim.u(4.5), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // depth rulers
      var rx = sim.m(v.x0, 0).x + 4, s0 = sim.px(rx, 0), s1 = sim.px(rx, -S.d), s2 = sim.px(rx + 3, -c.dApp);
      ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
      ctx.strokeStyle = th.grav; ctx.beginPath(); ctx.moveTo(s2.x, s0.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      K.label(ctx, "real d = " + K.fmt(S.d, 1) + " cm", s1.x - sim.u(4), s1.y + sim.u(18), th.acc, { s: sim.u(1), align: "left", bg: true });
      K.label(ctx, "apparent d' = " + K.fmt(c.dApp, 2) + " cm", s2.x + sim.u(8), s2.y + sim.u(4), th.grav, { s: sim.u(1), align: "left", bg: true });
      mediumLabel(ctx, S.n1, v.x1 - sim.u(12), sim.px(0, 0).y - sim.u(10), "right");
      mediumLabel(ctx, S.n2, v.x1 - sim.u(12), sim.px(0, 0).y + sim.u(26), "right");
      if (!dragging && !sweep) K.label(ctx, "drag the eye, or the fish", E.x + sim.u(24), E.y, th.muted, { s: sim.u(1), align: "left" });
    }

    function drawSlab(ctx, c, O) {
      var v = sim.view(), L = 60, top = sim.m(0, v.y0).y, src = torchPos();
      dashed(ctx, { x: 0, y: top }, { x: 0, y: -S.t - 6 }, th.muted, 1.2);
      beam(ctx, src, O, th.ten, 1, 3.5);
      beam(ctx, O, along(O, reflect(c.d, { x: 0, y: 1 }), 30), th.app, c.R || 1, 2);
      torch(ctx, src, c.d);
      mediumLabel(ctx, S.n1, v.x0 + sim.u(12), sim.px(0, 0).y - sim.u(10));
      mediumLabel(ctx, S.n2, v.x0 + sim.u(70), sim.px(0, -S.t).y - sim.u(8));
      if (c.tir) { K.label(ctx, "no light enters: total internal reflection at the top face", P2(O).x, P2(O).y + sim.u(40), th.app, { s: sim.u(1), bg: true }); return; }
      beam(ctx, O, c.P, th.disp, 1, 3.5);
      dashed(ctx, { x: c.P.x, y: c.P.y + 4 }, { x: c.P.x, y: c.P.y - 8 }, th.muted, 1.2);
      var exit = along(c.P, c.t2, 40);
      beam(ctx, c.P, exit, th.ten, 1, 3.5);
      // where the ray would have gone with no slab, and the perpendicular gap between the two
      dashed(ctx, O, along(O, c.d, 40 + c.L), K.alpha(th.ten, 0.6), 1.5);
      var k = c.P.x * c.d.x + c.P.y * c.d.y, foot = along(O, c.d, k), ex2 = along(c.P, c.t2, 14), ft2 = along(foot, c.d, 14);
      var A = P2(ex2), B = P2(ft2);
      K.arrow(ctx, A.x, A.y, B.x, B.y, th.ink, { s: sim.u(1), width: 1.5, head: 7 });
      K.arrow(ctx, B.x, B.y, A.x, A.y, th.ink, { s: sim.u(1), width: 1.5, head: 7 });
      K.label(ctx, "shift d = " + K.fmt(c.shift, 2) + " cm", (A.x + B.x) / 2 + sim.u(10), (A.y + B.y) / 2 + sim.u(4), th.ink, { s: sim.u(1), align: "left", bg: true });
      var up = -Math.PI / 2, dn = Math.PI / 2;
      arc(ctx, O, up, up - S.th1 * DEG, 40, th.ten, "θ₁");
      arc(ctx, O, dn, dn - c.th2 * DEG, 40, th.disp, "θ₂");
      arc(ctx, c.P, dn, dn - c.e * DEG, 34, th.ten, "e = " + K.fmt(c.e, 1) + "°");
      var tl = sim.px(sim.m(v.x1, 0).x - 7, 0), bl = sim.px(sim.m(v.x1, 0).x - 7, -S.t);
      K.arrow(ctx, tl.x, tl.y, bl.x, bl.y, th.muted, { s: sim.u(1), width: 1.5, head: 7 });
      K.label(ctx, "t = " + K.fmt(S.t, 1) + " cm", tl.x - sim.u(6), (tl.y + bl.y) / 2 + sim.u(6), th.muted, { s: sim.u(1), align: "right" });
    }

    /* ---------- graphs, maths and readouts change with the experiment ---------- */
    var graphs = [], eqEls = [], setR = function () {};
    var CAPS = {
      snell: ['<b class="c-disp">θ₂ vs θ₁</b> · stops at the critical angle when $n_1 \\gt n_2$',
        '<b class="c-disp">sin θ₂ vs sin θ₁</b> · a straight line of slope $n_1/n_2$: that\'s Snell\'s law',
        '<b class="c-app">reflected share vs θ₁</b> · jumps to 100% at $\\theta_c$ (Fresnel, beyond JEE)'],
      depth: ['<b class="c-grav">apparent depth vs viewing angle β</b> · dashed is $d/n$, true only near β = 0',
        '<b class="c-grav">apparent depth vs n</b> (looking straight down) · $d\' = d/n$',
        '<b class="c-grav">apparent depth vs real depth</b> · a straight line of slope $1/n$'],
      slab: ['<b class="c-ink">lateral shift vs θ₁</b> · zero at normal incidence, $\\to t$ at grazing',
        '<b class="c-ten">emergent angle vs θ₁</b> · on the line $e = \\theta_1$: the ray comes out parallel',
        '<b class="c-ink">lateral shift vs thickness</b> · proportional to $t$']
    };
    function buildPanels() {
      graphs.forEach(function (g) { g.destroy(); });
      P.graphs.innerHTML = CAPS[S.mode].map(function (c) { return '<div class="graph"><canvas></canvas><p class="graph-cap">' + K.md(c) + "</p></div>"; }).join("");
      var cv = P.graphs.querySelectorAll("canvas");
      if (S.mode === "snell") graphs = [
        new K.Graph(cv[0], { yLabel: "θ₂ (°)", xLabel: "θ₁ (°)", xMax: 90, yMin: 0, yMax: 90, color: th.disp }),
        new K.Graph(cv[1], { yLabel: "sin θ₂", xLabel: "sin θ₁", xMax: 1, yMin: 0, yMax: 1, color: th.disp }),
        new K.Graph(cv[2], { yLabel: "reflected (%)", xLabel: "θ₁ (°)", xMax: 90, yMin: 0, yMax: 100, color: th.app })];
      else if (S.mode === "depth") graphs = [
        new K.Graph(cv[0], { yLabel: "d' (cm)", xLabel: "β (°)", xMax: 75, yMin: 0, color: th.grav }),
        new K.Graph(cv[1], { yLabel: "d' (cm)", xLabel: "n", xMax: 2.5, yMin: 0, color: th.grav }),
        new K.Graph(cv[2], { yLabel: "d' (cm)", xLabel: "d (cm)", xMax: 20, yMin: 0, color: th.grav })];
      else graphs = [
        new K.Graph(cv[0], { yLabel: "shift (cm)", xLabel: "θ₁ (°)", xMax: 90, yMin: 0, color: th.ink }),
        new K.Graph(cv[1], { yLabel: "e (°)", xLabel: "θ₁ (°)", xMax: 90, yMin: 0, yMax: 90, color: th.ten }),
        new K.Graph(cv[2], { yLabel: "shift (cm)", xLabel: "t (cm)", xMax: 15, yMin: 0, color: th.ink })];

      var LABELS = {
        snell: ["Snell's law", "Law of reflection", "Critical angle", "Light slows down in a denser medium"],
        depth: ["Looking straight down: real / apparent = n", "How far the fish seems to rise", "Snell's law at the surface", "Looking at a slant"],
        slab: ["Top face", "Bottom face: out at the same angle", "Lateral shift", "Path length inside the glass"]
      };
      P.eqs.innerHTML = LABELS[S.mode].map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      var RO = {
        snell: [{ id: "th1", label: "angle of incidence θ₁", cls: "c-ten" }, { id: "th2", label: "angle of refraction θ₂", cls: "c-disp" },
          { id: "thr", label: "angle of reflection", cls: "c-app" }, { id: "crit", label: "critical angle θc" }, { id: "R", label: "light reflected", cls: "c-app" }],
        depth: [{ id: "d", label: "real depth d", cls: "c-acc" }, { id: "dApp", label: "apparent depth d'", cls: "c-grav" },
          { id: "ratio", label: "real / apparent" }, { id: "rise", label: "image raised by", cls: "c-grav" }, { id: "beta", label: "viewing angle β" }],
        slab: [{ id: "th2", label: "angle inside θ₂", cls: "c-disp" }, { id: "e", label: "emergent angle e", cls: "c-ten" },
          { id: "shift", label: "lateral shift d" }, { id: "L", label: "path inside glass" }]
      };
      setR = K.readout(P.readouts, RO[S.mode]);
    }

    function formulaCurves() {
      var g = graphs, a = [], b = [], f = [];
      if (S.mode === "snell") {
        for (var x = 0; x <= 89.5; x += 0.5) {
          var s = S.n1 * Math.sin(x * DEG) / S.n2;
          if (s <= 1) { a.push([x, Math.asin(s) / DEG]); b.push([Math.sin(x * DEG), s]); }
          f.push([x, 100 * fresnel(Math.cos(x * DEG), S.n1, S.n2)]);
        }
        g[0].set("theory", { points: a, color: th.disp, dash: [5, 5], width: 1.5 });
        g[1].set("theory", { points: b, color: th.disp, dash: [5, 5], width: 1.5 });
        g[2].set("sim", { points: f, color: th.app, width: 2.5 });
      } else if (S.mode === "depth") {
        var ratio = S.n2 / S.n1;
        g[0].set("theory", { points: [[0, S.d / ratio], [75, S.d / ratio]], color: th.grav, dash: [5, 5], width: 1.5 });
        for (var n = 1; n <= 2.5 + 1e-9; n += 0.05) { a.push([n, S.d / n]); b.push([n, traceDepth(0, S.d, 1, n).dApp]); }
        g[1].set("theory", { points: a, color: th.grav, dash: [5, 5], width: 1.5 });
        g[1].set("sim", { points: b, color: th.grav, width: 2.5 });
        for (var d = 0.5; d <= 20; d += 0.5) { f.push([d, traceDepth(S.beta, d, S.n1, S.n2).dApp]); }
        g[2].set("theory", { points: [[0, 0], [20, 20 / ratio]], color: th.grav, dash: [5, 5], width: 1.5 });
        g[2].set("sim", { points: f, color: th.grav, width: 2.5 });
      } else {
        for (var x2 = 0; x2 <= 89.5; x2 += 0.5) { var fs = formulaShift(x2, S.t, S.n1, S.n2); if (fs !== null) a.push([x2, fs]); }
        g[0].set("theory", { points: a, color: th.ink, dash: [5, 5], width: 1.5 });
        g[1].set("theory", { points: [[0, 0], [90, 90]], color: th.ten, dash: [5, 5], width: 1.5 });
        for (var t = 0.5; t <= 15; t += 0.5) { var c = traceSlab(S.th1, t, S.n1, S.n2); if (!c.tir) b.push([t, c.shift]); }
        var f0 = formulaShift(S.th1, 1, S.n1, S.n2);
        if (f0 !== null) g[2].set("theory", { points: [[0, 0], [15, 15 * f0]], color: th.ink, dash: [5, 5], width: 1.5 });
        g[2].set("sim", { points: b, color: th.ink, width: 2.5 });
      }
    }
    function graphUpdate(c) {
      var g = graphs;
      Object.keys(g[0].series).forEach(function (k) { if (k !== "theory") delete g[0].series[k]; });
      if (sweep) {
        var col = S.mode === "snell" ? th.disp : S.mode === "depth" ? th.grav : th.ink;
        g[0].set("sim", { points: sweep.pts1, color: col, width: 2.5, dot: true });
        if (S.mode !== "depth") g[1].set("sim", { points: sweep.pts2, color: S.mode === "snell" ? th.disp : th.ten, width: 2.5, dot: true });
      } else if (S.mode !== "depth") delete g[1].series.sim;
      // a marker for where the stage is right now
      var mark = S.mode === "snell" ? (c.t ? [S.th1, c.th2] : null) : S.mode === "depth" ? [S.beta, c.dApp] : (c.tir ? null : [S.th1, c.shift]);
      g[0].extra = mark ? function (ctx, X, Y) { ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(mark[0]), Y(mark[1]), 4, 0, Math.PI * 2); ctx.fill(); } : null;
      g[2].extra = S.mode === "snell" && c.crit !== null ? function (ctx, X, Y) {
        ctx.strokeStyle = th.ten; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(c.crit), Y(0)); ctx.lineTo(X(c.crit), Y(100)); ctx.stroke(); ctx.setLineDash([]);
      } : null;
      g.forEach(function (gr) { gr.dirty = true; gr.draw(); });
    }

    function B(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths(c) {
      var n1 = K.fmt(S.n1, 2), n2 = K.fmt(S.n2, 2);
      if (S.mode === "snell") {
        var lhs = S.n1 * Math.sin(S.th1 * DEG);
        K.tex(eqEls[0], c.t ? "n_1\\sin\\theta_1 = " + n1 + "\\sin" + K.fmt(S.th1, 1) + "^\\circ = " + K.fmt(lhs, 3) + " = " + n2 + "\\sin\\theta_2 \\Rightarrow \\theta_2 = \\mathbf{" + K.fmt(Math.asin(lhs / S.n2) / DEG, 1) + "^\\circ}"
          : "\\sin\\theta_2 = \\frac{n_1\\sin\\theta_1}{n_2} = \\frac{" + K.fmt(lhs, 3) + "}{" + n2 + "} = \\mathbf{" + K.fmt(lhs / S.n2, 3) + "} > 1 \\Rightarrow \\text{no refracted ray}");
        K.tex(eqEls[1], "\\theta_r = \\theta_1 = \\mathbf{" + K.fmt(S.th1, 1) + "^\\circ}\\quad\\text{(always, whatever the media)}");
        K.tex(eqEls[2], c.crit !== null ? "\\sin\\theta_c = \\frac{n_2}{n_1} = \\frac{" + n2 + "}{" + n1 + "} \\Rightarrow \\theta_c = \\mathbf{" + K.fmt(c.crit, 1) + "^\\circ}"
          : "n_1 \\le n_2:\\ \\text{light enters a denser medium, so there is no critical angle}");
        K.tex(eqEls[3], "v_1 = \\frac{c}{n_1} = \\mathbf{" + K.fmt(3 / S.n1, 2) + "}\\times10^8\\,\\text{m/s},\\quad v_2 = \\frac{c}{n_2} = \\mathbf{" + K.fmt(3 / S.n2, 2) + "}\\times10^8\\,\\text{m/s}");
        setR("th1", K.fmt(S.th1, 1) + "°");
        setR("th2", c.t ? K.fmt(c.th2, 2) + "°" : "none", c.t ? "Snell " + K.fmt(Math.asin(lhs / S.n2) / DEG, 2) + "°" : "total internal reflection");
        setR("thr", K.fmt(c.thr, 2) + "°", "= θ₁");
        setR("crit", c.crit !== null ? K.fmt(c.crit, 2) + "°" : "none", c.crit !== null ? "sin⁻¹(n₂/n₁)" : "n₁ ≤ n₂");
        setR("R", K.fmt(c.R * 100, 0) + "%", c.t ? "the rest refracts" : "all of it");
      } else if (S.mode === "depth") {
        var n = S.n2 / S.n1, f = S.d / n;
        K.tex(eqEls[0], "d' = \\frac{d}{n_2/n_1} = \\frac{" + K.fmt(S.d, 1) + "}{" + K.fmt(n, 3) + "} = \\mathbf{" + K.fmt(f, 2) + "}\\ \\text{cm}");
        K.tex(eqEls[1], "d - d' = d\\left(1 - \\tfrac{1}{n}\\right) = " + K.fmt(S.d, 1) + "\\left(1 - \\tfrac{1}{" + K.fmt(n, 3) + "}\\right) = \\mathbf{" + K.fmt(S.d - f, 2) + "}\\ \\text{cm}");
        K.tex(eqEls[2], "n_2\\sin\\alpha = n_1\\sin\\beta:\\ " + n2 + "\\sin" + K.fmt(c.alpha, 1) + "^\\circ = " + n1 + "\\sin" + K.fmt(c.beta, 1) + "^\\circ = \\mathbf{" + K.fmt(S.n1 * Math.sin(c.beta * DEG), 3) + "}");
        K.tex(eqEls[3], "d' = \\frac{d\\cos^3\\beta}{n\\cos^3\\alpha} = \\frac{" + K.fmt(S.d, 1) + "\\cos^3" + K.fmt(c.beta, 1) + "^\\circ}{" + K.fmt(n, 3) + "\\cos^3" + K.fmt(c.alpha, 1) + "^\\circ} = \\mathbf{" + K.fmt(c.oblique, 2) + "}\\ \\text{cm}");
        setR("d", K.fmt(S.d, 2) + " cm");
        setR("dApp", K.fmt(c.dApp, 2) + " cm", "traced rays · d/n = " + K.fmt(f, 2) + " cm");
        setR("ratio", K.fmt(S.d / c.dApp, 3), "n = " + K.fmt(n, 3));
        setR("rise", K.fmt(S.d - c.dApp, 2) + " cm", "towards you");
        setR("beta", K.fmt(c.beta, 1) + "°", S.beta < 10 ? "near normal: d/n holds" : "slant: rises more");
      } else {
        var s1 = S.n1 * Math.sin(S.th1 * DEG), ok = s1 / S.n2 <= 1, t2 = ok ? Math.asin(s1 / S.n2) : 0, fsh = formulaShift(S.th1, S.t, S.n1, S.n2);
        K.tex(eqEls[0], n1 + "\\sin" + K.fmt(S.th1, 1) + "^\\circ = " + n2 + "\\sin\\theta_2 \\Rightarrow \\theta_2 = \\mathbf{" + (ok ? K.fmt(t2 / DEG, 1) + "^\\circ" : "\\text{none}") + "}");
        K.tex(eqEls[1], n2 + "\\sin" + K.fmt(t2 / DEG, 1) + "^\\circ = " + n1 + "\\sin e \\Rightarrow e = \\mathbf{" + K.fmt(c.tir ? 0 : c.e, 1) + "^\\circ} = \\theta_1");
        K.tex(eqEls[2], "d = \\frac{t\\sin(\\theta_1 - \\theta_2)}{\\cos\\theta_2} = \\frac{" + K.fmt(S.t, 1) + "\\sin(" + K.fmt(S.th1, 1) + "^\\circ - " + K.fmt(t2 / DEG, 1) + "^\\circ)}{\\cos" + K.fmt(t2 / DEG, 1) + "^\\circ} = \\mathbf{" + K.fmt(fsh, 2) + "}\\ \\text{cm}");
        K.tex(eqEls[3], "L = \\frac{t}{\\cos\\theta_2} = \\frac{" + K.fmt(S.t, 1) + "}{\\cos" + K.fmt(t2 / DEG, 1) + "^\\circ} = \\mathbf{" + K.fmt(S.t / Math.cos(t2), 2) + "}\\ \\text{cm}");
        setR("th2", c.tir ? "none" : K.fmt(c.th2, 2) + "°", "traced");
        setR("e", c.tir ? "none" : K.fmt(c.e, 2) + "°", "θ₁ = " + K.fmt(S.th1, 1) + "°");
        setR("shift", c.tir ? "—" : K.fmt(c.shift, 2) + " cm", "formula " + K.fmt(fsh, 2) + " cm");
        setR("L", c.tir ? "—" : K.fmt(c.L, 2) + " cm", "t / cos θ₂");
      }
    }

    var slowMaths = K.throttle(function () { renderMaths(current()); }, 100);
    function changed(fromSweep) {
      if (!fromSweep && sweep) { sweep = null; sim.pause(); if (transportUI) transportUI.render(); }
      var c = current();
      formulaCurves(); graphUpdate(c);
      if (fromSweep) slowMaths(); else renderMaths(c);
      checkTries(c);
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>At a boundary light does two things at once. Some <b class=\"c-app\">reflects</b>, at an angle equal to the angle of incidence. The rest <b class=\"c-disp\">refracts</b>, bending by <b>Snell's law</b>, $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$. All angles are measured from the <b>normal</b>, never from the surface.</p>" +
      "<p>Going into a denser medium the ray bends towards the normal. Coming out it bends away, and past the <b>critical angle</b> $\\sin\\theta_c = n_2/n_1$ it can't get out at all: total internal reflection.</p>" +
      "<p>Your eye assumes light travels straight, so it traces the bent rays back to an <b class=\"c-grav\">image</b>: a fish at depth $d$ looks $d/n$ deep from straight above. A slab bends the ray in and then straight back out, so it emerges parallel, just shifted sideways.</p>" +
      '<div class="trap"><b>JEE trap: $\\sin\\theta_c = 1/n$ only works into air (or vacuum).</b> For glass into water use $\\sin\\theta_c = n_{water}/n_{glass} = 1.33/1.5$, giving $62.5°$, not $41.8°$. And TIR needs light going from the denser medium into the rarer one.</div>');

    function apply(s) {
      Object.keys(s).forEach(function (k) { if (k !== "mode") S[k] = s[k]; });
      setMode(s.mode);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "critical angle", setup: { mode: "snell", n1: 1.5, n2: 1, th1: 41.5 }, watch: "Read θc, then drag the torch past it and watch the refracted ray vanish",
        q: "Light travels inside glass ($n = 1.5$) towards a glass–air boundary. What is the critical angle?",
        options: ["$33.7°$", "$41.8°$", "$48.6°$", "$56.3°$"], answer: 1,
        explain: "$\\sin\\theta_c = 1/n = 1/1.5 = 0.667$, so $\\theta_c = 41.8°$. $48.6°$ is the value for water, and $56.3°$ is $\\tan^{-1}1.5$ (Brewster's angle, a different idea). In the lab the refracted ray lies flat along the boundary at $41.8°$ and disappears beyond it." },
      { level: "medium", tag: "apparent depth", setup: { mode: "depth", n1: 1, n2: 4 / 3, d: 12, beta: 0 }, watch: "Read how far the fish seems to rise, then drag the eye sideways",
        q: "A coin lies at the bottom of a tank filled with 12 cm of water ($n = 4/3$). Looking straight down, how far above the bottom does the coin appear to be?",
        options: ["3 cm", "4 cm", "9 cm", "16 cm"], answer: 0,
        hints: ["Real depth / apparent depth $= n$, so the apparent depth is $d/n$.", "The question asks how far it is <i>raised</i>, which is $d - d'$."],
        explain: "Apparent depth $d' = 12/(4/3) = 9$ cm below the surface, so the coin seems raised by $12 - 9 = 3$ cm. 9 cm answers a different question, and 16 cm multiplies by $n$ instead of dividing." },
      { level: "hard", tag: "lateral shift", setup: { mode: "slab", n1: 1, n2: Math.sqrt(3), th1: 60, t: 6 }, watch: "Predict the shift, then read it off the arrow between the two parallel rays",
        q: "A ray strikes a 6 cm thick glass slab ($n = \\sqrt3$) at $60°$ to the normal. By how much is the emerging ray shifted sideways from the original line?",
        options: ["2.00 cm", "3.46 cm", "5.20 cm", "6.93 cm"], answer: 1,
        hints: ["First find $\\theta_2$ from $\\sin 60° = \\sqrt3\\sin\\theta_2$.", "The ray travels $L = t/\\cos\\theta_2$ inside the glass; the shift is the part of that perpendicular to the original direction: $L\\sin(\\theta_1 - \\theta_2)$."],
        explain: "$\\sin\\theta_2 = (\\sqrt3/2)/\\sqrt3 = 1/2$, so $\\theta_2 = 30°$. Then $d = \\dfrac{t\\sin(\\theta_1-\\theta_2)}{\\cos\\theta_2} = \\dfrac{6\\sin30°}{\\cos30°} = 2\\sqrt3 = 3.46$ cm. 6.93 cm is the path length $L$ inside the glass, and 5.20 cm is $t\\sin\\theta_1$." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, {
      playLabel: "Sweep",
      onPlay: function () { if (!sweep || sweep.done) startSweep(); },
      onReset: function () { sweep = null; sim.resetClock(); P.time.textContent = "t = 0.00 s"; changed(); }
    });
    setMode("snell");
    if (location.hostname === "localhost") window.__lab_refraction = { S: S, apply: apply, current: current, setMode: setMode, changed: changed,
      traceSnell: traceSnell, traceDepth: traceDepth, traceSlab: traceSlab, formulaShift: formulaShift, sweep: function () { return sweep; } };

    return function destroy() { sim.destroy(); graphs.forEach(function (g) { g.destroy(); }); };
  }
})();
