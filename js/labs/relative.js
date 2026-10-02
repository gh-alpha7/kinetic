/* Lab 3: relative velocity. A boat crossing a river, seen from the ground or from the water. */
(function () {
  "use strict";

  var lab = {
    id: "relative", chapter: "kinematics", title: "Relative velocity", short: "boats, rivers, frames",
    lede: "Steer a boat across a flowing river. Then watch the same crossing from the water's point of view, where the current simply vanishes.",
    tries: [
      { id: "fastest", title: "Cross in the shortest possible time",
        text: "Get to the far bank as fast as you can. Where you land doesn't matter.",
        why: "Only the across component $v_b\\cos\\alpha$ gets you to the other side, and it's biggest at $\\alpha = 0$. The current still drags you downstream, but it doesn't change the time: $t_{min} = d / v_b$." },
      { id: "opposite", title: "Land directly opposite the start",
        text: "With the current running, reach the far bank within 1 m of straight across.",
        why: "Point upstream so your upstream component cancels the current: $v_b \\sin\\alpha = v_r$, so $\\sin\\alpha = v_r / v_b$. The price: you cross more slowly, at $\\sqrt{v_b^2 - v_r^2}$." },
      { id: "frame", title: "Watch from the river's point of view",
        text: "Switch the frame to River while the boat is crossing.",
        why: "In the water's frame there is no current: the boat moves exactly where it's pointed, at $v_b$. The banks slide past instead. Relative velocity is just a change of who's measuring." },
      { id: "impossible", title: "Try to land opposite when the current wins",
        text: "Make the current faster than the boat ($v_r > v_b$) and cross.",
        why: "You can't land opposite: no heading cancels the current. The least drift comes from pointing upstream at $\\sin\\alpha = v_b / v_r$, a favourite JEE follow-up." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 5, origin = { x: 320, y: 440 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, grid: false });
    sim.zoom = 1;

    /* ---------- controls ---------- */
    var dS = K.slider({ label: "River width $d$", unit: "m", min: 20, max: 100, step: 5, value: 60, onInput: reset });
    var rS = K.slider({ label: "Current $v_r$", unit: "m/s", min: 0, max: 5, step: 0.5, value: 2, onInput: reset });
    var bS = K.slider({ label: "Boat speed $v_b$ (in still water)", unit: "m/s", min: 1, max: 8, step: 0.5, value: 4, onInput: reset });
    var aS = K.slider({ label: "Heading $\\alpha$", unit: "°", min: -80, max: 80, step: 1, value: 0, onInput: reset,
      hint: "Angle from straight across. Positive points upstream, into the current." });
    var frame = "ground";
    P.controls.innerHTML = "<h3>River and boat</h3>";
    [dS, rS, bS, aS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Watch from</h3>"));
    P.controls.appendChild(K.seg([{ label: "Ground (bank)", value: "ground" }, { label: "River (water)", value: "river" }], "ground",
      function (v) { frame = v; }, "Frame of reference"));
    var helpers = K.h('<div class="row"></div>');
    var bOpp = K.h('<button class="btn btn-sm" type="button">Aim to land opposite</button>');
    var bFast = K.h('<button class="btn btn-sm" type="button">Aim straight across</button>');
    bOpp.addEventListener("click", function () {
      var vr = rS.get(), vb = bS.get();
      var a = vb > vr ? Math.asin(vr / vb) : Math.asin(vb / vr);
      aS.set(Math.round(a / K.DEG)); reset();
      K.flash(P.note, vb > vr ? "sin α = v_r / v_b" : "current wins: least drift at sin α = v_b / v_r");
    });
    bFast.addEventListener("click", function () { aS.set(0); reset(); });
    helpers.appendChild(bFast); helpers.appendChild(bOpp);
    P.controls.appendChild(K.h("<h3>Shortcuts</h3>"));
    P.controls.appendChild(helpers);

    function params() { return { d: dS.get(), vr: rS.get(), vb: bS.get(), a: aS.get() }; }
    function theory(p) {
      var vx = p.vr - p.vb * Math.sin(p.a * K.DEG), vy = p.vb * Math.cos(p.a * K.DEG);
      var t = p.d / vy;
      return { vx: vx, vy: vy, t: t, drift: vx * t, speed: Math.hypot(vx, vy), dir: Math.atan2(vx, vy) / K.DEG };
    }

    /* ---------- world ---------- */
    var boat = null, logs = [], path, crossed, frameTime = 0;
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      if (boat) sim.remove(boat);
      logs.forEach(function (l) { sim.remove(l); }); logs = [];
      var p = params(), start = sim.px(0, 0);
      fitCamera();
      var vL = sim.m(panTarget, 0).x, vR = sim.m(panTarget + W / zoomTarget, 0).x;
      boat = sim.add(Matter.Bodies.rectangle(start.x, start.y, 4 * ppm, 1.8 * ppm, { isSensor: true, frictionAir: 0, plugin: { k: { draw: drawBoat } } }));
      for (var i = 0; i < 9; i++) {
        var lp = sim.px(vL + Math.random() * (vR - vL), 4 + Math.random() * (p.d - 8));
        logs.push(sim.add(Matter.Bodies.rectangle(lp.x, lp.y, 5 * ppm, 1 * ppm, { isSensor: true, frictionAir: 0, angle: Math.random() * 0.6 - 0.3, plugin: { k: { draw: drawLog } } })));
      }
      path = [[0, 0]]; crossed = null; frameTime = 0;
      P.time.textContent = "t = 0.00 s";
      fitCamera();
      update(true);
    }

    sim.on("before", function () {
      var p = params(), t = theory(p);
      sim.setVel(boat, t.vx, t.vy, 0, 0);
      logs.forEach(function (l) { sim.setVel(l, p.vr, 0, 0, 0); });
    });
    sim.on("step", function (time) {
      var p = params(), pm = sim.posM(boat), y = pm.y;
      path.push([pm.x, y]);
      if (frame === "river") { frameTime += K.DT; if (frameTime > 1) tries.mark("frame"); }
      // keep the logs drifting through the visible stretch of river
      var v = sim.view(), left = sim.m(v.x0, 0).x - 10, right = sim.m(v.x1, 0).x + 10;
      logs.forEach(function (l) {
        var lm = sim.posM(l);
        if (frame === "ground" && lm.x > right) Matter.Body.setPosition(l, sim.px(left, lm.y));
      });
      if (y >= p.d) {
        // it crossed the bank line during this step: back up to the exact moment
        var t = theory(p), over = (y - p.d) / t.vy;
        crossed = { t: time - over, drift: pm.x - t.vx * over, theory: t };
        path[path.length - 1] = [crossed.drift, p.d];
        sim.pause(); transportUI.render();
        K.flash(P.note, "Across in " + K.fmt(crossed.t, 1) + " s, " + K.fmt(Math.abs(crossed.drift), 1) + " m " + (crossed.drift >= 0 ? "downstream" : "upstream"));
        if (p.a === 0) tries.mark("fastest");
        if (p.vr > 0 && Math.abs(crossed.drift) <= 1) tries.mark("opposite");
        if (p.vr > p.vb) tries.mark("impossible");
        fitCamera();
      }
      update(!!crossed);          // refresh the readouts the moment it lands
    });


    /* ---------- camera ---------- */
    // Frame the whole crossing: from the start to wherever the boat will land (in either
    // frame), plus both banks. Zoom out if needed, and pan so the action is centred.
    var zoomTarget = 1, panTarget = 0;
    function fitCamera() {
      var p = params(), t = theory(p), headX = -p.vb * Math.sin(p.a * K.DEG) * t.t;
      var xmin = Math.min(0, t.drift, headX) - 15, xmax = Math.max(0, t.drift, headX) + 15;
      var cw = (xmax - xmin) * ppm;
      zoomTarget = Math.min(1.6, W / cw, H / ((p.d + 10) * ppm + (H - origin.y)));
      panTarget = origin.x + xmin * ppm - (W / zoomTarget - cw) / 2;
    }
    // River frame: things fixed to the ground (banks, markers) slide back by how far the water moved.
    function shift() { return frame === "river" ? -params().vr * sim.time * ppm : 0; }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      sim.zoom += (zoomTarget - sim.zoom) * 0.12;
      sim.panX = (sim.panX || 0) + (panTarget - (sim.panX || 0)) * 0.12;
      if (Math.abs(zoomTarget - sim.zoom) < 1e-4) { sim.zoom = zoomTarget; sim.panX = panTarget; }
      var p = params(), v = sim.view(), sx = shift();
      var bankLow = sim.px(0, 0).y, bankHigh = sim.px(0, p.d).y;
      // water; ripples move with the water, so they stand still in the river frame
      ctx.fillStyle = th.water; ctx.fillRect(v.x0, bankHigh, v.x1 - v.x0, bankLow - bankHigh);
      ctx.strokeStyle = th["water-2"]; ctx.lineWidth = sim.u(2);
      var flow = frame === "river" ? 0 : p.vr * sim.time * ppm, gap = 60;
      for (var yy = bankHigh + 18; yy < bankLow - 6; yy += 28) {
        var off = ((flow + yy * 3) % gap + gap) % gap;
        for (var xx = Math.floor(v.x0 / gap) * gap - gap + off; xx < v.x1; xx += gap) {
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 10, yy - 5, xx + 20, yy); ctx.stroke();
        }
      }
      // banks, with posts every 10 m that move in the river frame
      ctx.fillStyle = th.bank;
      ctx.fillRect(v.x0, bankLow, v.x1 - v.x0, v.y1 - bankLow);
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, bankHigh - v.y0);
      ctx.save(); ctx.translate(sx, 0);
      var mLeft = sim.m(v.x0 - sx, 0).x, mRight = sim.m(v.x1 - sx, 0).x, step = sim.zoom < 0.35 ? 50 : 10;
      ctx.fillStyle = th["ground-top"]; ctx.font = "600 " + sim.u(11) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var m = Math.ceil(mLeft / step) * step; m <= mRight; m += step) {
        var q = sim.px(m, 0);
        ctx.fillRect(q.x - sim.u(1.5), bankLow, sim.u(3), sim.u(10));
        ctx.fillRect(q.x - sim.u(1.5), bankHigh - sim.u(10), sim.u(3), sim.u(10));
        if (m % (step * 2) === 0) ctx.fillText(m + " m", q.x, bankLow + sim.u(13));
      }
      // where you start, and the point directly opposite
      var s0 = sim.px(0, 0), s1 = sim.px(0, p.d);
      ctx.fillStyle = th.ink;
      ctx.beginPath(); ctx.arc(s0.x, s0.y, sim.u(4), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.setLineDash([sim.u(4), sim.u(5)]);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "directly opposite", s1.x, s1.y - sim.u(4), th.ink, { s: sim.u(1), bg: true });
      ctx.restore();
      K.label(ctx, frame === "river" ? "watching from the water: the current is gone" : "watching from the bank", v.x1 - sim.u(10), v.y1 - sim.u(6), th.muted, { s: sim.u(1), align: "right" });
    });

    sim.on("over", function (ctx) {
      var p = params(), t = theory(p), river = frame === "river", sx = shift();
      // planned path: over the ground it's the resultant; in the water it's just the heading
      var endX = river ? -p.vb * Math.sin(p.a * K.DEG) * t.t : t.drift;
      var a = sim.px(0, 0), e = sim.px(endX, p.d);
      ctx.strokeStyle = K.alpha(th.ink, 0.35); ctx.lineWidth = sim.u(1.5); ctx.setLineDash([sim.u(6), sim.u(6)]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
      // the wake: each past position, measured in the chosen frame
      if (path.length > 1) {
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5);
        ctx.beginPath();
        path.forEach(function (q, i) {
          var x = river ? q[0] - p.vr * i * K.DT : q[0], pp = sim.px(x, q[1]);
          if (i) ctx.lineTo(pp.x, pp.y); else ctx.moveTo(pp.x, pp.y);
        });
        ctx.stroke();
      }
      drawVectors(ctx, p, t, sx);
      if (crossed) {
        var c = sim.px(crossed.drift, p.d);
        K.label(ctx, "landed " + K.fmt(Math.abs(crossed.drift), 1) + " m " + (crossed.drift >= 0 ? "downstream" : "upstream"), c.x + sx, c.y - sim.u(14), th.ink, { s: sim.u(1), bg: true });
      }
    });

    // velocity triangle at the boat: boat-relative-to-water + water = boat-relative-to-ground
    function drawVectors(ctx, p, t, sx) {
      if (!boat) return;
      var b = { x: boat.position.x + sx, y: boat.position.y }, k = sim.u(22), s = sim.u(1.15);
      var hx = -p.vb * Math.sin(p.a * K.DEG), hy = p.vb * Math.cos(p.a * K.DEG);
      if (frame === "river") {
        K.arrow(ctx, b.x, b.y, b.x + hx * k, b.y - hy * k, th.vel, { s: s, label: "v_b (= v here)" });
        return;
      }
      K.arrow(ctx, b.x, b.y, b.x + hx * k, b.y - hy * k, th.vel, { s: s, label: "v_b" });
      K.arrow(ctx, b.x + hx * k, b.y - hy * k, b.x + hx * k + p.vr * k, b.y - hy * k, th.disp, { s: s, label: "v_r", ly: -8 });
      K.arrow(ctx, b.x, b.y, b.x + t.vx * k, b.y - t.vy * k, th.ink, { s: s, width: 3, label: "v = " + K.fmt(t.speed, 1) + " m/s", lx: 8, ly: 10 });
    }

    function drawBoat(ctx, b) {
      var p = params(), a = p.a * K.DEG, L = Math.max(4 * ppm, sim.u(34)), Wd = Math.max(1.8 * ppm, sim.u(15));
      ctx.save(); ctx.translate(b.position.x + shift(), b.position.y);
      ctx.rotate(-a);                       // nose points along the heading (up = across)
      ctx.fillStyle = th.acc;
      ctx.beginPath();
      ctx.moveTo(0, -L / 2); ctx.quadraticCurveTo(Wd / 2, -L / 6, Wd / 2, L / 2); ctx.lineTo(-Wd / 2, L / 2); ctx.quadraticCurveTo(-Wd / 2, -L / 6, 0, -L / 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(-Wd / 4, 0, Wd / 2, L / 4);
      ctx.restore();
    }
    function drawLog(ctx, b) {
      ctx.save(); ctx.translate(b.position.x + shift(), b.position.y); ctx.rotate(b.angle);
      var L = 5 * ppm, Wd = Math.max(1 * ppm, sim.u(4));
      ctx.fillStyle = "#8a6a43"; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
      ctx.fillStyle = "#6f5233"; ctx.beginPath(); ctx.arc(L / 2, 0, Wd / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">across (y) vs t</b> · slope $v_b\\cos\\alpha$ sets the crossing time</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">downstream (x) vs t</b> · slope $v_r - v_b\\sin\\alpha$ is the drift rate</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">path (y vs x)</b> · a straight line: both speeds are constant</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gY = new K.Graph(cv[0], { yLabel: "y (m)", xMax: 1, xAuto: true, yMin: 0, color: th.disp });
    var gX = new K.Graph(cv[1], { yLabel: "x (m)", xMax: 1, xAuto: true, color: th.disp });
    var gP = new K.Graph(cv[2], { yLabel: "y (m)", xLabel: "x (m)", xMax: 1, xAuto: true, yMin: 0, color: th.disp });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), t = theory(p);
      var tY = [[0, 0], [t.t, p.d]], tX = [[0, 0], [t.t, t.drift]];
      gY.set("theory", { points: tY, color: th.disp, dash: [5, 5], width: 1.5 });
      gX.set("theory", { points: tX, color: th.disp, dash: [5, 5], width: 1.5 });
      gY.set("sim", { points: path.map(function (q, i) { return [i * K.DT, Math.max(0, q[1])]; }), color: th.disp, width: 2.5, dot: true });
      gX.set("sim", { points: path.map(function (q, i) { return [i * K.DT, q[0]]; }), color: th.disp, width: 2.5, dot: true });
      // the path graph needs x >= 0 for its axis, so plot |x| with a note when drifting upstream
      var flip = t.drift < 0 ? -1 : 1;
      gP.set("theory", { points: [[0, 0], [Math.abs(t.drift), p.d]], color: th.disp, dash: [5, 5], width: 1.5 });
      gP.set("sim", { points: path.map(function (q) { return [Math.max(0, q[0] * flip), Math.max(0, q[1])]; }), color: th.disp, width: 2.5, dot: true });
      gP.o.xLabel = flip < 0 ? "upstream (m)" : "downstream (m)";
      [gY, gX, gP].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Add the velocities (as vectors)", "Across: sets the time", "Downstream: sets the drift", "Two special headings"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "t", label: "crossing time" }, { id: "drift", label: "drift", cls: "c-disp" }, { id: "v", label: "speed over ground" },
      { id: "dir", label: "direction of travel" }, { id: "vy", label: "across speed", cls: "c-vel" }, { id: "vx", label: "downstream speed", cls: "c-disp" }
    ]);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = params(), t = theory(p);
      K.tex(eqEls[0], "\\vec v = \\vec v_{b} + \\vec v_{r} \\;\\Rightarrow\\; |\\vec v| = \\sqrt{v_x^2 + v_y^2} = \\mathbf{" + K.fmt(t.speed, 2) + "}\\ \\text{m/s}");
      K.tex(eqEls[1], "t = \\frac{d}{v_b\\cos\\alpha} = \\frac{" + p.d + "}{" + p.vb + "\\cos" + n(p.a, 0) + "^\\circ} = \\mathbf{" + K.fmt(t.t, 2) + "}\\ \\text{s}");
      K.tex(eqEls[2], "x = (v_r - v_b\\sin\\alpha)\\,t = (" + p.vr + " - " + p.vb + "\\sin" + n(p.a, 0) + "^\\circ)\\times" + K.fmt(t.t, 2) + " = \\mathbf{" + K.fmt(t.drift, 1) + "}\\ \\text{m}");
      var opp = p.vb > p.vr ? "\\sin\\alpha = \\tfrac{v_r}{v_b} \\Rightarrow \\alpha = " + K.fmt(Math.asin(p.vr / p.vb) / K.DEG, 1) + "^\\circ" : "\\text{opposite impossible } (v_r \\ge v_b)";
      K.tex(eqEls[3], "\\text{fastest: } \\alpha = 0,\\ t_{min} = \\tfrac{d}{v_b} = " + K.fmt(p.d / p.vb, 1) + "\\text{ s} \\qquad \\text{opposite: } " + opp);
      setR("t", crossed ? K.fmt(crossed.t, 2) + " s" : "—", "formula " + K.fmt(t.t, 2) + " s");
      setR("drift", crossed ? K.fmt(crossed.drift, 2) + " m" : "—", "formula " + K.fmt(t.drift, 2) + " m");
      setR("v", K.fmt(t.speed, 2) + " m/s", "not just v_b + v_r");
      setR("dir", K.fmt(Math.abs(t.dir), 1) + "°", t.dir >= 0 ? "downstream of across" : "upstream of across");
      setR("vy", K.fmt(t.vy, 2) + " m/s", "v_b cos α");
      setR("vx", K.fmt(t.vx, 2) + " m/s", "v_r − v_b sin α");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Velocities add <b>as arrows</b>, not as numbers. The boat's velocity relative to the ground is its velocity relative to the water plus the water's velocity: $\\vec v = \\vec v_b + \\vec v_r$. That's the triangle drawn on the boat.</p>" +
      "<p>Split it up and the problem gets easy. Only the across part, $v_b\\cos\\alpha$, decides how long the crossing takes. The downstream part, $v_r - v_b\\sin\\alpha$, decides where you land.</p>" +
      "<p>Switch to the <b>River</b> frame: the current disappears, and the boat goes exactly where it's pointed. Same motion, different observer.</p>" +
      '<div class="trap"><b>JEE trap: \"shortest time\" and \"shortest path\" are different headings.</b> Shortest time means pointing straight across ($\\alpha = 0$). Shortest path means cancelling the drift ($\\sin\\alpha = v_r/v_b$), which only works if $v_b > v_r$.</div>');
    K.quiz(P.quiz, {
      q: "A river 100 m wide flows at 3 m/s. A swimmer who can swim at 5 m/s in still water wants to reach the point directly opposite. How long does the crossing take?",
      options: ["20 s", "25 s", "33.3 s", "12.5 s"], answer: 1,
      explain: "To cancel the current he aims upstream with $5\\sin\\alpha = 3$, so $\\sin\\alpha = 0.6$ and his across speed is $5\\cos\\alpha = 4$ m/s. Time $= 100 / 4 = 25$ s. Set $d = 100$, $v_r = 3$, $v_b = 5$ and press <i>Aim to land opposite</i> to check."
    });

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Go", onReset: reset, onPlay: function () { if (crossed) reset(); } });
    reset();
    sim.zoom = zoomTarget;

    return function destroy() { sim.destroy(); [gY, gX, gP].forEach(function (g) { g.destroy(); }); };
  }
})();
