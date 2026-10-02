/* Playground: students build their own system from parts (blocks, balls, surfaces, pulleys,
   strings, springs, turntables) and run it. matter.js finds the contacts and their normal forces;
   strings, Coulomb friction, springs, mutual gravity and turntables are solved here, after each
   engine step, so they follow the textbook models. World units: metres, y up. */
var Playground = (function () {
  "use strict";

  var W = 1200, H = 680, PPM = 50, ORIGIN = { x: 60, y: 620 }, THICK = 0.3, SOFT2 = 0.01;
  var DT = K.DT, SUB = 4, HS = DT / SUB, DEG = K.DEG, ZERO = { x: 0, y: 0 };   // 4 physics substeps per 1/60 s frame
  var KEY = "kinetic:playground";

  var DEFAULTS = {
    block: { w: 0.8, h: 0.8, m: 2, angle: 0, vx: 0, vy: 0, e: 0, mus: 0.4, muk: 0.3, pinned: false, trail: false },
    ball: { r: 0.3, m: 1, vx: 0, vy: 0, e: 0.5, mus: 0.4, muk: 0.3, pinned: false, trail: false },
    surface: { mus: 0.4, muk: 0.3, e: 0, wedge: false },
    pulley: { r: 0.3 },
    mpulley: { r: 0.3, m: 0.05 },
    anchor: {},
    string: { pts: [], slack: 0 },
    spring: { k: 40, stretch: 0 },
    turntable: { r: 2.5, w0: 0, alpha: 0.3, mus: 0.4, muk: 0.3 }
  };
  var NAMES = { block: "Block", ball: "Ball", surface: "Surface", pulley: "Pulley", mpulley: "Movable pulley",
    anchor: "Fixed point", string: "String", spring: "Spring", turntable: "Turntable" };

  var TOOLS = [
    { id: "select", label: "Select", key: "v", hint: "Click a part to edit it, drag to move it. While running, drag a body to throw it." },
    { id: "block", label: "Block", key: "b", hint: "Click to place a block. Drop it on a surface and it lines up with it." },
    { id: "ball", label: "Ball", key: "o", hint: "Click to place a ball" },
    { id: "surface", label: "Surface", key: "s", hint: "Drag to draw a floor, wall, table top or ramp (snaps to 5°)" },
    { id: "pulley", label: "Pulley", key: "p", hint: "Click to fix a pulley wheel in place" },
    { id: "mpulley", label: "Movable pulley", key: "m", hint: "Click to place a light pulley that hangs on the string" },
    { id: "string", label: "String", key: "t", hint: "Click one end (a block, ball or empty space), then each pulley in order, then the other end" },
    { id: "spring", label: "Spring", key: "k", hint: "Click one end, then the other (a block, ball or empty space for a fixed point)" },
    { id: "turntable", label: "Turntable", key: "r", hint: "Click to place a spinning disc. Put blocks on it and press Play.", mode: "top" },
    { id: "erase", label: "Erase", key: "x", hint: "Click a part to delete it" }
  ];
  var MODES = [{ label: "Side view", value: "side" }, { label: "Table top", value: "top" }, { label: "Space", value: "space" }];

  /* ---------- the build, as plain data (so it can be saved, undone and shared) ---------- */
  function blank(mode) {
    var st = { world: { mode: mode || "side", g: 9.8, G: mode === "space" ? 10 : 0, fmus: 0.3, fmuk: 0.2, vel: true, fbd: true, trails: mode === "space", zoom: 1 }, items: [], next: 1 };
    if (st.world.mode === "side") floor(st);
    return st;
  }
  function add(st, it) {
    var o = JSON.parse(JSON.stringify(DEFAULTS[it.type]));
    Object.keys(it).forEach(function (k) { o[k] = it[k]; });
    o.id = "i" + st.next++;
    st.items.push(o);
    return o.id;
  }
  function floor(st, mus, muk) {
    return add(st, { type: "surface", x1: -14, y1: -THICK / 2, x2: 38, y2: -THICK / 2, mus: mus == null ? 0.4 : mus, muk: muk == null ? 0.3 : muk, floor: true });
  }

  /* ---------- ready-made setups ---------- */
  var PRESETS = [
    { id: "table", title: "Table + hanging mass", watch: "Does static friction hold it? Select the block to see its forces.",
      make: function () {
        var st = blank("side");
        add(st, { type: "surface", x1: 2, y1: 4, x2: 10, y2: 4, mus: 0.5, muk: 0.3 });
        add(st, { type: "surface", x1: 2.4, y1: 3.85, x2: 2.4, y2: 0 });
        add(st, { type: "surface", x1: 9.6, y1: 3.85, x2: 9.6, y2: 0 });
        var a = add(st, { type: "block", x: 6, y: 4.55, w: 1, h: 0.8, m: 3 });
        var p = add(st, { type: "pulley", x: 10.45, y: 4.3, r: 0.25 });
        var b = add(st, { type: "block", x: 10.7, y: 2.3, w: 0.6, h: 0.6, m: 2 });
        add(st, { type: "string", pts: [a, p, b] });
        return st;
      } },
    { id: "atwood2", title: "Two-pulley Atwood", watch: "Predict a and T first: 3 kg against 5 kg.",
      make: function () {
        var st = blank("side");
        var a = add(st, { type: "block", x: 7.7, y: 5, w: 0.8, h: 0.8, m: 3 });
        var p1 = add(st, { type: "pulley", x: 8, y: 10 }), p2 = add(st, { type: "pulley", x: 14, y: 10 });
        var b = add(st, { type: "block", x: 14.3, y: 6, w: 0.9, h: 0.9, m: 5 });
        add(st, { type: "string", pts: [a, p1, p2, b] });
        return st;
      } },
    { id: "movable", title: "Movable pulley", watch: "2 kg holds 4 kg. Change the 2 kg mass and compare the two accelerations.",
      make: function () {
        var st = blank("side");
        var an = add(st, { type: "anchor", x: 7, y: 11.5 });
        var mp = add(st, { type: "mpulley", x: 7.3, y: 6.5, r: 0.3, m: 0.01 });
        var fp = add(st, { type: "pulley", x: 7.9, y: 11.5, r: 0.3 });
        var b = add(st, { type: "block", x: 8.2, y: 7, w: 0.6, h: 0.6, m: 2 });
        var a = add(st, { type: "block", x: 7.3, y: 4, w: 0.8, h: 0.8, m: 4 });
        add(st, { type: "string", pts: [an, mp, fp, b] });
        add(st, { type: "string", pts: [mp, a] });
        return st;
      } },
    { id: "ramp", title: "Ramp + pulley", watch: "Which way does it go? Compare m₂g with m₁g sin θ + friction.",
      make: function () {
        var st = blank("side");
        add(st, { type: "surface", x1: 3, y1: 0, x2: 11, y2: 4.6188, mus: 0.3, muk: 0.2, wedge: true });
        var a = add(st, { type: "block", x: 6.189, y: 2.476, w: 0.8, h: 0.8, m: 2, angle: 30 });
        var p = add(st, { type: "pulley", x: 11.2397, y: 5.1036, r: 0.25 });
        var b = add(st, { type: "block", x: 11.4897, y: 2.5, w: 0.6, h: 0.6, m: 2 });
        add(st, { type: "string", pts: [a, p, b] });
        return st;
      } },
    { id: "loop", title: "Loop the loop", watch: "Watch the string's tension at the top. Then try a smaller speed.",
      make: function () {
        var st = blank("side");
        var an = add(st, { type: "anchor", x: 11, y: 7.5 });
        var b = add(st, { type: "ball", x: 11, y: 4.5, r: 0.25, m: 1, vx: 12.2, e: 0, trail: true });
        add(st, { type: "string", pts: [an, b] });
        return st;
      } },
    { id: "spring", title: "Spring + block", watch: "Predict the period: T = 2π√(m/k).",
      make: function () {
        var st = blank("side");
        st.items[0].mus = 0; st.items[0].muk = 0;
        add(st, { type: "surface", x1: 2, y1: 0, x2: 2, y2: 3.5 });
        var an = add(st, { type: "anchor", x: 2.15, y: 0.5 });
        var b = add(st, { type: "block", x: 6, y: 0.5, w: 1, h: 1, m: 2 });
        add(st, { type: "spring", a: an, b: b, k: 20, stretch: 1 });
        return st;
      } },
    { id: "turntable", title: "Turntable", watch: "Looking down on a spinning disc. Which block flies off first?",
      make: function () {
        var st = blank("top");
        st.world.trails = true;
        add(st, { type: "turntable", x: 11, y: 6.5, r: 3, w0: 0, alpha: 0.25, mus: 0.4, muk: 0.3 });
        [1, 2, 2.8].forEach(function (r) { add(st, { type: "block", x: 11 + r, y: 6.5, w: 0.4, h: 0.4, m: 1 }); });
        return st;
      } },
    { id: "orbits", title: "Sun + two planets", watch: "Circular orbits need v = √(GM/r). Change a planet's speed.",
      make: function () {
        var st = blank("space");
        var v1 = Math.sqrt(10 * 50 / 3), v2 = Math.sqrt(10 * 50 / 5.5);
        add(st, { type: "ball", x: 11, y: 6.5, r: 0.6, m: 50, vy: -0.1 * (v1 - v2) / 50, e: 0 });
        add(st, { type: "ball", x: 14, y: 6.5, r: 0.2, m: 0.1, vy: v1, e: 0 });
        add(st, { type: "ball", x: 5.5, y: 6.5, r: 0.2, m: 0.1, vy: -v2, e: 0 });
        return st;
      } },
    { id: "eight", title: "Three-body figure eight", watch: "Three equal masses chasing each other. Nudge one and watch it fall apart.",
      make: function () {
        var st = blank("space");
        var c = { x: 11, y: 6.5 }, L = 4, V = Math.sqrt(10 * 10 / L), q = { x: 0.97000436, y: -0.24308753 }, v3 = { x: -0.93240737 * V, y: -0.86473146 * V };
        add(st, { type: "ball", x: c.x + L * q.x, y: c.y + L * q.y, r: 0.15, m: 10, vx: -v3.x / 2, vy: -v3.y / 2, e: 0 });
        add(st, { type: "ball", x: c.x - L * q.x, y: c.y - L * q.y, r: 0.15, m: 10, vx: -v3.x / 2, vy: -v3.y / 2, e: 0 });
        add(st, { type: "ball", x: c.x, y: c.y, r: 0.15, m: 10, vx: v3.x, vy: v3.y, e: 0 });
        return st;
      } },
    { id: "collide", title: "Collisions", watch: "Elastic, 1 kg into 3 kg at 6 m/s. Predict both speeds after.",
      make: function () {
        var st = blank("side");
        st.items[0].mus = 0; st.items[0].muk = 0;
        add(st, { type: "surface", x1: 0, y1: 0, x2: 0, y2: 3, e: 1 });
        add(st, { type: "surface", x1: 22, y1: 0, x2: 22, y2: 3, e: 1 });
        add(st, { type: "block", x: 4, y: 0.3, w: 0.6, h: 0.6, m: 1, vx: 6, e: 1 });
        add(st, { type: "block", x: 12, y: 0.4, w: 0.8, h: 0.8, m: 3, e: 1 });
        return st;
      } },
    { id: "empty", title: "Empty", watch: "Pick a tool and build something.", make: function () { return blank("side"); } }
  ];
  function preset(id) { return PRESETS.filter(function (p) { return p.id === id; })[0]; }

  var CHALLENGES = [
    { title: "Hold 4 kg with 2 kg", preset: "movable",
      q: "Can a 2 kg mass hold a 4 kg mass perfectly still? Try to build it before you load ours.",
      a: "Yes, with a movable pulley. Two strands of one string hold the 4 kg block, so $2T = 4g$ and $T = 2g$, which is exactly the 2 kg mass's weight. The catch: the 2 kg mass moves 2 m for every 1 m the block rises. Make it 2.5 kg and select each block: one accelerates at $g/14 = 0.70$ m/s², the other at twice that." },
    { title: "Loop the loop", preset: "loop",
      q: "A ball whirls round on a 3 m string. What is the least speed at the bottom that keeps the string tight all the way round?",
      a: "$v = \\sqrt{5gr} = \\sqrt{5 \\times 9.8 \\times 3} = 12.1$ m/s. At the top the string can only pull, so gravity alone must supply the centripetal force at the minimum: $v_{top} = \\sqrt{gr}$. Falling $2r$ adds $4gr$ to $v^2$, so $v_{bottom}^2 = 5gr$. Select the ball, set $v_x$ to 11 m/s and the string goes slack before the top." },
    { title: "Who flies off first?", preset: "turntable",
      q: "Three 1 kg blocks sit 1 m, 2 m and 2.8 m from the centre of a turntable ($\\mu_s = 0.4$) that slowly speeds up. Which leaves first, and at what $\\omega$?",
      a: "The outer one. Static friction must supply $m\\omega^2 r \\le \\mu_s m g$, so a block slips once $\\omega > \\sqrt{\\mu_s g / r}$: 1.18 rad/s at 2.8 m, 1.40 at 2 m, 1.98 at 1 m. The mass cancels, so heavier blocks leave at the same moment. Check it: select a block and change its mass." },
    { title: "A circular orbit", preset: "orbits",
      q: "With $G = 10$, what speed puts a planet in a circular orbit 3 m from a 50 kg sun?",
      a: "Gravity is the centripetal force: $GMm/r^2 = mv^2/r$, so $v = \\sqrt{GM/r} = \\sqrt{500/3} = 12.9$ m/s. A little faster swings out into an ellipse. At $\\sqrt 2$ times (18.3 m/s) it escapes and never comes back." },
    { title: "Make friction win", preset: "table",
      q: "The 3 kg block sits on a table with $\\mu_s = 0.5$. What is the heaviest hanging mass it can hold without sliding?",
      a: "Static friction can give up to $\\mu_s m_1 g = 14.7$ N, so it holds up to $m_2 = \\mu_s m_1 = 1.5$ kg. Below that the tension is just $m_2 g$, and the friction readout says <i>static</i> and matches it. Above it, friction drops to $\\mu_k m_1 g$ and the block accelerates." },
    { title: "Where did the energy go?", preset: "spring",
      q: "A block bounces on a spring on a smooth floor. Select the floor and set $\\mu_k = 0.1$ (and $\\mu_s = 0.1$). How much smaller is each swing?",
      a: "Friction does work $\\mu_k m g = 1.96$ J for every metre slid, so the total-energy line steps down while the block moves. Each half swing loses the same <i>distance</i>, not the same fraction: $\\Delta A = 2\\mu_k m g / k = 0.196$ m. The block stops for good once $kx$ can't beat static friction." },
    { title: "Chaos", preset: "eight",
      q: "Three equal masses chase each other round a figure eight. Change one ball's $v_x$ by just 0.1 m/s. How long does the pattern last?",
      a: "Only a few laps. The three-body problem has no general formula, and small differences grow exponentially, which is chaos. The figure eight is a rare special solution. Even the simulation's own rounding errors break it up in the end." }
  ];

  /* ---------- page ---------- */
  function mount(root, code) {
    var th = K.theme;
    var el = K.h(
      '<section class="pg">' +
        '<header class="lab-head"><p class="eyebrow">Playground · build your own experiment</p><h1>Physics playground</h1>' +
          '<p class="lede">Pick parts, put them together and press Play. Pulleys, ramps, springs, turntables, planets: the same laws run everything. Select any body to see its forces.</p></header>' +
        '<div class="pg-presets"><span class="mono muted">Start from</span></div>' +
        '<div class="stage-row">' +
          '<div class="stage-col">' +
            '<div><div class="pg-tools" role="toolbar" aria-label="Parts"></div><p class="pg-hint" aria-live="polite"></p></div>' +
            '<div class="stage"><canvas></canvas><div class="hud"></div><div class="stage-note"></div>' +
              '<div class="stage-bar">' +
                '<button class="btn btn-primary btn-sm" data-act="play" type="button"></button>' +
                '<button class="btn btn-sm" data-act="reset" type="button">Reset</button>' +
                '<button class="btn btn-sm" data-act="undo" type="button" title="Undo (Ctrl+Z)">Undo</button>' +
                '<button class="btn btn-sm" data-act="clear" type="button">Clear</button>' +
                '<button class="btn btn-sm" data-act="link" type="button">Copy link</button>' +
                '<span class="spacer"></span><span class="time mono">t = 0.00 s</span><span class="speed"></span>' +
              "</div></div>" +
            '<div class="panel"><h2>Graphs <small class="pg-gsel"></small></h2><div class="graphs pg-graphs">' +
              '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">speed</b> of the selected body</p></div>' +
              '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">KE</b> · <b class="c-grav">PE</b> · <b>total</b>: flat means energy is conserved</p></div>' +
            "</div></div>" +
          "</div>" +
          '<div class="controls"></div>' +
        "</div>" +
        '<div class="panels">' +
          '<div class="panel wide"><h2>Readouts <small class="pg-sel"></small></h2><div class="readouts"></div>' +
            '<div class="legend pg-legend"><span class="c-grav"><i></i>weight mg</span><span class="c-normal"><i></i>normal N</span><span class="c-fric"><i></i>friction f</span>' +
            '<span class="c-ten"><i></i>tension T</span><span class="c-app"><i></i>spring kx</span><span class="c-vel"><i></i>velocity</span></div></div>' +
          '<div class="panel wide"><h2>Challenges <small>predict first, then build it and check</small></h2><div class="pg-challenges"></div></div>' +
        "</div>" +
      "</section>");
    root.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var P = { root: el, canvas: q(".stage canvas"), hud: q(".pg-hint"), note: q(".stage-note"), controls: q(".controls"), readouts: q(".readouts"),
      playBtn: q('[data-act="play"]'), resetBtn: q('[data-act="reset"]'), time: q(".time"), speedSlot: q(".speed") };
    el.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });

    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: PPM, origin: ORIGIN, g: 9.8, gridStep: 1, gridMajor: 5 });
    sim.engine.positionIterations = 10;
    sim.engine.velocityIterations = 8;
    var cv = el.querySelectorAll(".pg-graphs canvas");
    var gv = new K.Graph(cv[0], { yLabel: "v (m/s)", xMax: 2, xAuto: true, yMin: 0, color: th.vel });
    var ge = new K.Graph(cv[1], { yLabel: "E (J)", xMax: 2, xAuto: true, color: th.ink });

    var S = load(code), rt = null, sel = null, tool = "select", hoverId = null, pointerM = null;
    var making = null, drawing = null, drag = null, grab = null, undo = [], editing = false;
    var series = { v: [], ke: [], pe: [], e: [] };

    /* ---------- state helpers ---------- */
    function load(c) {
      if (c) { try { return JSON.parse(decode(c)); } catch (e) { /* bad link: fall through */ } }
      try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* storage blocked */ }
      return preset("table").make();
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
    function find(id) { return S.items.filter(function (it) { return it.id === id; })[0]; }
    function pushUndo() { undo.push(JSON.stringify(S)); if (undo.length > 60) undo.shift(); }
    function started() { return sim.steps > 0; }
    function toStart() { sim.pause(); transportUI.render(); build(); }
    function edit() { if (started()) toStart(); if (!editing) { pushUndo(); editing = true; } }
    function changed(props) { build(); save(); if (props !== false) renderProps(); renderReadouts(); }
    function r3(v) { return Math.round(v * 1000) / 1000; }
    function snap(m) { return { x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10 }; }

    /* ---------- runtime: matter bodies + our own constraints ---------- */
    function pos(o) { return o.body ? sim.posM(o.body) : { x: o.it.x, y: o.it.y }; }
    function vel(o) {
      if (!o.body || o.body.isStatic) return { x: 0, y: 0 };
      var v = Matter.Body.getVelocity(o.body);
      return { x: v.x * 60 / PPM, y: -v.y * 60 / PPM };
    }
    function setVel(o, v) { Matter.Body.setVelocity(o.body, { x: v.x * PPM / 60, y: -v.y * PPM / 60 }); }
    function shift(o, dx, dy) {
      var b = o.body;
      Matter.Body.setPosition(b, { x: b.position.x + dx * PPM, y: b.position.y - dy * PPM });   // keeps velocity
    }

    function build() {
      Matter.Composite.clear(sim.world, false);
      Matter.Engine.clear(sim.engine);
      sim.resetClock();
      var w = S.world, top = w.mode === "top";
      sim.setG(w.mode === "side" ? w.g : 0);
      sim.zoom = w.zoom || 1;
      sim.panX = (W - W / sim.zoom) / 2;
      rt = { objs: {}, byBody: {}, dyn: [], ropes: [], springs: [], tts: [], slip: {} };
      S.items.forEach(function (it) {
        var o = { it: it, w: 0, m: 0 };
        if (it.type === "surface") {
          var c = sim.px((it.x1 + it.x2) / 2, (it.y1 + it.y2) / 2), len = Math.hypot(it.x2 - it.x1, it.y2 - it.y1);
          o.body = Matter.Bodies.rectangle(c.x, c.y, Math.max(len, 0.05) * PPM, THICK * PPM,
            { isStatic: true, angle: -Math.atan2(it.y2 - it.y1, it.x2 - it.x1), friction: 0, frictionStatic: 0, restitution: it.e || 0 });
        } else if (it.type === "block" || it.type === "ball" || it.type === "mpulley") {
          var p = sim.px(it.x, it.y);
          var opt = { friction: 0, frictionStatic: 0, frictionAir: 0, restitution: it.e || 0, isStatic: !!it.pinned, slop: 0.02 };
          if (it.type === "block") { opt.angle = -(it.angle || 0) * DEG; o.body = Matter.Bodies.rectangle(p.x, p.y, it.w * PPM, it.h * PPM, opt); }
          else {
            if (it.type === "mpulley") opt.collisionFilter = { group: 0, category: 2, mask: 0 };   // rides on the string, touches nothing
            o.body = Matter.Bodies.circle(p.x, p.y, it.r * PPM, opt);
          }
          o.m = it.m;
          if (!it.pinned) { Matter.Body.setMass(o.body, it.m); Matter.Body.setInertia(o.body, Infinity); o.w = 1 / it.m; }
          o.trail = []; o.a = { x: 0, y: 0 }; o.v = { x: it.vx || 0, y: it.vy || 0 }; o.F = [];
          rt.dyn.push(o);
        } else if (it.type === "turntable") {
          if (!top) return;
          o.om = it.w0; o.omMid = it.w0; o.ang = 0;
          rt.tts.push(o);
        }
        if (o.body) { o.body.plugin = {}; sim.add(o.body); rt.byBody[o.body.id] = o; }
        rt.objs[it.id] = o;
      });
      rt.dyn.forEach(function (o) { if (o.w) setVel(o, o.v); });
      S.items.forEach(function (it) {
        if (it.type === "string") {
          var nodes = it.pts.map(function (id) { return rt.objs[id]; });
          if (nodes.length < 2 || nodes.some(function (n) { return !n; })) return;
          var R = { it: it, nodes: nodes.map(function (o, i) { return { o: o, r: i > 0 && i < nodes.length - 1 ? o.it.r : 0, s: 1 }; }) };
          // which way the string wraps each wheel, from the drawing: +1 clockwise, -1 anticlockwise
          for (var i = 1; i < nodes.length - 1; i++) {
            var a = pos(nodes[i - 1]), b = pos(nodes[i]), c = pos(nodes[i + 1]);
            R.nodes[i].s = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 0 ? 1 : -1;
          }
          R.L = ropeGeom(R).len + (it.slack || 0);
          R.T = 0; R.taut = !it.slack;
          rt.ropes.push(R);
        } else if (it.type === "spring") {
          var A = rt.objs[it.a], B = rt.objs[it.b];
          if (!A || !B) return;
          var pa = pos(A), pb = pos(B);
          rt.springs.push({ it: it, a: A, b: B, L0: Math.max(0.05, Math.hypot(pb.x - pa.x, pb.y - pa.y) - (it.stretch || 0)), x: it.stretch || 0, f: 0 });
        }
      });
      series = { v: [], ke: [], pe: [], e: [] };
      rt.E0 = energy().E;
      drawGraphs();
    }

    // A string from node to node, wrapping wheels: tangent segments plus arcs. Its length and,
    // for every body on it, d(length)/d(position), which is the direction the tension pulls.
    // mid: use positions halfway through the current substep (see solve)
    function ropeGeom(R, mid) {
      var n = R.nodes, Pp = n.map(function (k) { var p = pos(k.o); return mid && k.o.p0 ? { x: (p.x + k.o.p0.x) / 2, y: (p.y + k.o.p0.y) / 2 } : p; }), segs = [], arcs = [], len = 0, grads = [];
      for (var i = 0; i < n.length - 1; i++) {
        var A = Pp[i], B = Pp[i + 1], ra = n[i].r * n[i].s, rb = n[i + 1].r * n[i + 1].s;
        var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1e-9, ux = dx / L, uy = dy / L;
        var h = K.clamp((ra - rb) / L, -1, 1), qq = Math.sqrt(1 - h * h);
        var nx = h * ux - qq * uy, ny = h * uy + qq * ux;
        var Ta = { x: A.x + ra * nx, y: A.y + ra * ny }, Tb = { x: B.x + rb * nx, y: B.y + rb * ny };
        var sl = Math.hypot(Tb.x - Ta.x, Tb.y - Ta.y) || 1e-9;
        segs.push({ a: Ta, b: Tb, u: { x: (Tb.x - Ta.x) / sl, y: (Tb.y - Ta.y) / sl }, n: { x: nx, y: ny }, len: sl });
        len += sl;
      }
      for (i = 1; i < n.length - 1; i++) {
        var s = n[i].s, ri = { x: s * segs[i - 1].n.x, y: s * segs[i - 1].n.y }, ro = { x: s * segs[i].n.x, y: s * segs[i].n.y };
        var a = Math.atan2(ri.x * ro.y - ri.y * ro.x, ri.x * ro.x + ri.y * ro.y), arc = s > 0 ? -a : a;
        if (arc < -0.3) arc += Math.PI * 2;
        arc = Math.max(arc, 0);
        arcs.push({ c: Pp[i], r: n[i].r, ri: ri, arc: arc, s: s });
        len += n[i].r * arc;
      }
      function grad(o, gx, gy) {
        for (var k = 0; k < grads.length; k++) if (grads[k].o === o) { grads[k].g.x += gx; grads[k].g.y += gy; return; }
        grads.push({ o: o, g: { x: gx, y: gy } });
      }
      grad(n[0].o, -segs[0].u.x, -segs[0].u.y);
      grad(n[n.length - 1].o, segs[segs.length - 1].u.x, segs[segs.length - 1].u.y);
      for (i = 1; i < n.length - 1; i++) grad(n[i].o, segs[i - 1].u.x - segs[i].u.x, segs[i - 1].u.y - segs[i].u.y);
      return { segs: segs, arcs: arcs, len: len, grads: grads };
    }

    function pairMu(A, B) {
      var sa = A.it.type === "surface" || A.it.pinned, sb = B.it.type === "surface" || B.it.pinned;
      if (sa && !sb) return { s: A.it.mus, k: A.it.muk };
      if (sb && !sa) return { s: B.it.mus, k: B.it.muk };
      return { s: (A.it.mus + B.it.mus) / 2, k: (A.it.muk + B.it.muk) / 2 };
    }

    function force(o, fx, fy, kind) {
      if (!o.body || !o.w) return;
      var s = PPM / 1e6;
      o.body.force.x += fx * s; o.body.force.y -= fy * s;
      o.F.push({ k: kind, f: { x: fx, y: fy } });
    }

    function before() {
      var w = S.world;
      rt.dyn.forEach(function (o) {
        o.p0 = pos(o); o.F = [];
        if (o.w && w.mode === "side") o.F.push({ k: "g", f: { x: 0, y: -o.m * w.g } });   // the engine applies it; listed for the diagram
      });
      rt.springs.forEach(function (sp) {
        var a = pos(sp.a), b = pos(sp.b), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9;
        sp.x = L - sp.L0; sp.f = sp.it.k * sp.x;
        force(sp.a, dx / L * sp.f, dy / L * sp.f, "k");
        force(sp.b, -dx / L * sp.f, -dy / L * sp.f, "k");
      });
      if (w.G > 0) {
        for (var i = 0; i < rt.dyn.length; i++) for (var j = i + 1; j < rt.dyn.length; j++) {
          var A = rt.dyn[i], B = rt.dyn[j];
          if (A.it.type === "mpulley" || B.it.type === "mpulley") continue;
          var pa = pos(A), pb = pos(B), dx2 = pb.x - pa.x, dy2 = pb.y - pa.y, r2 = dx2 * dx2 + dy2 * dy2 + SOFT2;
          var f = w.G * A.m * B.m / (r2 * Math.sqrt(r2));
          force(A, dx2 * f, dy2 * f, "G"); force(B, -dx2 * f, -dy2 * f, "G");
        }
      }
      if (grab) {
        var o = grab.o, p = pos(o), v = vel(o);
        force(o, o.m * (60 * (grab.t.x - p.x) - 12 * v.x), o.m * (60 * (grab.t.y - p.y) - 12 * v.y), "hand");
      }
      rt.tts.forEach(function (t) { t.omMid = t.om + 0.5 * t.it.alpha * HS; t.om += t.it.alpha * HS; t.ang += t.omMid * HS; });
    }

    // One 1/60 s frame = SUB short physics steps (smaller steps keep circles round and orbits closed).
    sim.stepOnce = function () {
      for (var s = 0; s < SUB; s++) {
        before();
        Matter.Engine.update(sim.engine, K.STEP / SUB);
        solve();
      }
      sim.steps++;
      sim.time = sim.steps * DT;
      sim.hooks.step.forEach(function (f) { f(sim.time); });
    };

    // After matter's step: strings, friction and turntables, solved together by sequential impulses.
    function solve() {
      var w = S.world, dyn = rt.dyn.filter(function (o) { return o.w > 0; });
      dyn.forEach(function (o) { o.v = vel(o); o.v0 = { x: o.v.x, y: o.v.y }; o.cinfo = null; o.tinfo = null; });
      var ropes = [];
      rt.ropes.forEach(function (R) {
        var G = ropeGeom(R); R.geom = G; R.T = 0;
        R.taut = G.len >= R.L - 1e-4;
        if (!R.taut) return;
        // rate measured along the string now; impulse along it halfway through the step. For a body
        // swinging on a string that turns its velocity without changing its speed, so energy is kept.
        var gs = G.grads.filter(function (g) { return g.o.w > 0; }), gi = ropeGeom(R, true).grads.filter(function (g) { return g.o.w > 0; });
        if (gs.length) ropes.push({ R: R, gs: gs, gi: gi, lam: 0 });
      });
      var cons = [];
      sim.engine.pairs.list.forEach(function (pr) {
        if (!pr.isActive || pr.isSensor) return;
        var A = rt.byBody[pr.bodyA.parent.id], B = rt.byBody[pr.bodyB.parent.id];
        if (!A || !B || (!A.w && !B.w)) return;
        var jn = 0;
        for (var i = 0; i < pr.contactCount; i++) jn -= pr.contacts[i].normalImpulse;
        jn = Math.max(0, jn) / (1 + pr.restitution) / (PPM * HS);       // normal impulse this substep, N·s
        var n = { x: pr.collision.normal.x, y: -pr.collision.normal.y }, pa = pos(A), pb = pos(B);
        if (n.x * (pb.x - pa.x) + n.y * (pb.y - pa.y) < 0) { n.x = -n.x; n.y = -n.y; }   // points from A into B
        var mu = pairMu(A, B), slip = rt.slip[pr.id];
        cons.push({ id: pr.id, A: A, B: B, n: n, t: { x: -n.y, y: n.x }, jn: jn, mu: mu, slip: slip, lim: (slip ? mu.k : mu.s) * jn, lam: 0 });
      });
      var flat = [];
      if (w.mode === "top") dyn.forEach(function (o) {
        var p = pos(o), sv = { x: 0, y: 0 }, mus = w.fmus, muk = w.fmuk, tt = null;
        rt.tts.forEach(function (t) { var dx = p.x - t.it.x, dy = p.y - t.it.y; if (dx * dx + dy * dy <= t.it.r * t.it.r) tt = t; });
        if (tt) { sv = { x: -tt.omMid * (p.y - tt.it.y), y: tt.omMid * (p.x - tt.it.x) }; mus = tt.it.mus; muk = tt.it.muk; }
        var jn = o.m * w.g * HS;
        flat.push({ o: o, sv: sv, tt: tt, mus: mus, muk: muk, jn: jn, lim: (o.slip ? muk : mus) * jn, lam: { x: 0, y: 0 } });
      });
      var lam = ropes.map(function () { return 0; });
      for (var k = 0; k < 14; k++) {
        // all strings at once (a light pulley between heavy blocks converges far too slowly one by one)
        if (ropes.length) {
          var d = jointSolve(ropes, ropes.map(function (r) {
            var cd = 0;
            r.gs.forEach(function (g) { cd += g.g.x * g.o.v.x + g.g.y * g.o.v.y; });
            return cd;
          }), lam);
          ropes.forEach(function (r, i) {
            lam[i] += d[i]; r.lam = lam[i];
            if (d[i]) r.gi.forEach(function (g) { g.o.v.x -= g.o.w * d[i] * g.g.x; g.o.v.y -= g.o.w * d[i] * g.g.y; });
          });
        }
        cons.forEach(function (c) {
          var vA = c.A.w ? c.A.v : ZERO, vB = c.B.w ? c.B.v : ZERO;
          var vt = (vB.x - vA.x) * c.t.x + (vB.y - vA.y) * c.t.y;
          var nl = K.clamp(c.lam - vt / (c.A.w + c.B.w), -c.lim, c.lim), d = nl - c.lam;
          c.lam = nl;
          if (c.B.w) { c.B.v.x += c.B.w * d * c.t.x; c.B.v.y += c.B.w * d * c.t.y; }
          if (c.A.w) { c.A.v.x -= c.A.w * d * c.t.x; c.A.v.y -= c.A.w * d * c.t.y; }
        });
        flat.forEach(function (f) {
          var o = f.o, lx = f.lam.x - (o.v.x - f.sv.x) * o.m, ly = f.lam.y - (o.v.y - f.sv.y) * o.m, L = Math.hypot(lx, ly);
          if (L > f.lim) { lx *= f.lim / L; ly *= f.lim / L; }
          o.v.x += (lx - f.lam.x) * o.w; o.v.y += (ly - f.lam.y) * o.w;
          f.lam = { x: lx, y: ly };
        });
      }
      // record forces for the free-body diagram and readouts
      ropes.forEach(function (r) {
        r.R.T = r.lam / HS;
        r.gi.forEach(function (g) { g.o.F.push({ k: "T", f: { x: -g.g.x * r.R.T, y: -g.g.y * r.R.T } }); });
      });
      cons.forEach(function (c) {
        var vA = c.A.w ? c.A.v : ZERO, vB = c.B.w ? c.B.v : ZERO, vt = (vB.x - vA.x) * c.t.x + (vB.y - vA.y) * c.t.y;
        var N = c.jn / HS, fr = c.lam / HS;
        // sliding once friction is maxed out (so a block just past the limit switches to kinetic friction)
        var slipping = (Math.abs(c.lam) >= c.lim * 0.999 && Math.abs(vt) > 1e-6) || Math.abs(vt) > 0.01;
        rt.slip[c.id] = slipping;
        [[c.B, 1], [c.A, -1]].forEach(function (e) {
          var o = e[0], sg = e[1];
          if (!o.w) return;
          if (N > 1e-6) o.F.push({ k: "N", f: { x: sg * c.n.x * N, y: sg * c.n.y * N } });
          if (Math.abs(fr) > 1e-6) o.F.push({ k: "f", f: { x: sg * c.t.x * fr, y: sg * c.t.y * fr } });
          if (!o.cinfo || N > o.cinfo.N) o.cinfo = { N: N, f: Math.abs(fr), max: c.mu.s * N, kinetic: c.slip || slipping, mus: c.mu.s, muk: c.mu.k };
        });
      });
      flat.forEach(function (f) {
        var o = f.o, fx = f.lam.x / HS, fy = f.lam.y / HS, rel = Math.hypot(o.v.x - f.sv.x, o.v.y - f.sv.y);
        o.slip = (Math.hypot(f.lam.x, f.lam.y) >= f.lim * 0.999 && rel > 1e-6) || rel > 0.01;
        if (Math.hypot(fx, fy) > 1e-6) o.F.push({ k: "f", f: { x: fx, y: fy } });
        o.cinfo = { N: f.jn / HS, f: Math.hypot(fx, fy), max: f.mus * f.jn / HS, kinetic: o.slip, mus: f.mus, muk: f.muk };
        if (f.tt) { var p = pos(o), r = Math.hypot(p.x - f.tt.it.x, p.y - f.tt.it.y); o.tinfo = { r: r, om: f.tt.om, need: o.m * f.tt.om * f.tt.om * r, max: f.mus * o.m * w.g }; }
      });
      // positions follow the changed velocities (semi-implicit Euler, like the engine)
      dyn.forEach(function (o) {
        var dx = (o.v.x - o.v0.x) * HS, dy = (o.v.y - o.v0.y) * HS;
        if (dx || dy) shift(o, dx, dy);
        setVel(o, o.v);
      });
      // a block stuck to a turntable turns with it exactly (straight steps would let it creep outward)
      flat.forEach(function (f) {
        if (!f.tt || f.o.slip) return;
        var t = f.tt, cx = t.it.x, cy = t.it.y, a = t.omMid * HS, rx = f.o.p0.x - cx, ry = f.o.p0.y - cy;
        var nx = cx + rx * Math.cos(a) - ry * Math.sin(a), ny = cy + rx * Math.sin(a) + ry * Math.cos(a), p = pos(f.o);
        shift(f.o, nx - p.x, ny - p.y);
        f.o.v = { x: -t.om * (ny - cy), y: t.om * (nx - cx) };
        setVel(f.o, f.o.v);
      });
      // and strings never stretch: pull stretched ones back to length without adding speed
      for (var it = 0; it < 2; it++) {
        // a string that pulled this step holds exactly its length (both ways); a slack one only can't overstretch
        var tight = [], C = [], held = [];
        rt.ropes.forEach(function (R) {
          var G = ropeGeom(R), pulling = R.T > 0;
          if (!pulling && G.len < R.L + 1e-6) return;
          var gs = G.grads.filter(function (g) { return g.o.w > 0; });
          if (!gs.length) return;
          tight.push({ gs: gs }); C.push(G.len - R.L); held.push(pulling ? 1e9 : 0);
        });
        if (!tight.length || Math.max.apply(null, C.map(Math.abs)) < 1e-6) break;
        var dp = jointSolve(tight, C, held);
        tight.forEach(function (r, i) { if (dp[i]) r.gs.forEach(function (g) { shift(g.o, -g.o.w * dp[i] * g.g.x, -g.o.w * dp[i] * g.g.y); }); });
      }
    }

    // Find impulses d (one per string) that cancel each string's stretching rate rhs, all together:
    // (J W Jᵀ) d = rhs, keeping every string's total lam + d >= 0 (a string can only pull).
    function jointSolve(rs, rhs, lam) {
      var n = rs.length, A = [], i, j;
      for (i = 0; i < n; i++) {
        A.push([]);
        for (j = 0; j < n; j++) {
          var s = 0;
          rs[i].gs.forEach(function (a) { (rs[j].gi || rs[j].gs).forEach(function (b) { if (a.o === b.o) s += a.o.w * (a.g.x * b.g.x + a.g.y * b.g.y); }); });
          A[i].push(s + (i === j ? 1e-9 : 0));
        }
      }
      var act = rs.map(function () { return true; }), d = rs.map(function () { return 0; });
      for (var pass = 0; pass <= n; pass++) {
        var idx = [];
        for (i = 0; i < n; i++) { if (act[i]) idx.push(i); else d[i] = -lam[i]; }
        var M = idx.map(function (r) { return idx.map(function (c) { return A[r][c]; }); });
        var b = idx.map(function (r) { var s = rhs[r]; for (var c = 0; c < n; c++) if (!act[c]) s -= A[r][c] * d[c]; return s; });
        var x = gauss(M, b);
        idx.forEach(function (r, k) { d[r] = x[k]; });
        var bad = false;
        idx.forEach(function (r) { if (lam[r] + d[r] < -1e-12) { act[r] = false; bad = true; } });
        if (!bad) break;
      }
      return d;
    }
    function gauss(M, b) {
      var n = b.length, a = M.map(function (r, i) { return r.concat([b[i]]); });
      for (var c = 0; c < n; c++) {
        var p = c;
        for (var r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
        var t = a[c]; a[c] = a[p]; a[p] = t;
        if (Math.abs(a[c][c]) < 1e-14) continue;
        for (r = 0; r < n; r++) {
          if (r === c) continue;
          var f = a[r][c] / a[c][c];
          for (var k = c; k <= n; k++) a[r][k] -= f * a[c][k];
        }
      }
      return a.map(function (r, i) { return Math.abs(r[i]) < 1e-14 ? 0 : r[n] / r[i]; });
    }

    function energy() {
      var w = S.world, KE = 0, PE = 0;
      rt.dyn.forEach(function (o) {
        if (!o.w) return;
        var v = o.v || ZERO;
        KE += 0.5 * o.m * (v.x * v.x + v.y * v.y);
        if (w.mode === "side") PE += o.m * w.g * pos(o).y;
      });
      rt.springs.forEach(function (sp) { var a = pos(sp.a), b = pos(sp.b), x = Math.hypot(b.x - a.x, b.y - a.y) - sp.L0; PE += 0.5 * sp.it.k * x * x; });
      if (w.G > 0) {
        for (var i = 0; i < rt.dyn.length; i++) for (var j = i + 1; j < rt.dyn.length; j++) {
          var A = rt.dyn[i], B = rt.dyn[j];
          if (A.it.type === "mpulley" || B.it.type === "mpulley") continue;
          var pa = pos(A), pb = pos(B);
          PE -= w.G * A.m * B.m / Math.sqrt((pb.x - pa.x) * (pb.x - pa.x) + (pb.y - pa.y) * (pb.y - pa.y) + SOFT2);
        }
      }
      return { KE: KE, PE: PE, E: KE + PE };
    }

    sim.on("step", function (t) {
      var trails = S.world.trails;
      rt.dyn.forEach(function (o) {
        if (!o.w) return;
        if (o.vp) {
          o.a.x = o.a.x * 0.7 + (o.v.x - o.vp.x) / DT * 0.3;
          o.a.y = o.a.y * 0.7 + (o.v.y - o.vp.y) / DT * 0.3;
        }
        o.vp = { x: o.v.x, y: o.v.y };
        if ((trails || o.it.trail) && sim.steps % 2 === 0) { o.trail.push(pos(o)); if (o.trail.length > 900) o.trail.shift(); }
      });
      if (sim.steps % 3 === 0) {
        var en = energy(), so = focusBody();
        if (so) series.v.push([t, Math.hypot(so.v.x, so.v.y)]);
        series.ke.push([t, en.KE]); series.pe.push([t, en.PE]); series.e.push([t, en.E]);
        if (series.e.length > 1600) Object.keys(series).forEach(function (k) { series[k] = series[k].filter(function (p, i) { return i % 2 === 0; }); });
        drawGraphs();
      }
    });

    function focusBody() {
      var o = sel && rt.objs[sel];
      if (o && o.w) return o;
      return rt.dyn.filter(function (d) { return d.w && d.it.type !== "mpulley"; })[0] || null;
    }
    function drawGraphs() {
      gv.set("v", { points: series.v, color: th.vel });
      ge.set("ke", { points: series.ke, color: th.vel });
      ge.set("pe", { points: series.pe, color: th.grav });
      ge.set("e", { points: series.e, color: th.ink, width: 2.5 });
      var fo = focusBody();
      q(".pg-gsel").textContent = fo ? NAMES[fo.it.type].toLowerCase() + " " + K.fmt(fo.m, fo.m < 1 ? 2 : 1) + " kg" : "";
    }

    /* ---------- drawing ---------- */
    function px(p) { return sim.px(p.x, p.y); }
    sim.on("over", function (ctx) {
      var w = S.world, u = function (n) { return sim.u(n); }, run = started();
      if (w.mode === "side") S.items.forEach(function (it) { if (it.floor) sim.drawGround(ctx, sim.px(0, it.y1 + THICK / 2).y); });
      rt.tts.forEach(function (t) { drawTurntable(ctx, t, u); });
      rt.dyn.forEach(function (o) {
        if (o.trail.length < 2) return;
        ctx.strokeStyle = K.alpha(th.disp, 0.45); ctx.lineWidth = u(1.5); ctx.beginPath();
        o.trail.forEach(function (p, i) { var q2 = px(p); if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); });
        ctx.stroke();
      });
      S.items.forEach(function (it) { if (it.type === "surface") drawSurface(ctx, rt.objs[it.id], u); });
      rt.ropes.forEach(function (R) { drawRope(ctx, R, u, run); });
      rt.springs.forEach(function (sp) { drawSpring(ctx, sp, u); });
      S.items.forEach(function (it) {
        var o = rt.objs[it.id];
        if (!o) return;
        if (it.type === "pulley" || it.type === "mpulley") drawPulley(ctx, o, u);
        else if (it.type === "anchor") drawAnchor(ctx, o, u);
      });
      rt.dyn.forEach(function (o) { if (o.it.type !== "mpulley") drawBody(ctx, o, u); });
      // highlight
      [[hoverId, th.muted], [sel, th.acc]].forEach(function (hl) { if (hl[0] && rt.objs[hl[0]]) outline(ctx, rt.objs[hl[0]], hl[1], u); });
      // velocity arrows
      if (w.vel) rt.dyn.forEach(function (o) {
        if (!o.w || o.it.type === "mpulley") return;
        var v = run ? o.v : { x: o.it.vx || 0, y: o.it.vy || 0 }, p = px(pos(o)), k = 0.25 * PPM;
        if (Math.hypot(v.x, v.y) < 0.05) return;
        K.arrow(ctx, p.x, p.y, p.x + v.x * k, p.y - v.y * k, th.vel, { s: u(1), width: 2.5, dash: run ? null : [u(5), u(4)] });
      });
      // free-body diagram of the selected body
      var so = sel && rt.objs[sel];
      if (w.fbd && run && so && so.w && so.F && so.F.length) {
        var max = 0;
        so.F.forEach(function (f) { max = Math.max(max, Math.hypot(f.f.x, f.f.y)); });
        var kpn = max > 0 ? 95 / max : 1, c = px(pos(so));
        var COL = { g: th.grav, N: th.normal, f: th.fric, T: th.ten, k: th.app, G: th.grav, hand: th.muted };
        var LAB = { g: "mg", N: "N", f: "f", T: "T", k: "kx", G: "F", hand: "hand" };
        so.F.forEach(function (f) {
          if (Math.hypot(f.f.x, f.f.y) * kpn < 4) return;
          sim.force(ctx, c.x, c.y, f.f.x, f.f.y, COL[f.k], LAB[f.k], kpn, { width: 3 });
        });
      }
      drawPreview(ctx, u);
      gv.draw(); ge.draw();
      showReadouts();
    });

    function drawSurface(ctx, o, u) {
      var it = o.it, b = o.body;
      if (it.wedge && S.world.mode === "side") {
        var dx = it.x2 - it.x1, dy = it.y2 - it.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        if (ny < 0) { nx = -nx; ny = -ny; }
        var t1 = px({ x: it.x1 + nx * THICK / 2, y: it.y1 + ny * THICK / 2 }), t2 = px({ x: it.x2 + nx * THICK / 2, y: it.y2 + ny * THICK / 2 });
        ctx.fillStyle = K.alpha(th.ground, 0.5);
        ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t2.x, sim.px(0, 0).y); ctx.lineTo(t1.x, sim.px(0, 0).y); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = th.ground; ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = u(1.5);
      ctx.beginPath();
      b.vertices.forEach(function (v, i) { if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function drawBody(ctx, o, u) {
      var it = o.it, b = o.body;
      ctx.fillStyle = it.pinned ? th.muted : th.body;
      ctx.beginPath();
      if (it.type === "ball") ctx.arc(b.position.x, b.position.y, it.r * PPM, 0, Math.PI * 2);
      else b.vertices.forEach(function (v, i) { if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); });
      ctx.closePath(); ctx.fill();
      var size = (it.type === "ball" ? it.r * 2 : Math.min(it.w, it.h)) * PPM;
      if (size >= u(22)) {                       // mass label, screen-sized, when the body is big enough to hold it
        ctx.fillStyle = th["canvas-bg"];
        ctx.font = "700 " + Math.min(u(11), size * 0.3) + "px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(K.fmt(it.m, it.m < 1 ? 2 : it.m % 1 ? 1 : 0) + " kg", b.position.x, b.position.y);
      }
      if (it.pinned) { ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(b.position.x, b.position.y - size * 0.32, u(3), 0, Math.PI * 2); ctx.fill(); }
    }
    function drawPulley(ctx, o, u) {
      var p = px(pos(o)), r = o.it.r * PPM, mov = o.it.type === "mpulley";
      if (!mov) {
        ctx.strokeStyle = th.muted; ctx.lineWidth = u(3);
        var mx = p.x - (r + 0.3 * PPM) * 0.6, my = p.y - (r + 0.3 * PPM) * 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.fillRect(mx - u(5), my - u(5), u(10), u(10));
      }
      ctx.fillStyle = th.surface; ctx.strokeStyle = mov ? th.ten : th.ink; ctx.lineWidth = u(2.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mov ? th.ten : th.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, u(3), 0, Math.PI * 2); ctx.fill();
    }
    function drawAnchor(ctx, o, u) {
      var p = px(pos(o));
      ctx.strokeStyle = th.ink; ctx.lineWidth = u(2); ctx.fillStyle = th.surface;
      ctx.beginPath(); ctx.arc(p.x, p.y, u(6), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(p.x, p.y, u(2.5), 0, Math.PI * 2); ctx.fill();
    }
    function drawTurntable(ctx, t, u) {
      var p = px({ x: t.it.x, y: t.it.y }), r = t.it.r * PPM;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.line; ctx.lineWidth = u(2);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = K.alpha(th.muted, 0.5); ctx.lineWidth = u(1.5);
      for (var i = 0; i < 8; i++) {
        var a = t.ang + i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * r, p.y - Math.sin(a) * r); ctx.stroke();
      }
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(p.x, p.y, u(4), 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "ω = " + K.fmt(t.om, 2) + " rad/s", p.x, p.y - r - u(6), th.ink, { s: u(1), bg: true });
    }
    function ropePath(G) {
      var pts = [];
      G.segs.forEach(function (s, i) {
        if (i > 0) {
          var a = G.arcs[i - 1], a0 = Math.atan2(a.ri.y, a.ri.x), n = Math.max(2, Math.ceil(a.arc * 8));
          for (var k = 0; k <= n; k++) { var ang = a0 - a.s * a.arc * k / n; pts.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }); }
        }
        pts.push(s.a); pts.push(s.b);
      });
      return pts;
    }
    function drawRope(ctx, R, u, run) {
      var G = ropeGeom(R), slack = run && G.len < R.L - 0.01, pts = ropePath(G);
      ctx.strokeStyle = slack ? th.muted : th.ink; ctx.lineWidth = u(2); ctx.lineJoin = "round";
      if (slack) ctx.setLineDash([u(6), u(4)]);
      ctx.beginPath();
      pts.forEach(function (p, i) { var q2 = px(p); if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); });
      ctx.stroke(); ctx.setLineDash([]);
      if (run) {
        var best = G.segs.reduce(function (a, b) { return b.len > a.len ? b : a; }), m = px({ x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 });
        K.label(ctx, slack ? "slack" : "T = " + K.fmt(R.T, 1) + " N", m.x + u(8), m.y, slack ? th.muted : th.ten, { s: u(1), bg: true, align: "left" });
      }
    }
    function drawSpring(ctx, sp, u) {
      var a = px(pos(sp.a)), b = px(pos(sp.b)), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, n = 14, amp = 0.16 * PPM;
      ctx.strokeStyle = th.app; ctx.lineWidth = u(2); ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      var lead = Math.min(0.15 * PPM, L * 0.1);
      ctx.lineTo(a.x + ux * lead, a.y + uy * lead);
      for (var i = 1; i < n; i++) {
        var t = lead + (L - 2 * lead) * i / n, s = i % 2 ? amp : -amp;
        ctx.lineTo(a.x + ux * t - uy * s, a.y + uy * t + ux * s);
      }
      ctx.lineTo(b.x - ux * lead, b.y - uy * lead); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    function outline(ctx, o, color, u) {
      var it = o.it;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = u(2); ctx.setLineDash([u(5), u(4)]);
      ctx.beginPath();
      if (it.type === "string") { ctx.lineWidth = u(5); ctx.globalAlpha = 0.5; var R = rt.ropes.filter(function (r) { return r.it === it; })[0]; if (R) ropePath(ropeGeom(R)).forEach(function (p, i) { var q2 = px(p); if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); }); }
      else if (it.type === "spring") { ctx.lineWidth = u(5); ctx.globalAlpha = 0.5; var sp = rt.springs.filter(function (s) { return s.it === it; })[0]; if (sp) { var a = px(pos(sp.a)), b = px(pos(sp.b)); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } }
      else if (o.body && it.type !== "ball" && it.type !== "mpulley") o.body.vertices.forEach(function (v, i) { if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); });
      else { var p = px(pos(o)), r = it.type === "anchor" ? 0.12 : it.r; ctx.arc(p.x, p.y, r * PPM + u(4), 0, Math.PI * 2); }
      if (it.type !== "string" && it.type !== "spring") ctx.closePath();
      ctx.stroke(); ctx.restore();
    }
    function drawPreview(ctx, u) {
      if (drawing) {
        var a = px(drawing.a), b = px(drawing.b), dx = drawing.b.x - drawing.a.x, dy = drawing.b.y - drawing.a.y;
        ctx.strokeStyle = K.alpha(th["ground-top"], 0.9); ctx.lineWidth = THICK * PPM; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        K.label(ctx, K.fmt(Math.hypot(dx, dy), 1) + " m · " + Math.round(Math.atan2(dy, dx) / DEG) + "°", b.x, b.y - u(14), th.ink, { s: u(1), bg: true });
      }
      if (making && pointerM) {
        var pts = making.pts.map(function (id) { return pos(rt.objs[id]); }).concat([pointerM]);
        ctx.strokeStyle = making.type === "spring" ? th.app : th.ten; ctx.lineWidth = u(2); ctx.setLineDash([u(6), u(4)]);
        ctx.beginPath();
        pts.forEach(function (p, i) { var q2 = px(p); if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      if (pointerM && !drag && !drawing && ["block", "ball", "pulley", "mpulley", "turntable"].indexOf(tool) !== -1) {
        var g = ghost(), p = px(g);
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = th.body; ctx.strokeStyle = th.ink; ctx.lineWidth = u(2);
        if (tool === "block") {
          ctx.translate(p.x, p.y); ctx.rotate(-(g.angle || 0) * DEG);
          ctx.fillRect(-0.4 * PPM, -0.4 * PPM, 0.8 * PPM, 0.8 * PPM);
        } else {
          var r = (tool === "turntable" ? DEFAULTS.turntable.r : DEFAULTS[tool].r) * PPM;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          if (tool === "ball") ctx.fill(); else ctx.stroke();
        }
        ctx.restore();
      }
    }
    function ghost() {
      var m = snap(pointerM), it = { type: tool, x: m.x, y: m.y, w: 0.8, h: 0.8, r: tool === "ball" ? DEFAULTS.ball.r : 0, angle: 0 };
      if (tool === "block" || tool === "ball") snapToSurface(it);
      return it;
    }

    /* ---------- editing ---------- */
    function segDist(p, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1e-9, t = K.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1);
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    }
    var PRIO = { anchor: 0, pulley: 0, mpulley: 0, block: 0.05, ball: 0.05, string: 0.1, spring: 0.1, surface: 0.2, turntable: 0.3 };
    function hitTest(m, attach) {
      var best = null, bestS = Infinity;
      S.items.forEach(function (it) {
        var o = rt.objs[it.id], d = Infinity;
        if (!o && it.type !== "string" && it.type !== "spring") return;
        if (attach && ["block", "ball", "anchor", "mpulley", "pulley"].indexOf(it.type) === -1) return;
        if (it.type === "anchor") { var pa = pos(o); d = Math.max(0, Math.hypot(m.x - pa.x, m.y - pa.y) - 0.12); }
        else if (it.type === "pulley" || it.type === "mpulley" || it.type === "ball") { var pc = pos(o); d = Math.max(0, Math.hypot(m.x - pc.x, m.y - pc.y) - it.r); }
        else if (it.type === "block") {
          var pb = pos(o), a = -(it.angle || 0) * DEG, rx = m.x - pb.x, ry = m.y - pb.y;
          var lx = rx * Math.cos(a) - ry * Math.sin(a), ly = rx * Math.sin(a) + ry * Math.cos(a);
          d = Math.hypot(Math.max(0, Math.abs(lx) - it.w / 2), Math.max(0, Math.abs(ly) - it.h / 2));
        } else if (it.type === "surface") d = Math.max(0, segDist(m, { x: it.x1, y: it.y1 }, { x: it.x2, y: it.y2 }) - THICK / 2);
        else if (it.type === "string") {
          var R = rt.ropes.filter(function (r) { return r.it === it; })[0];
          if (R) ropeGeom(R).segs.forEach(function (s) { d = Math.min(d, segDist(m, s.a, s.b)); });
        } else if (it.type === "spring") {
          var sp = rt.springs.filter(function (s) { return s.it === it; })[0];
          if (sp) d = segDist(m, pos(sp.a), pos(sp.b));
        } else if (it.type === "turntable") { d = Math.hypot(m.x - it.x, m.y - it.y) <= it.r ? 0 : Infinity; }
        if (d > 0.2) return;
        var score = d + PRIO[it.type];
        if (score <= bestS) { bestS = score; best = it; }
      });
      return best;
    }
    function snapToSurface(it) {
      var best = null, half = it.type === "block" ? it.h / 2 : it.r;
      S.items.forEach(function (s) {
        if (s.type !== "surface" || s === it) return;
        var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.hypot(dx, dy);
        if (L < 0.1) return;
        var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        if (ny < 0) { nx = -nx; ny = -ny; }
        if (ny < 0.26) return;                                  // walls and very steep faces: leave it be
        var rx = it.x - s.x1, ry = it.y - s.y1, along = rx * ux + ry * uy, perp = rx * nx + ry * ny;
        if (along < 0 || along > L) return;
        var gap = perp - THICK / 2 - half;
        if (gap < -half - THICK || gap > 0.6) return;
        if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { gap: gap, s: s, ux: ux, uy: uy, nx: nx, ny: ny, along: along };
      });
      if (!best) return;
      var d = THICK / 2 + half + 0.002;
      it.x = r3(best.s.x1 + best.ux * best.along + best.nx * d);
      it.y = r3(best.s.y1 + best.uy * best.along + best.ny * d);
      if (it.type === "block") {
        var ang = Math.atan2(best.uy, best.ux) / DEG;
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        it.angle = Math.round(ang * 10) / 10;
      }
    }
    function moveItem(it, dx, dy) {
      if (it.type === "surface") { it.x1 = r3(it.x1 + dx); it.y1 = r3(it.y1 + dy); it.x2 = r3(it.x2 + dx); it.y2 = r3(it.y2 + dy); }
      else if (it.x !== undefined) { it.x = r3(it.x + dx); it.y = r3(it.y + dy); }
    }
    function removeItem(id) {
      S.items = S.items.filter(function (it) {
        if (it.id === id) return false;
        if (it.type === "string" && it.pts.indexOf(id) !== -1) return false;
        if (it.type === "spring" && (it.a === id || it.b === id)) return false;
        return true;
      });
      if (sel && !find(sel)) sel = null;
    }
    function select(id) { sel = id; editing = false; renderProps(); renderReadouts(); drawGraphs(); }

    function clickConnect(raw, m) {
      var hit = hitTest(raw, true), endType = { block: 1, ball: 1, anchor: 1 };
      if (!making) {
        if (hit && hit.type === "pulley" && tool === "string") { K.flash(P.note, "Start at a block, a ball or empty space", 2500); return; }
        pushUndo();
        var first = hit ? hit.id : add(S, { type: "anchor", x: m.x, y: m.y });
        making = { type: tool, pts: [first] };
        if (!hit) changed(false);
        hud();
        return;
      }
      var last = making.pts[making.pts.length - 1];
      if (making.type === "string" && hit && (hit.type === "pulley" || hit.type === "mpulley") && hit.id !== making.pts[0]) {
        if (hit.id !== last) making.pts.push(hit.id);
        hud();
        return;
      }
      var end = hit && (endType[hit.type] || making.type === "spring") ? hit.id : null;
      if (end === last) return;
      if (!end) end = add(S, { type: "anchor", x: m.x, y: m.y });
      making.pts.push(end);
      var id = making.type === "string" ? add(S, { type: "string", pts: making.pts }) : add(S, { type: "spring", a: making.pts[0], b: end });
      making = null;
      changed(false); select(id); hud();
    }

    sim.pointer({
      down: function (p) {
        var raw = p.m, m = snap(raw);
        pointerM = raw;
        if (tool === "select") {
          var hit = hitTest(raw);
          select(hit ? hit.id : null);
          if (!hit) return;
          var o = rt.objs[hit.id];
          if (started()) { if (o && o.w) grab = { o: o, t: raw }; return; }
          if (hit.type !== "string" && hit.type !== "spring") { pushUndo(); drag = { it: hit, last: m }; }
          return;
        }
        if (started()) toStart();
        if (tool === "erase") {
          var h = hitTest(raw);
          if (h) { pushUndo(); removeItem(h.id); changed(); }
          return;
        }
        if (["block", "ball", "pulley", "mpulley", "turntable"].indexOf(tool) !== -1) {
          pushUndo();
          var it = { type: tool, x: m.x, y: m.y };
          if (tool === "block" || tool === "ball") { it.w = 0.8; it.h = 0.8; it.r = DEFAULTS.ball.r; snapToSurface(it); if (tool === "ball") { delete it.w; delete it.h; delete it.angle; } else delete it.r; }
          var id = add(S, it);
          changed(false); select(id);
          return;
        }
        if (tool === "surface") { drawing = { a: m, b: m }; return; }
        if (tool === "string" || tool === "spring") clickConnect(raw, m);
      },
      drag: function (p) {
        pointerM = p.m;
        if (grab) { grab.t = p.m; return; }
        if (drag) {
          var m = snap(p.m), dx = m.x - drag.last.x, dy = m.y - drag.last.y;
          if (!dx && !dy) return;
          moveItem(drag.it, dx, dy); drag.last = m; build();
          return;
        }
        if (drawing) {
          var a = drawing.a, ddx = p.m.x - a.x, ddy = p.m.y - a.y;
          var ang = Math.round(Math.atan2(ddy, ddx) / (5 * DEG)) * 5 * DEG, L = Math.round(Math.hypot(ddx, ddy) * 10) / 10;
          drawing.b = { x: r3(a.x + L * Math.cos(ang)), y: r3(a.y + L * Math.sin(ang)) };
        }
      },
      up: function () {
        if (grab) grab = null;
        if (drag) {
          if (drag.it.type === "block" || drag.it.type === "ball") snapToSurface(drag.it);
          drag = null; changed();
        }
        if (drawing) {
          var a = drawing.a, b = drawing.b;
          drawing = null;
          if (Math.hypot(b.x - a.x, b.y - a.y) >= 0.3) { pushUndo(); var id = add(S, { type: "surface", x1: a.x, y1: a.y, x2: b.x, y2: b.y }); changed(false); select(id); }
        }
      },
      hover: function (p) {
        pointerM = p.m;
        var h = ["select", "erase", "string", "spring"].indexOf(tool) !== -1 ? hitTest(p.m, tool === "string" || tool === "spring") : null;
        hoverId = h ? h.id : null;
        P.canvas.style.cursor = tool === "select" ? (h ? (started() ? "grab" : "move") : "default") : "crosshair";
      }
    });
    P.canvas.addEventListener("pointerleave", function () { if (!drag && !drawing) { pointerM = null; hoverId = null; } });

    /* ---------- toolbar, presets, properties ---------- */
    var toolsEl = q(".pg-tools");
    function renderTools() {
      toolsEl.innerHTML = "";
      TOOLS.forEach(function (t) {
        var off = t.mode && t.mode !== S.world.mode;
        var b = K.h('<button type="button" class="pg-tool" aria-pressed="' + (tool === t.id) + '"' + (off ? " disabled" : "") +
          ' title="' + t.hint + (off ? " (switch to Table top view)" : "") + " · key " + t.key.toUpperCase() + '">' + t.label + "</button>");
        b.addEventListener("click", function () { setTool(t.id); });
        toolsEl.appendChild(b);
      });
    }
    function setTool(id) { tool = id; making = null; drawing = null; renderTools(); hud(); }
    function hud() {
      var t = TOOLS.filter(function (x) { return x.id === tool; })[0], txt = t.hint;
      if (making) txt = making.type === "string" ? "Now click pulleys in order, then the other end · Esc to cancel" : "Now click the other end · Esc to cancel";
      P.hud.textContent = txt;
    }

    var presetsEl = q(".pg-presets");
    PRESETS.forEach(function (p) {
      var b = K.h('<button type="button" class="btn btn-sm">' + p.title + "</button>");
      b.addEventListener("click", function () { loadPreset(p.id); });
      presetsEl.appendChild(b);
    });
    function loadPreset(id) {
      var p = preset(id);
      pushUndo();
      sim.pause(); transportUI.render();
      S = p.make(); sel = null; making = null;
      setTool("select"); renderTools(); changed();
      K.flash(P.note, p.watch, 4500);
    }

    var chEl = q(".pg-challenges");
    CHALLENGES.forEach(function (c) {
      var card = K.h('<article class="pg-ch"><h3>' + c.title + '</h3><p>' + K.md(c.q) + '</p><div class="q-tools">' +
        '<button class="btn btn-sm btn-primary" type="button" data-load>Load the setup ↑</button>' +
        '<button class="btn btn-sm" type="button" data-show>Show the physics</button></div><div class="quiz-explain">' + K.md(c.a) + "</div></article>");
      card.querySelector("[data-load]").addEventListener("click", function () { loadPreset(c.preset); P.root.querySelector(".stage").scrollIntoView({ behavior: "smooth", block: "center" }); });
      card.querySelector("[data-show]").addEventListener("click", function (e) { card.querySelector(".quiz-explain").classList.toggle("show"); e.target.textContent = card.querySelector(".quiz-explain.show") ? "Hide" : "Show the physics"; });
      chEl.appendChild(card);
    });

    function renderProps() {
      var c = P.controls, it = sel && find(sel);
      c.innerHTML = "";
      if (!it) { worldProps(c); return; }
      var head = K.h('<div class="pg-prop-head"><h3>' + NAMES[it.type] + '</h3><span><button class="btn btn-sm" type="button" data-back>World</button> <button class="btn btn-sm" type="button" data-del>Delete</button></span></div>');
      head.querySelector("[data-del]").addEventListener("click", function () { edit(); removeItem(it.id); changed(); });
      head.querySelector("[data-back]").addEventListener("click", function () { select(null); });
      c.appendChild(head);
      function sl(key, label, min, max, step, unit, hint) {
        c.appendChild(K.slider({ label: label, unit: unit, min: min, max: max, step: step, value: it[key], hint: hint,
          onInput: function (v) { edit(); it[key] = v; changed(false); } }).el);
      }
      function ck(key, label) { c.appendChild(K.check(label, !!it[key], function (v) { edit(); it[key] = v; changed(false); })); }
      var row;
      switch (it.type) {
        case "block": case "ball":
          sl("m", "Mass $m$", it.m < 0.5 ? 0.1 : 0.5, 100, it.m < 0.5 ? 0.1 : 0.5, "kg");
          if (it.type === "block") { sl("w", "Width", 0.3, 4, 0.1, "m"); sl("h", "Height", 0.3, 4, 0.1, "m"); sl("angle", "Tilt", -60, 60, 1, "°", "Drop a block on a ramp and it tilts to match."); }
          else sl("r", "Radius", 0.1, 1.5, 0.05, "m");
          c.appendChild(K.h("<h3>Start moving</h3>"));
          sl("vx", "Initial $v_x$", -25, 25, 0.1, "m/s"); sl("vy", "Initial $v_y$", -25, 25, 0.1, "m/s");
          c.appendChild(K.h("<h3>Material</h3>"));
          sl("e", "Bounciness $e$", 0, 1, 0.05, "", "0 = sticks together, 1 = perfectly elastic");
          sl("mus", "Static friction $\\mu_s$", 0, 1, 0.05, "", "Against other blocks and balls. Surfaces use their own μ.");
          sl("muk", "Kinetic friction $\\mu_k$", 0, 1, 0.05, "");
          row = K.h('<div class="row"></div>'); c.appendChild(row);
          row.appendChild(K.check("Pinned in place", !!it.pinned, function (v) { edit(); it.pinned = v; changed(false); }));
          row.appendChild(K.check("Trail", !!it.trail, function (v) { edit(); it.trail = v; changed(false); }));
          break;
        case "surface": {
          var cx = (it.x1 + it.x2) / 2, cy = (it.y1 + it.y2) / 2, L = Math.hypot(it.x2 - it.x1, it.y2 - it.y1), ang = Math.round(Math.atan2(it.y2 - it.y1, it.x2 - it.x1) / DEG);
          if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          var setGeom = function () { var a = ang * DEG; it.x1 = r3(cx - L / 2 * Math.cos(a)); it.y1 = r3(cy - L / 2 * Math.sin(a)); it.x2 = r3(cx + L / 2 * Math.cos(a)); it.y2 = r3(cy + L / 2 * Math.sin(a)); };
          c.appendChild(K.slider({ label: "Angle $\\theta$", unit: "°", min: -90, max: 90, step: 1, value: ang, onInput: function (v) { edit(); ang = v; setGeom(); changed(false); } }).el);
          c.appendChild(K.slider({ label: "Length", unit: "m", min: 0.3, max: 30, step: 0.1, value: Math.round(L * 10) / 10, onInput: function (v) { edit(); L = v; setGeom(); changed(false); } }).el);
          sl("mus", "Static friction $\\mu_s$", 0, 1, 0.05, "", "Holds while the push along it is below $\\mu_s N$");
          sl("muk", "Kinetic friction $\\mu_k$", 0, 1, 0.05, "", "Once sliding, friction is a steady $\\mu_k N$");
          sl("e", "Bounciness $e$", 0, 1, 0.05, "");
          if (S.world.mode === "side" && !it.floor) ck("wedge", "Solid underneath (draw as a ramp)");
          break;
        }
        case "pulley": sl("r", "Wheel radius", 0.1, 1, 0.05, "m", "Ideal: massless and frictionless, so the tension is the same on both sides."); break;
        case "mpulley": sl("m", "Mass", 0.01, 5, 0.01, "kg", "Keep it small for a 'light pulley'."); sl("r", "Wheel radius", 0.1, 1, 0.05, "m"); break;
        case "anchor": c.appendChild(K.h('<p class="control-hint">A fixed point. Tie strings and springs to it. Drag it to move it.</p>')); break;
        case "string": sl("slack", "Extra slack", 0, 3, 0.05, "m", "0 = tight at the start. Add slack and the string jerks taut."); c.appendChild(K.h('<p class="control-hint">Light and inextensible: the same tension all along, and it can only pull.</p>')); break;
        case "spring": sl("k", "Spring constant $k$", 1, 500, 1, "N/m"); sl("stretch", "Initial stretch", -2, 3, 0.05, "m", "How far it starts from its natural length. Negative = squashed."); break;
        case "turntable":
          sl("r", "Radius", 0.5, 6, 0.1, "m"); sl("w0", "Starting spin $\\omega_0$", 0, 8, 0.05, "rad/s"); sl("alpha", "Speeding up $\\alpha$", 0, 2, 0.05, "rad/s²");
          sl("mus", "Static friction $\\mu_s$", 0, 1, 0.05, "", "A block stays on while $m\\omega^2 r \\le \\mu_s m g$"); sl("muk", "Kinetic friction $\\mu_k$", 0, 1, 0.05, "");
          break;
      }
    }
    function worldProps(c) {
      var w = S.world;
      c.appendChild(K.h("<h3>World</h3>"));
      c.appendChild(K.seg(MODES, w.mode, setMode, "View"));
      var hintM = { side: "Gravity pulls down the screen.", top: "Looking down on a table: gravity presses into the screen, so friction acts on everything.", space: "No floor, no g. Bodies pull on each other." };
      c.appendChild(K.h('<p class="control-hint">' + hintM[w.mode] + "</p>"));
      function sl(key, label, min, max, step, unit, hint) {
        c.appendChild(K.slider({ label: label, unit: unit, min: min, max: max, step: step, value: w[key], hint: hint, onInput: function (v) { edit(); w[key] = v; changed(false); } }).el);
      }
      if (w.mode !== "space") sl("g", "Gravity $g$", 0, 25, 0.1, "m/s²", w.mode === "top" ? "Sets how hard things press on the table, so how strong friction is." : "Earth 9.8 · Moon 1.6 · Jupiter 24.8");
      sl("G", "Mutual gravity $G$", 0, 50, 0.5, "", "Hugely scaled up so you can see it (the real G is 6.7 × 10⁻¹¹).");
      if (w.mode === "top") { sl("fmus", "Table friction $\\mu_s$", 0, 1, 0.05, ""); sl("fmuk", "Table friction $\\mu_k$", 0, 1, 0.05, ""); }
      c.appendChild(K.h("<h3>Show</h3>"));
      var row = K.h('<div class="row"></div>');
      row.appendChild(K.check("Velocity", w.vel, function (v) { w.vel = v; save(); }));
      row.appendChild(K.check("Forces on selected", w.fbd, function (v) { w.fbd = v; save(); }));
      row.appendChild(K.check("Trails", w.trails, function (v) { w.trails = v; save(); }));
      c.appendChild(row);
      c.appendChild(K.seg([{ label: "Zoom 1×", value: 1 }, { label: "¾×", value: 0.75 }, { label: "½×", value: 0.5 }], w.zoom || 1,
        function (v) { w.zoom = v; sim.zoom = v; sim.panX = (W - W / v) / 2; save(); }, "Zoom"));
      c.appendChild(K.h('<p class="control-hint">Select a part to change it. <b>Del</b> deletes it, <b>Esc</b> cancels, <b>Ctrl+Z</b> undoes. Your build is saved in this browser.</p>'));
    }
    function setMode(v) {
      edit();
      var w = S.world;
      w.mode = v;
      S.items = S.items.filter(function (it) { return !(it.floor && v !== "side"); });
      if (v === "side" && !S.items.some(function (it) { return it.floor; })) { floor(S); S.items.unshift(S.items.pop()); }
      if (v === "space" && !w.G) w.G = 10;
      if (v !== "top" && tool === "turntable") tool = "select";
      changed(); renderTools(); hud();
    }

    /* ---------- readouts ---------- */
    var showReadouts = K.throttle(renderReadouts, 150);
    function row(label, val, note, cls) { return '<div class="readout"><span>' + label + '</span><b class="' + (cls || "") + '">' + val + "</b> <small>" + (note || "") + "</small></div>"; }
    function renderReadouts() {
      var it = sel && find(sel), o = it && rt.objs[it.id], run = started(), html = "", f = K.fmt;
      q(".pg-sel").textContent = it ? NAMES[it.type].toLowerCase() : "whole system · select a body for its forces";
      if (o && o.body && o.w) {
        var v = run ? o.v : { x: it.vx || 0, y: it.vy || 0 }, a = run ? o.a : ZERO;
        html += row("speed", f(Math.hypot(v.x, v.y), 2) + " m/s", "v<sub>x</sub> " + f(v.x, 2) + " · v<sub>y</sub> " + f(v.y, 2), "c-vel");
        html += row("acceleration", f(Math.hypot(a.x, a.y), 2) + " m/s²", "measured, Δv / Δt", "c-acc");
        html += row("net force", f(o.m * Math.hypot(a.x, a.y), 1) + " N", "= m a, with m = " + f(o.m, 2) + " kg");
        html += row("kinetic energy", f(0.5 * o.m * (v.x * v.x + v.y * v.y), 1) + " J", "½ m v²");
        if (run) {
          var tens = o.F.filter(function (x) { return x.k === "T"; });
          tens.forEach(function (x, i) { html += row("tension" + (tens.length > 1 ? " " + (i + 1) : ""), f(Math.hypot(x.f.x, x.f.y), 1) + " N", "pull of the string", "c-ten"); });
          if (o.cinfo) {
            html += row("normal force", f(o.cinfo.N, 1) + " N", S.world.mode === "top" ? "= mg, pressing on the table" : "the surface pushing back", "c-normal");
            html += row("friction", f(o.cinfo.f, 1) + " N", o.cinfo.kinetic ? "kinetic: μk N = " + f(o.cinfo.muk * o.cinfo.N, 1) + " N" : "static, can go up to μs N = " + f(o.cinfo.max, 1) + " N", "c-fric");
          }
          o.F.filter(function (x) { return x.k === "k"; }).forEach(function (x) { html += row("spring force", f(Math.hypot(x.f.x, x.f.y), 1) + " N", "k × stretch", "c-app"); });
          var fg = o.F.filter(function (x) { return x.k === "G"; });
          if (fg.length) { var sx = 0, sy = 0; fg.forEach(function (x) { sx += x.f.x; sy += x.f.y; }); html += row("gravity from others", f(Math.hypot(sx, sy), 1) + " N", "Σ G m₁m₂ / r²", "c-grav"); }
          if (o.tinfo) {
            html += row("radius", f(o.tinfo.r, 2) + " m", "ω = " + f(o.tinfo.om, 2) + " rad/s");
            html += row("needs m ω² r", f(o.tinfo.need, 2) + " N", o.tinfo.need > o.tinfo.max ? "more than friction can give: it slips" : "friction can give up to " + f(o.tinfo.max, 2) + " N", o.tinfo.need > o.tinfo.max ? "c-fric" : "");
          }
        }
      } else if (it && it.type === "string") {
        var R = rt.ropes.filter(function (r) { return r.it === it; })[0];
        if (R) {
          html += row("tension", run ? (R.taut ? f(R.T, 2) + " N" : "0 N") : "—", run ? (R.taut ? "same all along" : "slack") : "press Play", "c-ten");
          html += row("length", f(R.L, 2) + " m", "fixed: it can't stretch");
        }
      } else if (it && it.type === "spring") {
        var sp = rt.springs.filter(function (s) { return s.it === it; })[0];
        if (sp) {
          var a2 = pos(sp.a), b2 = pos(sp.b), x = Math.hypot(b2.x - a2.x, b2.y - a2.y) - sp.L0;
          html += row("stretch x", f(x, 2) + " m", x < 0 ? "squashed" : "stretched");
          html += row("force", f(it.k * Math.abs(x), 1) + " N", "k x, with k = " + f(it.k, 0) + " N/m", "c-app");
          html += row("stored energy", f(0.5 * it.k * x * x, 2) + " J", "½ k x²");
        }
      } else if (it && it.type === "surface") {
        var ang = Math.atan2(it.y2 - it.y1, it.x2 - it.x1) / DEG; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        html += row("angle", f(Math.abs(ang), 0) + "°", "tan θ = " + f(Math.tan(Math.abs(ang) * DEG), 2));
        html += row("angle of repose", f(Math.atan(it.mus) / DEG, 1) + "°", "blocks slip above tan⁻¹ μs");
      } else if (it && it.type === "turntable") {
        var t = rt.tts.filter(function (x) { return x.it === it; })[0];
        if (t) html += row("spin ω", f(t.om, 2) + " rad/s", "= " + f(t.om * 60 / (2 * Math.PI), 1) + " rpm");
      }
      var en = energy();
      html += row("system KE", f(en.KE, 1) + " J", "all bodies", "c-vel");
      html += row("system PE", f(en.PE, 1) + " J", S.world.mode === "side" ? "m g y, + springs" : "springs + gravity", "c-grav");
      html += row("total energy", f(en.E, 1) + " J", run ? "Δ = " + f(en.E - rt.E0, 1) + " J since start" : "");
      P.readouts.innerHTML = html;
    }

    /* ---------- buttons, keys ---------- */
    var transportUI = K.transport(P, sim, {
      onPlay: function () { making = null; drawing = null; hud(); },
      onReset: function () { build(); renderReadouts(); }
    });
    function doUndo() {
      if (!undo.length) { K.flash(P.note, "Nothing to undo"); return; }
      sim.pause(); transportUI.render();
      S = JSON.parse(undo.pop()); making = null;
      if (sel && !find(sel)) sel = null;
      changed(); renderTools();
    }
    q('[data-act="undo"]').addEventListener("click", doUndo);
    q('[data-act="clear"]').addEventListener("click", function () { pushUndo(); sim.pause(); transportUI.render(); S = blank(S.world.mode); sel = null; changed(); K.flash(P.note, "Cleared · Undo brings it back"); });
    q('[data-act="link"]').addEventListener("click", function () {
      var url = location.href.split("#")[0] + "#/playground/" + encode(JSON.stringify(S));
      var done = function () { K.flash(P.note, "Link copied: anyone who opens it gets this build", 3000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link", url); });
      else window.prompt("Copy this link", url);
    });
    function onKey(e) {
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { if (making || drawing) { making = null; drawing = null; } else if (tool !== "select") setTool("select"); else select(null); hud(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); edit(); removeItem(sel); changed(); return; }
      var tl = TOOLS.filter(function (x) { return x.key === e.key.toLowerCase(); })[0];
      if (tl && !(tl.mode && tl.mode !== S.world.mode)) setTool(tl.id);
    }
    document.addEventListener("keydown", onKey);

    build(); renderTools(); renderProps(); renderReadouts(); hud();
    if (code) K.flash(P.note, "Loaded a shared build · press Play", 3500);
    if (location.hostname === "localhost") window.__pg = {   // dev-only test hook
      sim: sim, loadPreset: loadPreset, select: select, energy: energy, pos: pos,
      get S() { return S; }, get rt() { return rt; }, set S(v) { S = v; changed(); }
    };

    return function destroy() {
      document.removeEventListener("keydown", onKey);
      sim.destroy(); gv.destroy(); ge.destroy();
    };
  }

  function encode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function decode(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }

  return { mount: mount, PRESETS: PRESETS };
})();
