/* Ray optics, lab 2: thin lenses and spherical mirrors with the Cartesian sign convention.
   The image is found by tracing two principal rays and intersecting them; the formulas only draw the dashed curves. */
(function () {
  "use strict";
  var KINDS = [{ label: "Convex lens", value: "convex" }, { label: "Concave lens", value: "concave" },
    { label: "Concave mirror", value: "cmirror" }, { label: "Convex mirror", value: "vmirror" }];
  var U_MIN = -100, CLAMP_V = 120;

  var lab = {
    id: "lenses", chapter: "rays", title: "Mirrors & lenses", short: "ray diagrams, sign convention, lens maker",
    lede: "Drag the object along the axis and the three principal rays redraw themselves. Where they meet is the image: real if the light really gets there, virtual if your eye only thinks it does.",
    tries: [
      { id: "same", title: "Make a real image exactly the same size",
        text: "With a convex lens or a concave mirror, get a real, inverted image with $m = -1$.",
        why: "Put the object at $2f$ (the centre of curvature for a mirror). Then $v = 2f$ on the other side too, and $|m| = |v/u| = 1$. Move closer and the image grows and runs away to infinity at $F$." },
      { id: "shaving", title: "Build a shaving mirror",
        text: "Get an upright, magnified image from a concave mirror.",
        why: "Inside the focus ($|u| \\lt f$) the reflected rays spread out; traced back, they meet behind the mirror. The image is virtual, upright and bigger: $m = -v/u \\gt 1$." },
      { id: "diverging", title: "Try to catch a real image with a diverging element",
        text: "Pick a concave lens or a convex mirror and press Walk in, so the object comes all the way from 100 cm.",
        why: "A diverging element always spreads light out, so the image is always virtual, upright and smaller, sitting between $F$ and the element. That's why rear-view mirrors are convex." },
      { id: "maker", title: "Grind your own 20 cm lens",
        text: "Switch on the lens maker and pick $R_1$, $R_2$ and $n$ so that $f = +20$ cm.",
        why: "$\\frac1f = (n-1)\\left(\\frac1{R_1} - \\frac1{R_2}\\right)$. Glass with $n = 1.5$ and $R_1 = +20$, $R_2 = -20$ cm works, and so does a plano-convex lens with $R_1 = +10$ cm and a flat back." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 480;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 5, origin: { x: 560, y: 240 }, g: 0, gridStep: 1, gridMajor: 10, labels: false });

    var S = { kind: "convex", f: 20, u: -30, h: 5, maker: false, R1: 20, R2: -20, n: 1.5, contact: false, P2: -2.5 };

    /* ---------- controls ---------- */
    function sl(o, key) { o.onInput = function (v) { S[key] = v; changed(); }; return K.slider(o); }
    var kindSeg = K.seg(KINDS, S.kind, function (v) { S.kind = v; if (isMirror()) S.maker = false; syncUI(); changed(); }, "Element");
    var fS = sl({ label: "Focal length $|f|$", unit: "cm", min: 5, max: 40, step: 1, value: S.f, hint: "The sign comes from the element and the sign convention." }, "f");
    var uS = sl({ label: "Object distance $u$", unit: "cm", min: U_MIN, max: -2, step: 0.5, value: S.u, hint: "Negative: the object is against the direction of the light. Or drag the object." }, "u");
    var hS = sl({ label: "Object height $h$", unit: "cm", min: 1, max: 12, step: 0.5, value: S.h }, "h");
    var r1S = sl({ label: "First face $R_1$", unit: "cm", min: -60, max: 60, step: 1, value: S.R1, hint: "+ if its centre is on the far side. 0 means flat (R = ∞)." }, "R1");
    var r2S = sl({ label: "Second face $R_2$", unit: "cm", min: -60, max: 60, step: 1, value: S.R2 }, "R2");
    var nS = sl({ label: "Refractive index $n$", min: 1.2, max: 2, step: 0.01, value: S.n }, "n");
    var p2S = sl({ label: "Second lens power $P_2$", unit: "D", min: -10, max: 10, step: 0.5, value: S.P2, hint: "$P = 100/f$ with $f$ in cm. Negative is diverging." }, "P2");
    var makerChk = K.check("Build the lens from R₁, R₂, n (lens maker)", S.maker, function (v) { S.maker = v; syncUI(); changed(); });
    var contactChk = K.check("Add a second thin lens in contact", S.contact, function (v) { S.contact = v; syncUI(); changed(); });
    P.controls.innerHTML = "<h3>Element</h3>";
    P.controls.appendChild(kindSeg);
    P.controls.appendChild(fS.el);
    P.controls.appendChild(K.h("<h3>Object</h3>"));
    [uS, hS].forEach(function (s) { P.controls.appendChild(s.el); });
    var lensBox = K.h("<div><h3>Lens maker &amp; combinations</h3></div>");
    lensBox.appendChild(makerChk);
    [r1S, r2S, nS].forEach(function (s) { lensBox.appendChild(s.el); });
    lensBox.appendChild(contactChk);
    lensBox.appendChild(p2S.el);
    P.controls.appendChild(lensBox);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-acc"><i></i>object</span><span class="c-ten"><i></i>light rays</span><span class="c-grav"><i></i>image (dashed = virtual)</span>' +
      '<span style="color:var(--muted)"><i></i>principal axis</span></div>'));

    function isMirror() { return S.kind === "cmirror" || S.kind === "vmirror"; }
    function syncUI() {
      fS.set(S.f); uS.set(S.u); hS.set(S.h); r1S.set(S.R1); r2S.set(S.R2); nS.set(S.n); p2S.set(S.P2);
      makerChk.querySelector("input").checked = S.maker; contactChk.querySelector("input").checked = S.contact;
      lensBox.hidden = isMirror();
      [r1S, r2S, nS].forEach(function (s) { s.el.hidden = !S.maker; });
      p2S.el.hidden = !S.contact;
      fS.el.hidden = S.maker && !isMirror();
      var shown = S.kind;
      if (S.maker && !isMirror()) shown = makerF() >= 0 ? "convex" : "concave";
      kindSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === shown)); });
    }

    /* ---------- optics ---------- */
    function inv(R) { return R === 0 ? 0 : 1 / R; }
    function makerF() { var p = (S.n - 1) * (inv(S.R1) - inv(S.R2)); return p === 0 ? Infinity : 1 / p; }
    // signed focal lengths, Cartesian convention (light travels to +x)
    function f1() {
      if (S.kind === "cmirror") return -S.f;
      if (S.kind === "vmirror") return S.f;
      if (S.maker) return makerF();
      return S.kind === "convex" ? S.f : -S.f;
    }
    function f2() { return !isMirror() && S.contact && S.P2 !== 0 ? 100 / S.P2 : Infinity; }
    function F() { if (isMirror()) return f1(); var p = 1 / f1() + 1 / f2(); return p === 0 ? Infinity : 1 / p; }

    // A ray leaves the object's tip (u, h) with slope s and hits the element (x = 0) at height y0.
    // A thin lens bends it by -y0/f (each lens in turn); a mirror sends it back with slope -s - y0/f.
    function through(s, u, h) {
      var y0 = h - s * u, out;
      if (isMirror()) out = -s - y0 / f1();
      else { out = s - y0 / f1(); if (isFinite(f2())) out -= y0 / f2(); }
      return { s: s, y0: y0, out: out };
    }
    function trace(u, h) {
      var a = through(0, u, h), b = through(h / u, u, h);       // parallel ray, and the ray to the pole / optical centre
      var den = a.out - b.out;
      if (Math.abs(den) < 1e-12) return { a: a, b: b, inf: true };
      var v = (b.y0 - a.y0) / den, hi = a.y0 + a.out * v;
      var real = isMirror() ? v < 0 : v > 0;
      return { a: a, b: b, v: v, hi: hi, m: hi / h, real: real, inf: false };
    }
    function formulaV(u) {                       // 1/v - 1/u = 1/f (lens), 1/v + 1/u = 1/f (mirror)
      var f = F(), iv = isMirror() ? 1 / f - 1 / u : 1 / f + 1 / u;
      return iv === 0 ? Infinity : 1 / iv;
    }
    function formulaM(u) { var v = formulaV(u); return isMirror() ? -v / u : v / u; }

    /* ---------- tries ---------- */
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    function checkTries(c) {
      if (!c.inf && c.real && Math.abs(c.m + 1) <= 0.02 && (S.kind === "cmirror" || F() > 0)) tries.mark("same");
      if (S.kind === "cmirror" && !c.inf && !c.real && c.m > 1) tries.mark("shaving");
      if (S.maker && !isMirror() && Math.abs(makerF() - 20) <= 0.1) tries.mark("maker");
    }

    /* ---------- camera: fit the object, the element and the image ---------- */
    var cam = { ppm: 5, ox: 560 };
    function camTarget(c) {
      var fa = Math.min(Math.abs(F()), 60), xl = Math.min(S.u, -2 * fa, -20), xr = Math.max(2 * fa, 20);
      if (!c.inf) {
        var v = K.clamp(c.v, -CLAMP_V, CLAMP_V);
        xl = Math.min(xl, v); xr = Math.max(xr, v);
      }
      xl -= 8; xr += 8;
      var hmax = Math.max(S.h, c.inf ? 0 : Math.min(Math.abs(c.hi), 40)) + 4;
      var ppm = Math.min(9, W / (xr - xl), (H / 2 - 20) / hmax);
      return { ppm: ppm, ox: -xl * ppm + (W - (xr - xl) * ppm) / 2 };
    }
    sim.on("under", function (ctx) {
      var tgt = camTarget(trace(S.u, S.h));
      cam.ppm += (tgt.ppm - cam.ppm) * 0.15; cam.ox += (tgt.ox - cam.ox) * 0.15;
      sim.ppm = cam.ppm; sim.origin = { x: cam.ox, y: H / 2 };
      var v = sim.view(), y0 = sim.px(0, 0).y;
      ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.2);
      ctx.beginPath(); ctx.moveTo(v.x0, y0); ctx.lineTo(v.x1, y0); ctx.stroke();
      // ticks every 10 cm
      ctx.fillStyle = th.muted; ctx.font = "600 " + sim.u(10) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      var x0 = Math.ceil(sim.m(v.x0, 0).x / 10) * 10, x1 = sim.m(v.x1, 0).x;
      for (var x = x0; x <= x1; x += 10) { var p = sim.px(x, 0); ctx.fillRect(p.x - sim.u(0.75), y0 - sim.u(4), sim.u(1.5), sim.u(8)); if (x % 20 === 0 && x !== 0) ctx.fillText(x, p.x, y0 + sim.u(18)); }
      K.label(ctx, "cm → (direction of light: +)", v.x1 - sim.u(10), v.y1 - sim.u(6), th.muted, { s: sim.u(1), align: "right" });
      drawPoints(ctx);
    });
    function drawPoints(ctx) {
      var f = F(), pts = [];
      if (!isFinite(f)) return;
      if (isMirror()) pts = [[f, "F"], [2 * f, "C"]];
      else pts = [[f, "F₂"], [-f, "F₁"], [2 * f, "2F₂"], [-2 * f, "2F₁"]];
      pts.forEach(function (q) {
        var p = sim.px(q[0], 0);
        ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(p.x, p.y, sim.u(3.5), 0, Math.PI * 2); ctx.fill();
        K.label(ctx, q[1], p.x, p.y - sim.u(6), th.ink, { s: sim.u(1) });
      });
    }

    /* ---------- drawing ---------- */
    function beam(ctx, a, b, color, op, w, dash) {
      var A = sim.px(a.x, a.y), B = sim.px(b.x, b.y);
      ctx.save(); ctx.globalAlpha = op; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineWidth = sim.u(w || 2.5);
      if (dash) ctx.setLineDash([sim.u(5), sim.u(5)]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      if (!dash) {                       // bright pulses flowing along with the light
        ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = sim.u(1.2); ctx.setLineDash([sim.u(5), sim.u(17)]);
        ctx.lineDashOffset = -(performance.now() / 1000 * 50) % sim.u(22);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      ctx.restore();
    }
    function arrowUp(ctx, x, h, color, dashed, text) {
      var a = sim.px(x, 0), b = sim.px(x, h);
      ctx.save(); if (dashed) ctx.globalAlpha = 0.8;
      K.arrow(ctx, a.x, a.y, b.x, b.y, color, { s: sim.u(1), width: 3.5, head: 12, dash: dashed ? [sim.u(5), sim.u(4)] : null });
      ctx.restore();
      K.label(ctx, text, b.x, h >= 0 ? b.y - sim.u(4) : b.y + sim.u(18), color, { s: sim.u(1), bg: true });
    }
    function drawElement(ctx) {
      var Hh = isMirror() ? K.clamp(1.2 * S.f, 8, 16) : 16, top = sim.px(0, Hh), bot = sim.px(0, -Hh), f = F();
      ctx.save();
      if (isMirror()) {
        var R = 2 * Math.abs(S.f), k = S.kind === "cmirror" ? -1 : 1;
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(3.5);
        ctx.beginPath();
        for (var y = -Hh; y <= Hh + 1e-9; y += 1) {
          var x = k * 0.5 * y * y / (2 * R), p = sim.px(x, y);       // drawn with half its true sag: paraxial rays meet the pole plane
          if (y === -Hh) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.2);
        for (var yy = -Hh; yy <= Hh; yy += 2) {
          var q = sim.px(k * 0.5 * yy * yy / (2 * R), yy);
          ctx.beginPath(); ctx.moveTo(q.x + sim.u(2), q.y); ctx.lineTo(q.x + sim.u(9), q.y - sim.u(6)); ctx.stroke();
        }
      } else {
        // bulge of each face: convex faces bulge out, concave faces cave in
        var b1, b2;
        if (S.maker) { b1 = S.R1 === 0 ? 0 : Math.sign(S.R1) * Math.min(1, 20 / Math.abs(S.R1)); b2 = S.R2 === 0 ? 0 : -Math.sign(S.R2) * Math.min(1, 20 / Math.abs(S.R2)); }
        else { b1 = b2 = f > 0 ? 0.8 : -0.8; }
        var half = Math.max(sim.u(4), 0.6 * sim.ppm) + Math.max(0, -Math.min(b1, b2)) * 2.4 * sim.ppm;
        var tl = { x: top.x - half, y: top.y }, tr = { x: top.x + half, y: top.y }, bl = { x: bot.x - half, y: bot.y }, br = { x: bot.x + half, y: bot.y };
        ctx.fillStyle = K.alpha(th.normal, 0.22); ctx.strokeStyle = K.alpha(th.normal, 0.9); ctx.lineWidth = sim.u(1.5);
        ctx.beginPath(); ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.quadraticCurveTo(tr.x + b2 * 4.8 * sim.ppm, (tr.y + br.y) / 2, br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.quadraticCurveTo(bl.x - b1 * 4.8 * sim.ppm, (tl.y + bl.y) / 2, tl.x, tl.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = th.ink; ctx.setLineDash([sim.u(3), sim.u(3)]); ctx.lineWidth = sim.u(1);
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
      }
      ctx.restore();
      var name = isMirror() ? KINDS.filter(function (k) { return k.value === S.kind; })[0].label : (f > 0 ? "converging" : "diverging") + (S.contact ? " pair" : " lens");
      K.label(ctx, name + " · f = " + (f > 0 ? "+" : "") + K.fmt(f, 1) + " cm", top.x, top.y - sim.u(6), th.ink, { s: sim.u(1), bg: true });
    }

    function drawRays(ctx, c) {
      var view = sim.view(), xl = sim.m(view.x0, 0).x - 5, xr = sim.m(view.x1, 0).x + 5;
      var mir = isMirror(), far = mir ? xl : xr, behind = mir ? xr : xl;
      var f = F(), rays = [{ s: 0, tag: "1" }];
      if (mir) {
        if (Math.abs(S.u - f) > 0.3) rays.push({ s: S.h / (S.u - f), tag: "2" });          // aimed at F, comes back parallel
        if (Math.abs(S.u - 2 * f) > 0.3) rays.push({ s: S.h / (S.u - 2 * f), tag: "3" });  // aimed at C, comes straight back
      } else {
        rays.push({ s: S.h / S.u, tag: "2" });                                              // through the optical centre
        if (isFinite(f) && Math.abs(S.u + f) > 0.3) rays.push({ s: S.h / (S.u + f), tag: "3" }); // aimed at F1, leaves parallel
      }
      rays.forEach(function (r) {
        var t = through(r.s, S.u, S.h), hit = { x: 0, y: t.y0 };
        if (Math.abs(t.y0) > (mir ? K.clamp(1.2 * S.f, 8, 16) + 2 : 40)) return;
        beam(ctx, { x: S.u, y: S.h }, hit, th.ten, 1, 2.5);
        beam(ctx, hit, { x: far, y: t.y0 + t.out * far }, th.ten, 1, 2.5);
        if (!c.inf && !c.real) beam(ctx, hit, { x: c.v + (c.v - 0) * 0.15, y: t.y0 + t.out * c.v * 1.15 }, th.grav, 0.75, 1.5, true);
        else if (c.inf) beam(ctx, hit, { x: behind, y: t.y0 + t.out * behind }, th.grav, 0.35, 1.2, true);
        var lp = sim.px(S.u + (0 - S.u) * 0.18, S.h + (t.y0 - S.h) * 0.18);
        K.label(ctx, r.tag, lp.x, lp.y - sim.u(4), th.ten, { s: sim.u(1) });
      });
    }

    sim.on("over", function (ctx) {
      var c = trace(S.u, S.h);
      drawRays(ctx, c);
      drawElement(ctx);
      arrowUp(ctx, S.u, S.h, th.acc, false, "object");
      if (!c.inf && Math.abs(c.v) <= 400) {
        var vis = sim.view(), px = sim.px(c.v, 0).x;
        if (px > vis.x0 && px < vis.x1) arrowUp(ctx, c.v, K.clamp(c.hi, -60, 60), th.grav, !c.real, (c.real ? "real" : "virtual") + " image");
        else K.label(ctx, "image off stage at v = " + K.fmt(c.v, 0) + " cm", sim.px(0, 0).x, vis.y1 - sim.u(10), th.grav, { s: sim.u(1), bg: true });
      } else K.label(ctx, "rays leave parallel: image at infinity", sim.px(0, 0).x, sim.view().y1 - sim.u(10), th.grav, { s: sim.u(1), bg: true });
      if (!dragging && !sweep) { var op = sim.px(S.u, S.h); K.label(ctx, "drag me", op.x, op.y - sim.u(24), th.muted, { s: sim.u(1) }); }
    });

    /* ---------- pointer: drag the object ---------- */
    var dragging = false;
    sim.pointer({
      down: function (pt) {
        if (pt.m.x > -1) return false;
        dragging = true; this.drag(pt); return true;
      },
      drag: function (pt) {
        S.u = K.clamp(Math.round(pt.m.x * 2) / 2, U_MIN, -2);
        if (Math.abs(pt.m.y) > 0.5) S.h = K.clamp(Math.round(Math.abs(pt.m.y) * 2) / 2, 1, 12);
        syncUI(); changed();
      },
      up: function () { dragging = false; }
    });

    /* ---------- Play: walk the object in from 100 cm ---------- */
    var sweep = null;
    function startSweep() { sweep = { v: [[]], m: [[]], inv: [], allVirtual: true }; S.u = U_MIN; syncUI(); changed(true); }
    sim.on("step", function () {
      if (!sweep) return;
      S.u = Math.min(-2, S.u + 12 * K.DT);
      var c = trace(S.u, S.h), au = -S.u;
      if (!c.inf) {
        var lastV = sweep.v[sweep.v.length - 1], prev = lastV[lastV.length - 1];
        if (prev && Math.sign(prev[1]) !== Math.sign(c.v)) { sweep.v.push([]); sweep.m.push([]); }
        if (Math.abs(c.v) <= CLAMP_V) sweep.v[sweep.v.length - 1].push([au, c.v]);
        if (Math.abs(c.m) <= 6) sweep.m[sweep.m.length - 1].push([au, c.m]);
        sweep.inv.push([100 / au, 100 / c.v]);
        if (c.real) sweep.allVirtual = false;
      }
      uS.set(S.u);
      if (S.u >= -2) {
        sim.pause(); transportUI.render(); sweep.done = true;
        var div = isMirror() ? F() > 0 : F() < 0;
        if (div && sweep.allVirtual) tries.mark("diverging");
        K.flash(P.note, sweep.allVirtual ? "Every image on the way in was virtual" : "Solid curves: images found by tracing rays");
      }
      changed(true);
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">image distance v vs object distance |u|</b> · flips sign as the object crosses F</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">magnification m vs |u|</b> · negative = inverted, |m| > 1 = magnified</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">100/v vs 100/|u|</b> (in m⁻¹) · a straight line: that\'s the lens or mirror formula</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gV = new K.Graph(cv[0], { yLabel: "v (cm)", xLabel: "|u| (cm)", xMax: 100, color: th.grav });
    var gM = new K.Graph(cv[1], { yLabel: "m", xLabel: "|u| (cm)", xMax: 100, color: th.grav });
    var gI = new K.Graph(cv[2], { yLabel: "100/v (m⁻¹)", xLabel: "100/|u| (m⁻¹)", xMax: 50, color: th.grav });

    function formulaCurves() {
      var v = [[]], m = [[]], iv = [];
      for (var au = 1; au <= 100 + 1e-9; au += 0.25) {
        var fv = formulaV(-au), fm = formulaM(-au), seg = v[v.length - 1], last = seg[seg.length - 1];
        if (last && Math.sign(last[1]) !== Math.sign(fv)) { v.push([]); m.push([]); }
        if (isFinite(fv) && Math.abs(fv) <= CLAMP_V) v[v.length - 1].push([au, fv]);
        if (isFinite(fm) && Math.abs(fm) <= 6) m[m.length - 1].push([au, fm]);
      }
      for (var x = 1; x <= 50; x += 1) { var fv2 = formulaV(-100 / x); iv.push([x, isFinite(fv2) ? 100 / fv2 : 0]); }
      [gV, gM].forEach(function (g) { g.clear(); });
      v.forEach(function (s, i) { gV.set("t" + i, { points: s, color: th.grav, dash: [5, 5], width: 1.5 }); });
      m.forEach(function (s, i) { gM.set("t" + i, { points: s, color: th.grav, dash: [5, 5], width: 1.5 }); });
      gI.clear();
      gI.set("theory", { points: iv, color: th.grav, dash: [5, 5], width: 1.5 });
    }
    function graphUpdate(c) {
      if (sweep) {
        sweep.v.forEach(function (s, i) { gV.set("s" + i, { points: s, color: th.grav, width: 2.5 }); });
        sweep.m.forEach(function (s, i) { gM.set("s" + i, { points: s, color: th.grav, width: 2.5 }); });
        gI.set("sim", { points: sweep.inv.filter(function (p) { return p[0] <= 50; }), color: th.grav, width: 2.5 });
      }
      var au = -S.u;
      function dot(x, y) { return function (ctx, X, Y) { if (!isFinite(y)) return; ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, Math.PI * 2); ctx.fill(); }; }
      gV.extra = !c.inf && Math.abs(c.v) <= CLAMP_V ? dot(au, c.v) : null;
      gM.extra = !c.inf && Math.abs(c.m) <= 6 ? dot(au, c.m) : null;
      gI.extra = !c.inf && 100 / au <= 50 ? dot(100 / au, 100 / c.v) : null;
      [gV, gM, gI].forEach(function (g) { g.dirty = true; g.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Sign convention (Cartesian)", "", "Magnification", ""].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "u", label: "object distance u", cls: "c-acc" }, { id: "v", label: "image distance v", cls: "c-grav" },
      { id: "m", label: "magnification m", cls: "c-grav" }, { id: "hi", label: "image height h'", cls: "c-grav" },
      { id: "nature", label: "image" }, { id: "f", label: "focal length f" }
    ]);
    function B(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function sgn(v, d) { return (v > 0 ? "+" : "") + K.fmt(v, d === undefined ? 1 : d); }
    function renderMaths(c) {
      var f = F(), mir = isMirror(), u = S.u, fv = formulaV(u), fm = formulaM(u);
      K.tex(eqEls[0], "\\text{from the " + (mir ? "pole" : "optical centre") + ": along the light } {+},\\ \\text{against } {-},\\ \\text{up } {+} \\Rightarrow u = \\mathbf{" + sgn(u) + "},\\ f = \\mathbf{" + sgn(f) + "}\\ \\text{cm}");
      eqLabels[1].textContent = mir ? "Mirror formula" : "Lens formula";
      var ivs = mir ? "\\frac1v = \\frac1f - \\frac1u = \\frac1{" + B(f) + "} - \\frac1{" + B(u) + "}" : "\\frac1v = \\frac1f + \\frac1u = \\frac1{" + B(f) + "} + \\frac1{" + B(u) + "}";
      K.tex(eqEls[1], (mir ? "\\frac1v + \\frac1u = \\frac1f:\\ " : "\\frac1v - \\frac1u = \\frac1f:\\ ") + ivs + " \\Rightarrow v = \\mathbf{" + (isFinite(fv) ? sgn(fv) + "\\ \\text{cm}" : "\\infty") + "}");
      K.tex(eqEls[2], (mir ? "m = -\\frac vu = -\\frac{" + B(fv) + "}{" + B(u) + "}" : "m = \\frac vu = \\frac{" + B(fv) + "}{" + B(u) + "}") + " = \\mathbf{" + (isFinite(fm) ? sgn(fm, 2) : "\\infty") + "},\\quad h' = mh = \\mathbf{" + (isFinite(fm) ? K.fmt(fm * S.h, 2) : "\\infty") + "}\\ \\text{cm}");
      if (mir) {
        eqLabels[3].textContent = "Focal length is half the radius";
        K.tex(eqEls[3], "f = \\frac R2 = \\frac{" + B(2 * f) + "}{2} = \\mathbf{" + sgn(f) + "}\\ \\text{cm}" + (S.kind === "cmirror" ? "\\ \\text{(concave: } F \\text{ in front, so } f \\lt 0)" : "\\ \\text{(convex: } F \\text{ behind, so } f \\gt 0)"));
      } else if (S.maker || S.contact) {
        eqLabels[3].textContent = S.maker ? (S.contact ? "Lens maker, then lenses in contact" : "Lens maker's formula") : "Lenses in contact: powers add";
        var s = "";
        if (S.maker) s += "\\frac1{f_1} = (n-1)\\left(\\frac1{R_1} - \\frac1{R_2}\\right) = " + K.fmt(S.n - 1, 2) + "\\left(\\frac1{" + (S.R1 ? B(S.R1, 0) : "\\infty") + "} - \\frac1{" + (S.R2 ? B(S.R2, 0) : "\\infty") + "}\\right) \\Rightarrow f_1 = \\mathbf{" + (isFinite(f1()) ? sgn(f1()) : "\\infty") + "}";
        if (S.contact) s += (s ? ";\\ " : "") + "\\frac1F = \\frac1{f_1} + \\frac1{f_2},\\ P = P_1 + P_2 = " + K.fmt(100 / f1(), 2) + " + " + B(S.P2, 1) + " = \\mathbf{" + K.fmt(100 / f1() + S.P2, 2) + "}\\ \\text{D},\\ F = \\mathbf{" + (isFinite(f) ? sgn(f) : "\\infty") + "}\\ \\text{cm}";
        K.tex(eqEls[3], s);
      } else {
        eqLabels[3].textContent = "Power of the lens";
        K.tex(eqEls[3], "P = \\frac{100}{f\\,(\\text{cm})} = \\frac{100}{" + B(f) + "} = \\mathbf{" + sgn(100 / f, 2) + "}\\ \\text{D}");
      }
      setR("u", sgn(u) + " cm", "in front, so negative");
      setR("v", c.inf ? "∞" : sgn(c.v, 2) + " cm", "formula " + (isFinite(fv) ? sgn(fv, 2) : "∞") + " cm");
      setR("m", c.inf ? "∞" : sgn(c.m, 3), "formula " + (isFinite(fm) ? sgn(fm, 3) : "∞"));
      setR("hi", c.inf ? "∞" : K.fmt(c.hi, 2) + " cm", c.inf ? "" : (c.hi < 0 ? "inverted" : "upright"));
      setR("nature", c.inf ? "at infinity" : (c.real ? "real" : "virtual"), c.inf ? "object at F" : (Math.abs(c.m) > 1.0005 ? "magnified" : Math.abs(c.m) < 0.9995 ? "diminished" : "same size") + ", " + (c.m < 0 ? "inverted" : "upright"));
      setR("f", sgn(f, 2) + " cm", f > 0 ? (mir ? "convex mirror" : "converging") : (mir ? "concave mirror" : "diverging"));
    }

    var slowMaths = K.throttle(function () { renderMaths(trace(S.u, S.h)); }, 100);
    function changed(fromSweep) {
      if (!fromSweep && sweep) { sweep = null; sim.pause(); if (transportUI) transportUI.render(); }
      var c = trace(S.u, S.h);
      formulaCurves(); graphUpdate(c);
      if (fromSweep) slowMaths(); else renderMaths(c);
      checkTries(c);
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Every point of the object sends light everywhere, but three rays are easy to follow. <b>1</b>: parallel to the axis, it leaves through the focus $F$. <b>2</b>: through the optical centre of a lens it goes straight on (for a mirror, at the pole it reflects symmetrically, or through $C$ it comes straight back). <b>3</b>: through $F$, it leaves parallel. Where they meet is the <b class=\"c-grav\">image</b>.</p>" +
      "<p>If the rays really cross, the image is <b>real</b> and you could catch it on a screen. If they only <i>seem</i> to come from a point when traced back (dashed), it's <b>virtual</b>.</p>" +
      "<p>Measure every distance from the lens or mirror: <b>along the direction of the light is positive</b>, against it negative, up is positive. Then one formula covers every case: $\\frac1v - \\frac1u = \\frac1f$ for lenses and $\\frac1v + \\frac1u = \\frac1f$ for mirrors, with $m = \\frac vu$ and $m = -\\frac vu$.</p>" +
      '<div class="trap"><b>JEE trap: the signs go into the formula, not into your head.</b> The object is in front, so $u$ is negative. A concave mirror has $f \\lt 0$, a convex lens $f \\gt 0$. Substitute the signed values, and let the sign of $v$ tell you which side the image is on. Never "fix" a sign afterwards.</div>');

    function apply(s) {
      Object.keys(s).forEach(function (k) { S[k] = s[k]; });
      if (!("maker" in s)) S.maker = false;
      if (!("contact" in s)) S.contact = false;
      sweep = null; sim.pause(); sim.resetClock(); transportUI.render();
      syncUI(); changed();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "lens formula", setup: { kind: "convex", f: 20, u: -30, h: 4 }, watch: "Predict v and m, then read where the rays cross",
        q: "An object is placed 30 cm in front of a convex lens of focal length 20 cm. Where is the image?",
        options: ["12 cm in front of the lens", "12 cm behind the lens", "60 cm in front of the lens", "60 cm behind the lens"], answer: 3,
        explain: "With $u = -30$ cm and $f = +20$ cm: $\\frac1v = \\frac1{20} + \\frac1{-30} = \\frac1{60}$, so $v = +60$ cm, behind the lens: real, with $m = v/u = -2$, inverted and twice as big. 12 cm comes from forgetting that $u$ is negative." },
      { level: "medium", tag: "concave mirror", setup: { kind: "cmirror", f: 10, u: -5, h: 3 }, watch: "Predict the image, then look behind the mirror",
        q: "An object stands 5 cm in front of a concave mirror of radius of curvature 20 cm. Describe the image.",
        options: ["10 cm in front, real, inverted, $m = -2$", "10 cm behind, virtual, upright, $m = +2$", "3.3 cm behind, virtual, upright, $m = +0.67$", "3.3 cm in front, real, inverted, $m = -0.67$"], answer: 1,
        hints: ["$f = R/2$, and a concave mirror's focus is in front of it, so $f = -10$ cm. The object is in front too: $u = -5$ cm.", "Use $\\frac1v + \\frac1u = \\frac1f$, then $m = -\\frac vu$."],
        explain: "$\\frac1v = \\frac1f - \\frac1u = -\\frac1{10} + \\frac15 = +\\frac1{10}$, so $v = +10$ cm: behind the mirror, virtual. $m = -\\frac{10}{-5} = +2$: upright and doubled, like a shaving mirror. Taking $f = +10$ gives the 3.3 cm options." },
      { level: "hard", tag: "lens maker + contact", setup: { kind: "convex", maker: true, R1: 20, R2: -20, n: 1.5, contact: true, P2: -2.5, u: -60, h: 3, f: 20 }, watch: "Predict v first, then check the equivalent focal length in the maths panel",
        q: "A biconvex lens ($n = 1.5$, both radii 20 cm) is in contact with a thin concave lens of focal length 40 cm. An object is 60 cm in front of the pair. Where is the image, and what is the magnification?",
        options: ["$v = +17.1$ cm, $m = -0.29$", "$v = +30$ cm, $m = -0.5$", "$v = +120$ cm, $m = -2$", "$v = -120$ cm, $m = +2$"], answer: 2,
        hints: ["Lens maker with $R_1 = +20$, $R_2 = -20$: $\\frac1{f_1} = 0.5\\left(\\frac1{20} + \\frac1{20}\\right)$.", "In contact, $\\frac1F = \\frac1{f_1} + \\frac1{f_2}$ with $f_2 = -40$ cm. Then use the lens formula with $u = -60$ cm."],
        explain: "$f_1 = +20$ cm. Then $\\frac1F = \\frac1{20} - \\frac1{40} = \\frac1{40}$, so $F = +40$ cm (power $+2.5$ D). $\\frac1v = \\frac1{40} - \\frac1{60} = \\frac1{120}$: $v = +120$ cm and $m = \\frac{120}{-60} = -2$. Ignoring the concave lens gives $v = 30$ cm; taking its $f$ as $+40$ gives 17.1 cm." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, {
      playLabel: "Walk in",
      onPlay: function () { if (!sweep || sweep.done) startSweep(); },
      onReset: function () { sweep = null; sim.resetClock(); P.time.textContent = "t = 0.00 s"; changed(); }
    });
    syncUI(); changed();
    var t0 = camTarget(trace(S.u, S.h)); cam.ppm = t0.ppm; cam.ox = t0.ox;
    if (location.hostname === "localhost") window.__lab_lenses = { S: S, apply: apply, trace: function () { return trace(S.u, S.h); }, F: F, f1: f1,
      formulaV: formulaV, formulaM: formulaM, changed: changed, sweep: function () { return sweep; } };

    return function destroy() { sim.destroy(); [gV, gM, gI].forEach(function (g) { g.destroy(); }); };
  }
})();
