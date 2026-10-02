/* Concept maps: one cause -> effect graph for the whole course, drawn per lab or all at once.
   Every edge reads "cause -> effect". Clicking a concept lights up the chain of causes that
   lead to it and the chain of effects it leads to: that chain is what makes recall quick. */
var Maps = (function () {
  "use strict";

  // id: { label, lab (where it's taught), why (one line: why it matters) }
  var NODES = {
    // kinematics
    pos:    { label: "Position x", lab: "line", why: "Where the body is. Everything else in kinematics describes how this changes." },
    vel:    { label: "Velocity v", lab: "line", why: "How fast position changes: the slope of the x–t graph. Changes only if something accelerates it." },
    acc:    { label: "Acceleration a", lab: "line", why: "How fast velocity changes: the slope of v–t. Forces decide it, so this is where dynamics meets kinematics." },
    graphs: { label: "Motion graphs", lab: "line", why: "Slopes give rates, areas give changes. Often the fastest way to read a JEE problem." },
    suvat:  { label: "Equations of motion", lab: "line", why: "With constant a, v = u + at, s = ut + ½at², v² = u² + 2as link everything. Pick the one without the quantity you don't need." },
    dist:   { label: "Distance ≠ displacement", lab: "line", why: "A turning point (v = 0) splits the motion. The classic trap: add the pieces for distance." },
    gconst: { label: "Free fall: a = g", lab: "projectile", why: "Near Earth every body gets the same downward acceleration, whatever its mass." },
    indep:  { label: "x and y are independent", lab: "projectile", why: "A 2D motion is two 1D motions sharing one clock. Solve each axis separately." },
    proj:   { label: "Projectile T, H, R", lab: "projectile", why: "What independence plus constant g give you: T = 2u sinθ/g, H = u² sin²θ/2g, R = u² sin2θ/g." },
    frames: { label: "Frame of reference", lab: "relative", why: "Motion depends on who measures it. Choose the frame where the problem is simplest." },
    vecadd: { label: "Velocities add as vectors", lab: "relative", why: "v(ground) = v(relative to water) + v(water). Arrows, not numbers." },
    river:  { label: "River crossing", lab: "relative", why: "The across component sets the time; the downstream component sets the drift. Shortest time ≠ shortest path." },
    // laws of motion
    weight: { label: "Weight mg", lab: "forces", why: "Always acts, always straight down. Divided by mass it's just g." },
    normal: { label: "Normal force N", lab: "forces", why: "A surface pushes back exactly enough to stop you sinking in. It sets how much friction is possible." },
    fric:   { label: "Friction", lab: "forces", why: "Static friction adjusts up to μsN; kinetic friction is a steady μkN. Always opposes sliding." },
    tension:{ label: "Tension T", lab: "pulleys", why: "A light string transmits the same pull all along it, and only ever pulls." },
    fbd:    { label: "Free-body diagram", lab: "forces", why: "Every force on one body, drawn as arrows. Without it you can't add the forces correctly." },
    force:  { label: "Net force ΣF", lab: "forces", why: "The single cause of every change in motion. Add the arrows from the free-body diagram." },
    n2:     { label: "Newton's 2nd law ΣF = ma", lab: "forces", why: "The bridge from forces to motion: find ΣF, divide by m, and kinematics takes over." },
    n1:     { label: "Newton's 1st law", lab: "forces", why: "Zero net force means constant velocity, not necessarily rest." },
    comp:   { label: "Components on a slope", lab: "incline", why: "Tilt your axes: mg sinθ drives the block down the slope, mg cosθ presses it into the ramp." },
    repose: { label: "Angle of repose", lab: "incline", why: "Slips when tanθ > μs. Mass cancels, so it's a property of the two surfaces alone." },
    system: { label: "Equations per body, then add", lab: "pulleys", why: "Write ΣF = ma for each block; adding cancels the tension and gives a, then back-substitute for T." }
  };

  // cause -> effect, with the verb that links them
  var EDGES = [
    ["acc", "vel", "changes"], ["vel", "pos", "changes"],
    ["pos", "graphs", "plotted as"], ["vel", "graphs", "plotted as"], ["acc", "graphs", "plotted as"],
    ["graphs", "dist", "reveal turns for"], ["acc", "suvat", "if constant"], ["suvat", "dist", "split at v = 0"],
    ["weight", "gconst", "per kg is"], ["gconst", "indep", "acts on y only"], ["indep", "proj", "gives"], ["suvat", "proj", "on each axis gives"],
    ["frames", "vecadd", "differ by a velocity"], ["vel", "vecadd", "combine by"], ["vecadd", "river", "explains"], ["indep", "river", "same trick:"],
    ["weight", "fbd", "goes into"], ["normal", "fbd", "goes into"], ["fric", "fbd", "goes into"], ["tension", "fbd", "goes into"],
    ["normal", "fric", "sets max of"], ["weight", "comp", "splits into"], ["comp", "normal", "N = mg cosθ"],
    ["comp", "repose", "vs friction gives"], ["fric", "repose", "limits"],
    ["fbd", "force", "adds up to"], ["force", "n2", "divided by m in"], ["force", "n1", "if zero"],
    ["n2", "acc", "sets"], ["n1", "vel", "keeps constant"],
    ["tension", "system", "cancels in"], ["system", "acc", "solves for"]
  ];

  // the concepts each lab is about (its neighbours from other labs are shown faded)
  var LAB_NODES = {
    line: ["pos", "vel", "acc", "graphs", "suvat", "dist"],
    projectile: ["gconst", "indep", "suvat", "proj", "weight"],
    relative: ["frames", "vecadd", "river", "vel", "indep"],
    forces: ["weight", "normal", "fric", "fbd", "force", "n2", "n1"],
    incline: ["weight", "comp", "normal", "fric", "repose", "fbd"],
    pulleys: ["tension", "weight", "fbd", "force", "system", "n2", "acc"]
  };

  function chapterOf(id) {
    var lab = K.labs.filter(function (l) { return l.id === NODES[id].lab; })[0];
    return lab ? lab.chapter : "";
  }

  /* ---------- layered layout: causes on the left, effects on the right ---------- */
  function layout(ids) {
    var set = {}; ids.forEach(function (id) { set[id] = true; });
    var edges = EDGES.filter(function (e) { return set[e[0]] && set[e[1]]; });
    var layer = {}, changed = true, guard = 0;
    ids.forEach(function (id) { layer[id] = 0; });
    while (changed && guard++ < 50) {             // longest path from the root causes
      changed = false;
      edges.forEach(function (e) { if (layer[e[1]] < layer[e[0]] + 1) { layer[e[1]] = layer[e[0]] + 1; changed = true; } });
    }
    var cols = [];
    ids.forEach(function (id) { (cols[layer[id]] = cols[layer[id]] || []).push(id); });
    cols = cols.filter(Boolean);
    // order each column by the average position of its causes, so arrows cross less
    for (var pass = 0; pass < 3; pass++) {
      cols.forEach(function (col, ci) {
        if (!ci) return;
        var prev = cols[ci - 1].concat(ci > 1 ? cols[ci - 2] : []);
        var score = {};
        col.forEach(function (id) {
          var ins = edges.filter(function (e) { return e[1] === id && prev.indexOf(e[0]) !== -1; });
          score[id] = ins.length ? ins.reduce(function (s, e) { return s + cols.reduce(function (acc, c) { var k = c.indexOf(e[0]); return k !== -1 ? k : acc; }, 0); }, 0) / ins.length : col.indexOf(id);
        });
        col.sort(function (a, b) { return score[a] - score[b]; });
      });
    }
    return { cols: cols, edges: edges };
  }

  function width(label) { return Math.max(104, Math.min(196, label.length * 7.4 + 26)); }

  /* ---------- render ---------- */
  // opts: { core: [ids] (full colour), ghosts: [ids] (faded, from other labs), labId }
  function render(el, opts) {
    var ids = opts.core.concat(opts.ghosts || []), lay = layout(ids);
    var colW = 210, rowH = 64, padX = 20, padY = 22, maxRows = Math.max.apply(null, lay.cols.map(function (c) { return c.length; }));
    var W, H, pos = {}, vert = !!opts.vertical;
    if (vert) {                                    // big map: causes on top, effects below, so it fits a screen
      var gap = 18, layerH = 92, rowW = lay.cols.map(function (col) {
        return col.reduce(function (s, id) { return s + width(NODES[id].label) + gap; }, -gap);
      });
      W = padX * 2 + Math.max.apply(null, rowW); H = padY * 2 + (lay.cols.length - 1) * layerH + 34;
      lay.cols.forEach(function (col, ci) {
        var x = (W - rowW[ci]) / 2;
        col.forEach(function (id) { var w = width(NODES[id].label); pos[id] = { x: x, y: padY + ci * layerH, w: w }; x += w + gap; });
      });
    } else {
      W = padX * 2 + lay.cols.length * colW - 20; H = padY * 2 + maxRows * rowH;
      lay.cols.forEach(function (col, ci) {
        var top = padY + (maxRows - col.length) * rowH / 2;
        col.forEach(function (id, ri) { pos[id] = { x: padX + ci * colW, y: top + ri * rowH, w: width(NODES[id].label) }; });
      });
    }
    var ghost = {}; (opts.ghosts || []).forEach(function (g) { ghost[g] = true; });

    var svg = '<svg class="cmap" style="min-width:' + Math.round(W * 0.62) + 'px;max-width:' + W + 'px" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Concept map: cause to effect">' +
      '<defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>';
    lay.edges.forEach(function (e, i) {
      var a = pos[e[0]], b = pos[e[1]];
      var x1, y1, x2, y2, d, lx, ly;
      if (vert) {
        x1 = a.x + a.w / 2; y1 = a.y + 34; x2 = b.x + b.w / 2; y2 = b.y - 4;
        var my = y2 - 46;                          // bend just above the target, so skip-layer arrows stay readable
        d = "M" + x1 + " " + y1 + " C" + x1 + " " + (y1 + 40) + " " + x2 + " " + my + " " + x2 + " " + y2;
        lx = (x1 + x2) / 2; ly = (y1 + 3 * (y1 + 40) + 3 * my + y2) / 8 + 3;   // midpoint of the curve
      } else {
        x1 = a.x + a.w; y1 = a.y + 17; x2 = b.x - 4; y2 = b.y + 17;
        var mx = (x1 + x2) / 2;
        d = "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2;
        lx = mx; ly = (y1 + y2) / 2 - 5;
      }
      var cls = "cm-edge" + (ghost[e[0]] || ghost[e[1]] ? " ghost" : "");
      svg += '<g class="' + cls + '" data-from="' + e[0] + '" data-to="' + e[1] + '">' +
        '<path d="' + d + '" marker-end="url(#cm-arrow)"/>' +
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle">' + esc(e[2]) + "</text></g>";
      void i;
    });
    ids.forEach(function (id) {
      var p = pos[id], n = NODES[id], ch = chapterOf(id);
      svg += '<g class="cm-node ch-' + ch + (ghost[id] ? " ghost" : "") + (opts.labId && n.lab === opts.labId ? " here" : "") + '" data-id="' + id + '" tabindex="0" role="button" aria-label="' + esc(n.label) + '">' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="34" rx="17"/>' +
        '<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + 21.5) + '" text-anchor="middle">' + esc(n.label) + "</text></g>";
    });
    svg += "</svg>";

    el.innerHTML = '<div class="cmap-scroll">' + svg + '</div><div class="cmap-detail" aria-live="polite"><p class="muted">Tap a concept to light up what causes it and what it leads to.</p></div>';
    if (opts.labId) el.insertAdjacentHTML("beforeend", '<p class="cmap-more"><a href="#/map">Open the full map: move, connect and add your own ideas →</a></p>');
    var root = el.querySelector("svg"), detail = el.querySelector(".cmap-detail");

    function chain(id, dir) {                          // all ancestors (dir 0) or descendants (dir 1)
      var out = {}, stack = [id];
      while (stack.length) {
        var cur = stack.pop();
        lay.edges.forEach(function (e) {
          var from = dir ? e[0] : e[1], to = dir ? e[1] : e[0];
          if (from === cur && !out[to]) { out[to] = true; stack.push(to); }
        });
      }
      return out;
    }
    function select(id) {
      var up = chain(id, 0), down = chain(id, 1);
      root.classList.add("focused");
      root.querySelectorAll(".cm-node").forEach(function (g) {
        var k = g.dataset.id;
        g.classList.toggle("sel", k === id); g.classList.toggle("cause", !!up[k]); g.classList.toggle("effect", !!down[k]);
      });
      root.querySelectorAll(".cm-edge").forEach(function (g) {
        var f = g.dataset.from, t = g.dataset.to;
        g.classList.toggle("cause", !!((t === id || up[t]) && up[f]));          // part of a chain leading here
        g.classList.toggle("effect", !!((f === id || down[f]) && down[t]));     // part of a chain leading on from here
      });
      var n = NODES[id], lab = K.labs.filter(function (l) { return l.id === n.lab; })[0];
      var causes = lay.edges.filter(function (e) { return e[1] === id; }).map(function (e) { return "<b>" + esc(NODES[e[0]].label) + "</b> " + esc(e[2]); });
      var effects = lay.edges.filter(function (e) { return e[0] === id; }).map(function (e) { return esc(e[2]) + " <b>" + esc(NODES[e[1]].label) + "</b>"; });
      detail.innerHTML = "<h3>" + esc(n.label) + "</h3><p>" + esc(n.why) + "</p>" +
        (causes.length ? '<p class="cmap-line cause"><span>because of</span> ' + causes.join(" · ") + "</p>" : '<p class="cmap-line cause"><span>root cause</span> nothing above it on this map</p>') +
        (effects.length ? '<p class="cmap-line effect"><span>so it</span> ' + effects.join(" · ") + "</p>" : '<p class="cmap-line effect"><span>end result</span> where the chain arrives</p>') +
        (lab && lab.id !== opts.labId ? '<p><a class="btn btn-sm" href="#/' + lab.chapter + "/" + lab.id + '">Open the ' + esc(lab.title) + " lab →</a></p>" : "");
    }
    root.addEventListener("click", function (e) {
      var g = e.target.closest(".cm-node");
      if (g) select(g.dataset.id);
      else { root.classList.remove("focused"); root.querySelectorAll(".sel,.cause,.effect").forEach(function (x) { x.classList.remove("sel", "cause", "effect"); }); }
    });
    root.addEventListener("keydown", function (e) {
      var g = e.target.closest && e.target.closest(".cm-node");
      if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(g.dataset.id); }
    });
    if (opts.select) select(opts.select);
  }

  function esc(s) { return FB_esc(s); }
  function FB_esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  // a lab's map: its own concepts plus one step out into other labs
  function forLab(el, labId) {
    var core = LAB_NODES[labId] || [], set = {}, ghosts = [];
    core.forEach(function (id) { set[id] = true; });
    EDGES.forEach(function (e) {
      [[e[0], e[1]], [e[1], e[0]]].forEach(function (pair) {
        if (set[pair[0]] && !set[pair[1]] && ghosts.indexOf(pair[1]) === -1) ghosts.push(pair[1]);
      });
    });
    render(el, { core: core, ghosts: ghosts, labId: labId });
  }

  // the whole course on one page
  function mount(root) {
    var el = K.h('<div class="home map-page">' +
      '<p class="mono muted">Concept map · every arrow reads cause → effect</p>' +
      "<h1>How it all connects</h1>" +
      '<p class="lede">Physics is a chain of causes. Forces cause acceleration, acceleration changes velocity, velocity changes position. Tap any idea to light up what drives it and what it drives. Recalling the chain is faster than recalling the facts one by one.</p>' +
      '<div class="cmap-legend"><span class="ch-kinematics"><i></i>Kinematics</span><span class="ch-laws"><i></i>Laws of motion</span><span class="lg-cause"><i></i>causes of the selected idea</span><span class="lg-effect"><i></i>its effects</span></div>' +
      '<div class="panel cmap-panel"></div>' +
      '<h2 class="section-title">Three chains worth knowing by heart</h2>' +
      '<div class="how">' +
        "<div><b>Forces → motion</b><p>Free-body diagram → net force → ΣF = ma → acceleration → velocity → position. Every dynamics problem walks this chain left to right.</p></div>" +
        "<div><b>Weight → slopes → friction</b><p>Weight splits on a slope; mg cos θ sets the normal force, the normal force caps friction, and friction against mg sin θ decides whether it slides.</p></div>" +
        "<div><b>One motion → two</b><p>Constant g acts only along y, so x and y separate. The same split solves projectiles and river crossings.</p></div>" +
      "</div></div>");
    root.appendChild(el);
    render(el.querySelector(".cmap-panel"), { core: Object.keys(NODES), select: "n2", vertical: true });
    return function () {};
  }

  return { NODES: NODES, EDGES: EDGES, forLab: forLab, mount: mount };
})();
