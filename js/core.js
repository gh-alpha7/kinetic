/* Kinetic core: matter.js world in SI units, a fixed-step clock, drawing, graphs and lab UI parts. */
var K = (function () {
  "use strict";

  var STEP = 1000 / 60;          // ms per physics step
  var DT = STEP / 1000;          // s per physics step
  var uid = 0;

  /* ---------- theme (canvas reads the same CSS variables as the page) ---------- */
  var theme = {};
  var THEME_KEYS = ["canvas-bg", "grid", "grid-strong", "ground", "ground-top", "body", "ink", "muted", "disp", "vel",
    "acc", "grav", "water", "water-2", "bank", "surface", "surface-2", "line", "good", "bad", "normal", "fric", "app", "ten"];
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    THEME_KEYS.forEach(function (k) { theme[k] = cs.getPropertyValue("--" + k).trim(); });
  }
  readTheme();
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(readTheme);
  }

  /* ---------- small helpers ---------- */
  function h(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return "—";
    var v = Number(n.toFixed(d === undefined ? 1 : d));
    if (Object.is(v, -0)) v = 0;
    return v.toFixed(d === undefined ? 1 : d);
  }
  // "#16a34a" + alpha -> "rgba(...)" (canvas has no color-mix)
  function alpha(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function decimals(step) { var s = String(step); return s.indexOf(".") === -1 ? 0 : s.length - s.indexOf(".") - 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var DEG = Math.PI / 180;

  // "text with $\LaTeX$ bits" -> HTML
  function md(text) {
    return String(text).replace(/\$([^$]+)\$/g, function (_, tex) {
      try { return katex.renderToString(tex, { throwOnError: false }); } catch (e) { return tex; }
    });
  }
  function tex(el, s) {
    if (el._tex === s) return;           // skip re-rendering identical maths
    el._tex = s;
    try { katex.render(s, el, { throwOnError: false, displayMode: false }); } catch (e) { el.textContent = s; }
  }

  /* ---------- controls ---------- */
  function slider(o) {
    var id = "k" + (++uid);
    var d = o.digits === undefined ? decimals(o.step) : o.digits;
    var el = h('<div class="control"><div class="control-top"><label for="' + id + '">' + md(o.label) + "</label><output></output></div>" +
      '<input id="' + id + '" type="range" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + o.value + '" />' +
      (o.hint ? '<p class="control-hint">' + md(o.hint) + "</p>" : "") + "</div>");
    var input = el.querySelector("input"), out = el.querySelector("output");
    function show() { out.innerHTML = fmt(+input.value, d) + (o.unit ? " " + o.unit : ""); }
    input.addEventListener("input", function () { show(); if (o.onInput) o.onInput(+input.value); });
    show();
    return { el: el, input: input, get: function () { return +input.value; }, set: function (v) { input.value = v; show(); } };
  }

  function seg(options, value, onChange, label) {
    var el = h('<div class="seg" role="group"' + (label ? ' aria-label="' + label + '"' : "") + "></div>");
    options.forEach(function (op) {
      var b = h('<button type="button">' + op.label + "</button>");
      b.dataset.value = op.value;
      b.setAttribute("aria-pressed", String(op.value === value));
      b.addEventListener("click", function () {
        el.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onChange(op.value);
      });
      el.appendChild(b);
    });
    return el;
  }

  function check(label, value, onChange) {
    var el = h('<label class="check"><input type="checkbox"' + (value ? " checked" : "") + " /> " + label + "</label>");
    el.querySelector("input").addEventListener("change", function (e) { onChange(e.target.checked); });
    return el;
  }

  /* ---------- the simulation world ---------- */
  // World coordinates: metres, x to the right, y UP. Matter works in px with y down;
  // o.origin is where (0, 0) m sits in world px. Gravity g (m/s^2) pulls towards -y.
  function Sim(canvas, o) {
    var self = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = o.W; this.H = o.H; this.ppm = o.ppm; this.origin = o.origin;
    this.opts = o;
    this.engine = Matter.Engine.create({ enableSleeping: false });
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 1;
    this.world = this.engine.world;
    this.setG(o.g || 0);
    this.steps = 0; this.time = 0;
    this.running = false; this.speed = 1; this.acc = 0; this.last = 0;
    this.hooks = { before: [], step: [], under: [], over: [] };
    this.scale = 1; this.dpr = 1;

    this.ro = new ResizeObserver(function () { self.fit(); });
    this.ro.observe(canvas);
    this.fit();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
    if (location.hostname === "localhost") (window.__sims = window.__sims || []).push(this);   // dev-only test hook
  }

  // matter: velocity += (force/mass) * dt_ms^2 per step, so acceleration is
  // gravity.scale * 1e6 px/s^2. Choose scale so that equals g * ppm.
  Sim.prototype.setG = function (g) { this.g = g; this.engine.gravity.scale = g * this.ppm / 1e6; };

  Sim.prototype.fit = function () {
    var w = this.canvas.clientWidth || this.W;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = w / this.W;
    this.canvas.style.height = (w * this.H / this.W) + "px";
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(w * this.H / this.W * this.dpr);
  };

  Sim.prototype.px = function (xm, ym) { return { x: this.origin.x + xm * this.ppm, y: this.origin.y - ym * this.ppm }; };
  Sim.prototype.m = function (px, py) { return { x: (px - this.origin.x) / this.ppm, y: (this.origin.y - py) / this.ppm }; };
  Sim.prototype.posM = function (body) { return this.m(body.position.x, body.position.y); };

  // Set a body's velocity in m/s for motion under constant acceleration (ax, ay) m/s^2.
  // Starting half a step behind makes the stepped positions land exactly on
  // x = x0 + ut + at^2/2 at every step, instead of drifting by a*t*dt/2.
  Sim.prototype.setVel = function (body, vx, vy, ax, ay) {
    ax = ax || 0; ay = ay === undefined ? -this.g : ay;
    var k = this.ppm / 60;   // m/s -> px per 1/60 s step
    Matter.Body.setVelocity(body, { x: (vx - 0.5 * ax * DT) * k, y: -(vy - 0.5 * ay * DT) * k });
  };
  // The body's true velocity now (m/s), undoing the half-step offset above.
  Sim.prototype.getVel = function (body, ax, ay) {
    ax = ax || 0; ay = ay === undefined ? -this.g : ay;
    var v = Matter.Body.getVelocity(body), k = 60 / this.ppm;
    return { x: v.x * k + 0.5 * ax * DT, y: -v.y * k + 0.5 * ay * DT };
  };
  // A steady push of (ax, ay) m/s^2 on one body, applied every step.
  Sim.prototype.push = function (body, ax, ay) {
    var s = this.ppm / 1e6;
    body.force.x += body.mass * ax * s;
    body.force.y += -body.mass * ay * s;
  };

  Sim.prototype.add = function (b) { Matter.Composite.add(this.world, b); return b; };
  Sim.prototype.remove = function (b) { Matter.Composite.remove(this.world, b); };
  Sim.prototype.on = function (kind, fn) { this.hooks[kind].push(fn); return this; };
  Sim.prototype.collide = function (fn) { Matter.Events.on(this.engine, "collisionStart", fn); };

  Sim.prototype.play = function () { this.running = true; };
  Sim.prototype.pause = function () { this.running = false; };
  Sim.prototype.resetClock = function () { this.steps = 0; this.time = 0; this.acc = 0; };
  Sim.prototype.stepOnce = function () {
    var self = this;
    this.hooks.before.forEach(function (f) { f(self.time); });
    Matter.Engine.update(this.engine, STEP);
    this.steps++;
    this.time = this.steps * DT;
    this.hooks.step.forEach(function (f) { f(self.time); });
  };
  Sim.prototype.frame = function (ts) {
    var dt = this.last ? Math.min(ts - this.last, 100) : 0;
    this.last = ts;
    if (this.running) {
      this.acc += dt * this.speed;
      var n = 0;
      while (this.acc >= STEP && n < 8 && this.running) { this.stepOnce(); this.acc -= STEP; n++; }
      if (n >= 8) this.acc = 0;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };
  Sim.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    Matter.Engine.clear(this.engine);
  };

  /* ---------- drawing ---------- */
  // Camera: zoom < 1 shows more of the world, anchored at the bottom edge so the ground
  // stays put while the view grows upward; panX (world px) slides the view sideways.
  Sim.prototype.view = function () {
    var z = this.zoom || 1, pan = this.panX || 0;
    return { x0: pan, x1: pan + this.W / z, y0: this.H - this.H / z, y1: this.H, z: z };
  };
  // UI sizes (line widths, fonts) divided by zoom so they stay the same on screen
  // ...and never let them shrink below ~55% on small screens, so labels stay readable on phones
  Sim.prototype.u = function (n) { return n / (this.zoom || 1) / clamp(this.scale, 0.55, 1); };

  Sim.prototype.draw = function () {
    var ctx = this.ctx, self = this, base = this.scale * this.dpr, v = this.view();
    ctx.setTransform(base * v.z, 0, 0, base * v.z, -v.x0 * base * v.z, this.H * base * (1 - v.z));
    ctx.fillStyle = theme["canvas-bg"];
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (this.opts.grid !== false) this.drawGrid();
    this.hooks.under.forEach(function (f) { f(ctx); });
    Matter.Composite.allBodies(this.world).forEach(function (b) { self.drawBody(b); });
    this.hooks.over.forEach(function (f) { f(ctx); });
  };

  Sim.prototype.drawGrid = function () {
    var ctx = this.ctx, o = this.origin, ppm = this.ppm, v = this.view();
    // keep grid lines at least ~7 screen px apart as the camera zooms out
    var steps = [1, 2, 5, 10, 20, 50, 100, 200], base = this.opts.gridStep || 1, k = 0;
    while (k < steps.length - 1 && base * steps[k] * ppm * v.z < 7) k++;
    var step = base * steps[k];
    var major = Math.max(this.opts.gridMajor || 5, step * 5);
    var x0 = Math.floor((v.x0 - o.x) / ppm / step) * step, x1 = (v.x1 - o.x) / ppm;
    var y0 = Math.floor((o.y - v.y1) / ppm / step) * step, y1 = (o.y - v.y0) / ppm;
    var isMajor = function (n) { return Math.abs(n / major - Math.round(n / major)) < 1e-6; };
    ctx.lineWidth = this.u(1);
    for (var x = x0; x <= x1; x += step) {
      var px = o.x + x * ppm;
      ctx.strokeStyle = isMajor(x) ? theme["grid-strong"] : theme.grid;
      ctx.beginPath(); ctx.moveTo(px, v.y0); ctx.lineTo(px, v.y1); ctx.stroke();
    }
    for (var y = y0; y <= y1; y += step) {
      var py = o.y - y * ppm;
      ctx.strokeStyle = isMajor(y) ? theme["grid-strong"] : theme.grid;
      ctx.beginPath(); ctx.moveTo(v.x0, py); ctx.lineTo(v.x1, py); ctx.stroke();
    }
    if (this.opts.labels !== false) {
      ctx.fillStyle = theme.muted;
      ctx.font = "600 " + this.u(11) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      var ly = Math.min(o.y + this.u(6), v.y1 - this.u(14));
      for (var lx = Math.ceil(x0 / major) * major; lx <= x1; lx += major) {
        if (lx < 0) continue;
        ctx.fillText(lx + " m", o.x + lx * ppm, ly);
      }
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      if (this.opts.yLabels !== false) {
        for (var lyv = major; lyv <= y1; lyv += major) ctx.fillText(lyv + " m", Math.max(v.x0 + this.u(4), o.x + this.u(4)), o.y - lyv * ppm);
      }
    }
  };

  Sim.prototype.drawBody = function (b) {
    var k = b.plugin && b.plugin.k;
    if (!k || k.hidden) return;
    var ctx = this.ctx;
    if (k.draw) { k.draw(ctx, b); return; }
    ctx.save();
    ctx.fillStyle = k.fill || theme.body;
    if (b.circleRadius) {
      ctx.beginPath(); ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2); ctx.fill();
      if (k.shine !== false) {
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.beginPath(); ctx.arc(b.position.x - b.circleRadius * .35, b.position.y - b.circleRadius * .35, b.circleRadius * .35, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.beginPath();
      b.vertices.forEach(function (v, i) { if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); });
      ctx.closePath(); ctx.fill();
      if (k.stroke) { ctx.strokeStyle = k.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.restore();
  };

  // ground strip from the origin line down to the bottom of the canvas
  // A force arrow from (x, y) in world px. fx, fy are newtons with y up; kpn is screen px per newton.
  Sim.prototype.force = function (ctx, x, y, fx, fy, color, text, kpn, opt) {
    var k = this.u(kpn || 1), o = opt || {};
    arrow(ctx, x, y, x + fx * k, y - fy * k, color, { s: this.u(1), width: o.width || 3, head: 10, label: text, lx: o.lx, ly: o.ly, dash: o.dash });
  };

  Sim.prototype.drawGround = function (ctx, yPx) {
    var v = this.view();
    yPx = yPx === undefined ? this.origin.y : yPx;
    ctx.fillStyle = theme.ground;
    ctx.fillRect(v.x0, yPx, v.x1 - v.x0, v.y1 - yPx);
    ctx.fillStyle = theme["ground-top"];
    ctx.fillRect(v.x0, yPx, v.x1 - v.x0, this.u(2));
  };

  // pointer events in world px and metres (zoom-aware)
  Sim.prototype.pointer = function (handlers) {
    var self = this, c = this.canvas, active = null;
    function at(e) {
      var r = c.getBoundingClientRect(), z = self.zoom || 1;
      var sx = (e.clientX - r.left) / self.scale, sy = (e.clientY - r.top) / self.scale;
      var px = sx / z + (self.panX || 0), py = self.H - (self.H - sy) / z;
      return { px: px, py: py, m: self.m(px, py) };
    }
    c.addEventListener("pointerdown", function (e) {
      var p = at(e);
      if (handlers.down && handlers.down(p, e) === false) return;
      active = e.pointerId;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ }
      e.preventDefault();
    });
    c.addEventListener("pointermove", function (e) {
      var p = at(e);
      if (e.pointerId === active) { if (handlers.drag) handlers.drag(p, e); }
      else if (handlers.hover) handlers.hover(p, e);
    });
    function end(e) { if (e.pointerId !== active) return; active = null; if (handlers.up) handlers.up(at(e), e); }
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  };

  // opt.s scales line width, head and text (pass 1/zoom to keep them screen-sized)
  function arrow(ctx, x1, y1, x2, y2, color, opt) {
    opt = opt || {};
    var s = opt.s || 1;
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 2 * s) return;
    var w = (opt.width || 2.5) * s, head = Math.min((opt.head || 9) * s, len * 0.5);
    var ux = dx / len, uy = dy / len;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
    if (opt.dash) ctx.setLineDash(opt.dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.55, y2 - uy * head + ux * head * 0.55);
    ctx.lineTo(x2 - ux * head + uy * head * 0.55, y2 - uy * head - ux * head * 0.55);
    ctx.closePath(); ctx.fill();
    if (opt.label) {
      ctx.font = "700 " + 12 * s + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(opt.label, x2 + (opt.lx === undefined ? 6 : opt.lx) * s, y2 + (opt.ly || 0) * s);
    }
    ctx.restore();
  }

  function label(ctx, text, x, y, color, opt) {
    opt = opt || {};
    var s = opt.s || 1;
    ctx.save();
    ctx.font = (opt.font || "700 " + 12 * s + "px 'JetBrains Mono', monospace");
    ctx.textAlign = opt.align || "center"; ctx.textBaseline = opt.base || "bottom";
    if (opt.bg) {
      var w = ctx.measureText(text).width + 10 * s;
      var bx = opt.align === "left" ? x - 5 * s : opt.align === "right" ? x - w + 5 * s : x - w / 2;
      ctx.fillStyle = theme.surface; ctx.globalAlpha = .9;
      ctx.fillRect(bx, y - 18 * s, w, 18 * s);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color || theme.ink;
    ctx.fillText(text, x, y - 3 * s);
    ctx.restore();
  }

  /* ---------- graphs ---------- */
  function Graph(canvas, o) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.o = o;
    this.series = {}; this.cursor = null; this.dirty = true;
    this.ro = new ResizeObserver(function () { self.fit(); });
    this.ro.observe(canvas);
    this.fit();
  }
  Graph.prototype.fit = function () {
    var r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width || 300; this.h = r.height || 170;
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.dirty = true; this.draw();
  };
  Graph.prototype.set = function (name, s) { this.series[name] = s; this.dirty = true; };
  Graph.prototype.clear = function () { this.series = {}; this.cursor = null; this.dirty = true; };
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  Graph.prototype.draw = function () {
    if (!this.dirty) return;
    this.dirty = false;
    var ctx = this.ctx, o = this.o, w = this.w, h = this.h, self = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var L = 44, R = 10, T = 12, B = 26;
    var xMax = o.xMax, yMin = 0, yMax = 0;
    Object.keys(this.series).forEach(function (k) {
      self.series[k].points.forEach(function (p) {
        if (o.xAuto && p[0] > xMax) xMax = p[0];
        if (p[1] < yMin) yMin = p[1];
        if (p[1] > yMax) yMax = p[1];
      });
    });
    if (o.yMin !== undefined) yMin = Math.min(yMin, o.yMin);
    if (o.yMax !== undefined) yMax = Math.max(yMax, o.yMax);
    if (yMax - yMin < 1e-9) { yMax += 1; yMin -= 1; }
    var pad = (yMax - yMin) * 0.08; yMax += pad; if (yMin < 0) yMin -= pad;
    var X = function (t) { return L + (t / xMax) * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin)) * (h - T - B); };

    // grid + ticks
    ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillStyle = theme.muted; ctx.lineWidth = 1;
    var ys = niceStep(yMax - yMin, 4);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? theme["grid-strong"] : theme.grid;
      ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
      ctx.fillText(fmt(v, ys < 1 ? 1 : 0), L - 6, Y(v));
    }
    var xs = niceStep(xMax, 5);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (var t = 0; t <= xMax + 1e-9; t += xs) {
      ctx.strokeStyle = theme.grid;
      ctx.beginPath(); ctx.moveTo(X(t), T); ctx.lineTo(X(t), h - B); ctx.stroke();
      ctx.fillText(fmt(t, xs < 1 ? 1 : 0), X(t), h - B + 5);
    }
    ctx.strokeStyle = theme["grid-strong"];
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
    ctx.save(); ctx.translate(11, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = o.color || theme.ink; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.fillText(o.yLabel, 0, 0); ctx.restore();
    ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = theme.muted;
    ctx.fillText(o.xLabel || "t (s)", w - R, h - B - 2);

    // series
    Object.keys(this.series).forEach(function (k) {
      var s = self.series[k], pts = s.points;
      if (!pts.length) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(L, T - 2, w - L - R, h - T - B + 4); ctx.clip();
      if (s.fill) {
        ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(0));
        pts.forEach(function (p) { ctx.lineTo(X(p[0]), Y(p[1])); });
        ctx.lineTo(X(pts[pts.length - 1][0]), Y(0)); ctx.closePath();
        ctx.fillStyle = s.fill; ctx.fill();
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.lineJoin = "round";
      if (s.dash) ctx.setLineDash(s.dash);
      ctx.beginPath();
      pts.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
      ctx.stroke();
      ctx.restore();
      if (s.dot && pts.length) {
        var last = pts[pts.length - 1];
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 4, 0, Math.PI * 2); ctx.fill();
      }
    });
    if (this.extra) this.extra(ctx, X, Y);
  };
  Graph.prototype.destroy = function () { this.ro.disconnect(); };

  /* ---------- experiments checklist ---------- */
  function Tries(el, labId, items, onChange) {
    var key = "kinetic:tries:" + labId, done = {};
    try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { done = {}; }
    el.innerHTML = "";
    var nodes = {};
    items.forEach(function (it) {
      var li = h('<li class="try' + (done[it.id] ? " done" : "") + '"><span class="tick" aria-hidden="true">✓</span>' +
        "<div><b>" + md(it.title) + "</b><p>" + md(it.text) + '</p><p class="why">' + md(it.why) + "</p></div></li>");
      nodes[it.id] = li; el.appendChild(li);
    });
    return {
      mark: function (id) {
        if (done[id] || !nodes[id]) return;
        done[id] = true;
        try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) { /* private mode */ }
        nodes[id].classList.add("done", "pop");
        if (onChange) onChange();
      },
      count: function () { return Object.keys(done).filter(function (k) { return nodes[k]; }).length; },
      total: items.length
    };
  }
  function progress(labId, total) {
    var done = {};
    try { done = JSON.parse(localStorage.getItem("kinetic:tries:" + labId) || "{}"); } catch (e) { done = {}; }
    return Math.min(Object.keys(done).length, total);
  }

  /* ---------- quiz ---------- */
  function quiz(el, q) {
    el.innerHTML = '<p class="quiz-q">' + md(q.q) + '</p><div class="quiz-opts"></div><div class="quiz-explain"></div>';
    var opts = el.querySelector(".quiz-opts"), ex = el.querySelector(".quiz-explain");
    q.options.forEach(function (text, i) {
      var b = h('<button type="button">' + String.fromCharCode(65 + i) + ". " + md(text) + "</button>");
      b.addEventListener("click", function () {
        opts.querySelectorAll("button").forEach(function (x, j) {
          x.classList.toggle("right", j === q.answer);
          x.classList.toggle("wrong", x === b && j !== q.answer);
        });
        ex.innerHTML = (i === q.answer ? "<b>Correct.</b> " : "<b>Not quite.</b> ") + md(q.explain);
        ex.classList.add("show");
      });
      opts.appendChild(b);
    });
  }

  /* ---------- practice: easy, medium, hard ---------- */
  // Each question: { level, tag, q, options, answer, explain, hints: [...], setup: {...}, watch: "what to look for" }
  // apply(setup) loads the question's numbers into the lab so students can predict, then test.
  function practice(el, questions, apply, parts) {
    var LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
    el.innerHTML = '<div class="qset"></div>';
    var box = el.querySelector(".qset");
    questions.forEach(function (q, qi) {
      var card = h('<article class="qcard lvl-' + q.level + '">' +
        '<header class="q-head"><span class="lvl">' + LEVELS[q.level] + '</span><span class="q-tag">' + md(q.tag || "") + "</span></header>" +
        '<p class="quiz-q">' + md(q.q) + '</p><div class="quiz-opts"></div>' +
        '<div class="q-tools"></div><ol class="q-hints"></ol><div class="quiz-explain"></div></article>');
      var opts = card.querySelector(".quiz-opts"), ex = card.querySelector(".quiz-explain");
      var tools = card.querySelector(".q-tools"), hintList = card.querySelector(".q-hints"), shown = 0;
      q.options.forEach(function (text, i) {
        var b = h('<button type="button">' + String.fromCharCode(65 + i) + ". " + md(text) + "</button>");
        b.addEventListener("click", function () {
          opts.querySelectorAll("button").forEach(function (x, j) {
            x.classList.toggle("right", j === q.answer);
            x.classList.toggle("wrong", x === b && j !== q.answer);
          });
          ex.innerHTML = (i === q.answer ? "<b>Correct.</b> " : "<b>Not quite.</b> ") + md(q.explain);
          ex.classList.add("show");
        });
        opts.appendChild(b);
      });
      if (q.hints && q.hints.length) {
        var hb = h('<button class="btn btn-sm" type="button">Hint 1 of ' + q.hints.length + "</button>");
        hb.addEventListener("click", function () {
          if (shown >= q.hints.length) return;
          hintList.appendChild(h("<li>" + md(q.hints[shown]) + "</li>"));
          shown++;
          if (shown >= q.hints.length) { hb.disabled = true; hb.textContent = "No more hints"; }
          else hb.textContent = "Hint " + (shown + 1) + " of " + q.hints.length;
        });
        tools.appendChild(hb);
      }
      if (q.setup && apply) {
        var sb = h('<button class="btn btn-sm btn-primary" type="button">Set it up in the lab ↑</button>');
        sb.addEventListener("click", function () {
          apply(q.setup);
          if (parts) {
            parts.root.querySelector(".stage").scrollIntoView({ behavior: "smooth", block: "center" });
            flash(parts.note, q.watch || "Predict the answer, then press play", 5000);
          }
        });
        tools.appendChild(sb);
      }
      void qi;
      box.appendChild(card);
    });
  }

  /* ---------- lab page scaffold ---------- */
  var labs = [];
  // chapters in the order they appear; labs register into them
  var CHAPTERS = [
    { id: "kinematics", title: "Kinematics" },
    { id: "laws", title: "Laws of motion" }
  ];
  function registerLab(lab) { labs.push(lab); }
  function chapterLabs(id) { return labs.filter(function (l) { return l.chapter === id; }); }
  function chapter(id) { return CHAPTERS.filter(function (c) { return c.id === id; })[0]; }
  function href(l) { return "#/" + l.chapter + "/" + l.id; }

  // Builds the common lab layout and returns handles to each region.
  function scaffold(root, lab) {
    var ch = chapter(lab.chapter), list = chapterLabs(lab.chapter), i = list.indexOf(lab);
    var prev = list[i - 1], next = list[i + 1], nextCh = null;
    if (!next) {
      // the last lab points on to the next chapter that has labs
      var ci = CHAPTERS.indexOf(ch);
      for (var k = ci + 1; k < CHAPTERS.length && !nextCh; k++) if (chapterLabs(CHAPTERS[k].id).length) nextCh = CHAPTERS[k];
    }
    var nextLink = next ? '<a class="next" href="' + href(next) + '"><span>next →</span><b>' + next.title + "</b></a>"
      : nextCh ? '<a class="next" href="' + href(chapterLabs(nextCh.id)[0]) + '"><span>next chapter →</span><b>' + nextCh.title + "</b></a>" : "";
    var el = h(
      '<section class="lab">' +
        '<nav class="lab-nav" aria-label="' + ch.title + ' labs"><h2>' + ch.title + "</h2>" +
          list.map(function (l, j) {
            return '<a href="' + href(l) + '"' + (l === lab ? ' aria-current="page"' : "") + ">" +
              "<b>" + (j + 1) + ". " + l.title + "</b><span>" + l.short + '</span><span class="prog" data-prog="' + l.id + '"></span></a>';
          }).join("") +
        "</nav>" +
        '<div class="lab-main">' +
          '<header class="lab-head"><p class="eyebrow">' + ch.title + " · lab " + (i + 1) + " of " + list.length + "</p><h1>" + lab.title + '</h1><p class="lede">' + md(lab.lede) + "</p></header>" +
          '<div class="stage-row">' +
            '<div class="stage-col"><div class="stage"><canvas></canvas><div class="hud"></div><div class="stage-note"></div>' +
              '<div class="stage-bar">' +
                '<button class="btn btn-primary btn-sm" data-act="play" type="button"></button>' +
                '<button class="btn btn-sm" data-act="reset" type="button">Reset</button>' +
                '<span class="spacer"></span><span class="time mono">t = 0.00 s</span><span class="speed"></span>' +
              "</div></div>" +
              '<div class="panel"><h2>Live graphs <small>solid = simulated · dashed = formula</small></h2><div class="graphs"></div></div>' +
            "</div>" +
            '<div class="controls"></div>' +
          "</div>" +
          '<div class="panels">' +
            '<div class="panel"><h2>The maths, live <small>your numbers</small></h2><div class="eqs"></div></div>' +
            '<div class="panel"><h2>Readouts</h2><div class="readouts"></div></div>' +
            '<div class="panel"><h2>Try this <small class="tries-count"></small></h2><ul class="tries"></ul></div>' +
            '<div class="panel concept"><h2>The idea</h2><div class="concept-body"></div></div>' +
            '<div class="panel wide"><h2>How it connects <small>cause → effect · tap a concept</small></h2><div class="cmap-slot"></div></div>' +
            '<div class="panel wide"><h2>Practice <small>easy → hard · predict, then test it in the lab</small></h2><div class="quiz"></div></div>' +
          "</div>" +
          '<nav class="pager">' +
            (prev ? '<a class="prev" href="' + href(prev) + '"><span>← previous</span><b>' + prev.title + "</b></a>" : "<span></span>") +
            nextLink +
          "</nav>" +
        "</div>" +
      "</section>");
    root.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var parts = {
      root: el, canvas: q(".stage canvas"), hud: q(".hud"), note: q(".stage-note"), controls: q(".controls"),
      graphs: q(".graphs"), eqs: q(".eqs"), readouts: q(".readouts"), tries: q(".tries"),
      concept: q(".concept-body"), quiz: q(".quiz"), cmap: q(".cmap-slot"), playBtn: q('[data-act="play"]'), resetBtn: q('[data-act="reset"]'),
      time: q(".time"), speedSlot: q(".speed"), triesCount: q(".tries-count")
    };
    if (window.Maps) Maps.forLab(parts.cmap, lab.id);
    refreshProgress(el);
    return parts;
  }
  function refreshProgress(el) {
    el.querySelectorAll("[data-prog]").forEach(function (n) {
      var lab = labs.filter(function (l) { return l.id === n.dataset.prog; })[0];
      if (!lab) return;
      var p = progress(lab.id, lab.tries.length);
      n.textContent = p ? p + "/" + lab.tries.length + " experiments" : "";
    });
  }

  // play/pause/reset/speed wiring shared by every lab
  function transport(parts, sim, opts) {
    var playIcon = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
    var pauseIcon = '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
    function render() { parts.playBtn.innerHTML = sim.running ? pauseIcon + "Pause" : playIcon + (opts.playLabel || "Play"); }
    parts.playBtn.addEventListener("click", function () {
      if (sim.running) sim.pause(); else { if (opts.onPlay) opts.onPlay(); sim.play(); }
      render();
    });
    parts.resetBtn.addEventListener("click", function () { sim.pause(); opts.onReset(); render(); });
    parts.speedSlot.appendChild(seg([{ label: "¼×", value: 0.25 }, { label: "½×", value: 0.5 }, { label: "1×", value: 1 }], 1,
      function (v) { sim.speed = v; }, "Speed"));
    sim.on("step", function (t) { parts.time.textContent = "t = " + fmt(t, 2) + " s"; });
    render();
    return { render: render };
  }

  function readout(el, items) {
    el.innerHTML = "";
    var map = {};
    items.forEach(function (it) {
      var n = h('<div class="readout"><span>' + it.label + '</span><b class="' + (it.cls || "") + '">—</b> <small></small></div>');
      map[it.id] = { b: n.querySelector("b"), s: n.querySelector("small") };
      el.appendChild(n);
    });
    return function set(id, value, note) {
      if (!map[id]) return;
      map[id].b.textContent = value;
      map[id].s.textContent = note || "";
    };
  }

  function flash(el, text, ms) {
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, ms || 2200);
  }

  function throttle(fn, ms) {
    var last = 0;
    return function () { var now = performance.now(); if (now - last >= ms) { last = now; fn(); } };
  }

  return {
    STEP: STEP, DT: DT, DEG: DEG, theme: theme, h: h, fmt: fmt, alpha: alpha, clamp: clamp, md: md, tex: tex,
    slider: slider, seg: seg, check: check, Sim: Sim, Graph: Graph, arrow: arrow, label: label,
    Tries: Tries, quiz: quiz, practice: practice, labs: labs, registerLab: registerLab, scaffold: scaffold, refreshProgress: refreshProgress,
    CHAPTERS: CHAPTERS, chapterLabs: chapterLabs, chapter: chapter,
    transport: transport, readout: readout, flash: flash, throttle: throttle
  };
})();
