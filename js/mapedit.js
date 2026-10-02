/* Concept-map editor (#/map). Starts from the course's cause -> effect graph (Maps.NODES / EDGES)
   and lets students move ideas, add their own, connect them with a verb, and collapse a branch.
   Their version is saved in this browser and can be shared as a link or a JSON file. */
var MapEditor = (function () {
  "use strict";

  var KEY = "kinetic:map:v1", NH = 34, GAP = 22, LAYER = 96;
  var COLORS = [["disp", "Blue"], ["vel", "Green"], ["acc", "Orange"], ["app", "Magenta"], ["grav", "Purple"],
    ["ten", "Yellow"], ["normal", "Cyan"], ["fric", "Red"], ["ink", "Ink"]];

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function width(label) { return Math.max(90, Math.min(260, String(label).length * 7.4 + 28)); }
  function short(label) { label = String(label || "Untitled"); return label.length > 34 ? label.slice(0, 33) + "…" : label; }
  function colorFor(labId) {
    var l = K.labs.filter(function (x) { return x.id === labId; })[0], ch = l && K.chapter(l.chapter);
    return ch && ch.color ? ch.color : "ink";
  }
  function encode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function decode(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }

  /* ---------- the map as data ---------- */
  function defaults() {
    var m = { nodes: {}, edges: [], collapsed: {}, removed: {}, next: 1 };
    Object.keys(Maps.NODES).forEach(function (id) {
      var n = Maps.NODES[id];
      m.nodes[id] = { label: n.label, why: n.why, lab: n.lab, color: colorFor(n.lab), x: 0, y: 0 };
    });
    Maps.EDGES.forEach(function (e) { m.edges.push({ id: "e" + m.next++, from: e[0], to: e[1], label: e[2] }); });
    arrange(m);
    return m;
  }
  // course ideas added after a student saved their map still show up (unless they deleted them)
  function merge(m) {
    var added = [];
    Object.keys(Maps.NODES).forEach(function (id) {
      if (m.nodes[id] || m.removed["n:" + id]) return;
      var n = Maps.NODES[id];
      m.nodes[id] = { label: n.label, why: n.why, lab: n.lab, color: colorFor(n.lab), x: 0, y: 0 };
      added.push(id);
    });
    Maps.EDGES.forEach(function (e) {
      var key = "e:" + e[0] + ">" + e[1];
      if (m.removed[key] || !m.nodes[e[0]] || !m.nodes[e[1]]) return;
      if (m.edges.some(function (x) { return x.from === e[0] && x.to === e[1]; })) return;
      m.edges.push({ id: "e" + m.next++, from: e[0], to: e[1], label: e[2] });
    });
    if (added.length) {                             // park new ideas in a row under the map
      var maxY = 0, x = 0;
      Object.keys(m.nodes).forEach(function (id) { if (added.indexOf(id) === -1) maxY = Math.max(maxY, m.nodes[id].y); });
      added.forEach(function (id) { m.nodes[id].x = x; m.nodes[id].y = maxY + LAYER * 1.5; x += width(m.nodes[id].label) + GAP; });
    }
    return m;
  }
  function valid(m) { return m && typeof m.nodes === "object" && Array.isArray(m.edges); }
  function clean(m) {
    m.collapsed = m.collapsed || {}; m.removed = m.removed || {}; m.next = m.next || m.edges.length + 1;
    m.edges = m.edges.filter(function (e) { return m.nodes[e.from] && m.nodes[e.to] && e.from !== e.to; });
    m.edges.forEach(function (e) { if (!e.id) e.id = "e" + m.next++; if (e.label == null) e.label = ""; });
    Object.keys(m.nodes).forEach(function (id) { var n = m.nodes[id]; n.x = +n.x || 0; n.y = +n.y || 0; n.label = String(n.label || "Untitled"); n.color = n.color || "ink"; });
    return m;
  }

  // causes on top, effects below: longest-path layers, then order each row under its causes
  function arrange(m) {
    var ids = Object.keys(m.nodes), layer = {}, rows = [];
    var es = m.edges.filter(function (e) { return m.nodes[e.from] && m.nodes[e.to] && e.from !== e.to; });
    ids.forEach(function (id) { layer[id] = 0; });
    for (var k = 0; k < ids.length; k++) {
      var changed = false;
      es.forEach(function (e) { if (layer[e.to] < layer[e.from] + 1 && layer[e.from] + 1 < ids.length) { layer[e.to] = layer[e.from] + 1; changed = true; } });
      if (!changed) break;
    }
    ids.forEach(function (id) { (rows[layer[id]] = rows[layer[id]] || []).push(id); });
    rows = rows.filter(Boolean);
    function place() {
      rows.forEach(function (row, ri) {
        var total = row.reduce(function (s, id) { return s + width(m.nodes[id].label) + GAP; }, -GAP), x = -total / 2;
        row.forEach(function (id) { var n = m.nodes[id]; n.x = Math.round(x); n.y = ri * LAYER; x += width(n.label) + GAP; });
      });
    }
    place();
    for (var pass = 0; pass < 4; pass++) {
      rows.forEach(function (row, ri) {
        if (!ri) return;
        var sc = {};
        row.forEach(function (id) {
          var ps = es.filter(function (e) { return e.to === id; }).map(function (e) { return m.nodes[e.from]; });
          sc[id] = ps.length ? ps.reduce(function (s, n) { return s + n.x + width(n.label) / 2; }, 0) / ps.length : m.nodes[id].x;
        });
        row.sort(function (a, b) { return sc[a] - sc[b]; });
      });
      place();
    }
  }

  // which ideas show: everything reachable from the root causes without passing a collapsed idea
  function visibility(m) {
    var ids = Object.keys(m.nodes), indeg = {}, out = {};
    ids.forEach(function (id) { indeg[id] = 0; out[id] = []; });
    m.edges.forEach(function (e) { if (out[e.from] && indeg[e.to] !== undefined) { indeg[e.to]++; out[e.from].push(e.to); } });
    function reach(seeds, block) {
      var seen = {}, st = seeds.slice();
      seeds.forEach(function (s) { seen[s] = 1; });
      while (st.length) {
        var c = st.pop();
        if (block && m.collapsed[c]) continue;
        out[c].forEach(function (t) { if (!seen[t]) { seen[t] = 1; st.push(t); } });
      }
      return seen;
    }
    var roots = ids.filter(function (id) { return !indeg[id]; }), all = reach(roots, false);
    var vis = reach(roots.concat(ids.filter(function (id) { return !all[id]; })), true), hidden = {};
    ids.forEach(function (c) {
      if (!m.collapsed[c] || !vis[c]) return;
      var d = reach([c], false);
      hidden[c] = Object.keys(d).filter(function (k) { return k !== c && !vis[k]; }).length;
    });
    return { vis: vis, hidden: hidden, out: out };
  }

  /* ---------- page ---------- */
  function mount(root, code) {
    var el = K.h(
      '<div class="home map-page me-page">' +
        '<p class="mono muted">Concept map · every arrow reads cause → effect</p>' +
        "<h1>How it all connects</h1>" +
        '<p class="lede">Physics is a chain of causes. Forces cause acceleration, acceleration changes velocity, velocity changes position. Tap an idea to light up what drives it and what it drives. Then make the map yours: move ideas, add your own, connect them, and fold away what you already know.</p>' +
        '<div class="me-toolbar" role="toolbar" aria-label="Map tools">' +
          '<button class="btn btn-sm btn-primary" data-do="add" type="button">+ Add idea</button>' +
          '<button class="btn btn-sm" data-do="connect" type="button" aria-pressed="false">Connect</button>' +
          '<span class="me-sep"></span>' +
          '<button class="btn btn-sm" data-do="collapse" type="button">Collapse all</button>' +
          '<button class="btn btn-sm" data-do="expand" type="button">Expand all</button>' +
          '<button class="btn btn-sm" data-do="arrange" type="button">Tidy up</button>' +
          '<span class="me-sep"></span>' +
          '<button class="btn btn-sm" data-do="zoomout" type="button" aria-label="Zoom out">−</button>' +
          '<button class="btn btn-sm" data-do="fit" type="button">Fit</button>' +
          '<button class="btn btn-sm" data-do="zoomin" type="button" aria-label="Zoom in">+</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn-sm" data-do="undo" type="button">Undo</button>' +
          '<button class="btn btn-sm" data-do="link" type="button">Copy link</button>' +
          '<button class="btn btn-sm" data-do="download" type="button">Download</button>' +
          '<button class="btn btn-sm" data-do="import" type="button">Import</button>' +
          '<button class="btn btn-sm" data-do="reset" type="button">Reset</button>' +
          '<input type="file" accept=".json,application/json" hidden />' +
        "</div>" +
        '<p class="me-hint mono muted"></p>' +
        '<div class="me-wrap">' +
          '<div class="me-canvas"><svg class="cmap me-svg" role="application" aria-label="Editable concept map"></svg><div class="stage-note"></div></div>' +
          '<aside class="me-side cmap-detail"></aside>' +
        "</div>" +
        '<div class="cmap-legend"><span class="lg-cause"><i></i>causes of the selected idea</span><span class="lg-effect"><i></i>its effects</span>' +
          '<span class="muted">Drag the background to pan · Ctrl + scroll or pinch to zoom · double-click empty space to add an idea · Del deletes · Ctrl+Z undoes</span></div>' +
        '<h2 class="section-title">Three chains worth knowing by heart</h2>' +
        '<div class="how">' +
          "<div><b>Forces → motion</b><p>Free-body diagram → net force → ΣF = ma → acceleration → velocity → position. Every dynamics problem walks this chain left to right.</p></div>" +
          "<div><b>Weight → slopes → friction</b><p>Weight splits on a slope; mg cos θ sets the normal force, the normal force caps friction, and friction against mg sin θ decides whether it slides.</p></div>" +
          "<div><b>One motion → two</b><p>Constant g acts only along y, so x and y separate. The same split solves projectiles and river crossings.</p></div>" +
        "</div>" +
      "</div>");
    root.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var svg = q(".me-svg"), box = q(".me-canvas"), side = q(".me-side"), hint = q(".me-hint"), note = q(".stage-note"), fileIn = q('input[type="file"]');

    var userView = false;
    var M = load(code), undo = [], sel = null, mode = "move", pending = null, act = null, view = { x: 0, y: 0, k: 1 }, V = null;

    function load(c) {
      if (c) { try { var s = JSON.parse(decode(c)); if (valid(s)) return merge(clean(s)); } catch (e) { /* bad link */ } }
      try { var t = JSON.parse(localStorage.getItem(KEY) || "null"); if (valid(t)) return merge(clean(t)); } catch (e) { /* storage blocked */ }
      return defaults();
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) { /* private mode */ } }
    function pushUndo() { undo.push(JSON.stringify(M)); if (undo.length > 80) undo.shift(); }
    function changed() { save(); render(); }
    function flash(t) { K.flash(note, t, 2600); }

    /* ---------- drawing ---------- */
    function center(n) { return { x: n.x + width(n.label) / 2, y: n.y + NH / 2 }; }
    function clip(n, dx, dy) {                       // where a line from the centre leaves the pill
      var hw = width(n.label) / 2 + 3, hh = NH / 2 + 3, t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
      return Math.min(t, 0.5);
    }
    function edgeGeom(e) {
      var a = M.nodes[e.from], b = M.nodes[e.to], ca = center(a), cb = center(b), dx = cb.x - ca.x, dy = cb.y - ca.y;
      var both = M.edges.some(function (x) { return x.from === e.to && x.to === e.from; });
      var L = Math.hypot(dx, dy) || 1, bend = both ? 26 : 0, nx = -dy / L, ny = dx / L;
      var ta = clip(a, dx, dy), tb = clip(b, dx, dy);
      var s = { x: ca.x + dx * ta + nx * bend * 0.4, y: ca.y + dy * ta + ny * bend * 0.4 };
      var t = { x: cb.x - dx * tb + nx * bend * 0.4, y: cb.y - dy * tb + ny * bend * 0.4 };
      var c = { x: (s.x + t.x) / 2 + nx * bend, y: (s.y + t.y) / 2 + ny * bend };
      return { d: "M" + s.x.toFixed(1) + " " + s.y.toFixed(1) + " Q" + c.x.toFixed(1) + " " + c.y.toFixed(1) + " " + t.x.toFixed(1) + " " + t.y.toFixed(1),
        lx: 0.25 * s.x + 0.5 * c.x + 0.25 * t.x, ly: 0.25 * s.y + 0.5 * c.y + 0.25 * t.y };
    }
    function chains() {
      var up = {}, down = {};
      if (!sel || sel.type !== "node") return { up: up, down: down };
      var es = M.edges.filter(function (e) { return V.vis[e.from] && V.vis[e.to] && !M.collapsed[e.from]; });
      [[up, "to", "from"], [down, "from", "to"]].forEach(function (d) {
        var st = [sel.id];
        while (st.length) {
          var c = st.pop();
          es.forEach(function (e) { if (e[d[1]] === c && !d[0][e[d[2]]]) { d[0][e[d[2]]] = true; st.push(e[d[2]]); } });
        }
      });
      return { up: up, down: down };
    }
    function render() {
      V = visibility(M);
      var ch = chains(), id0 = sel && sel.type === "node" ? sel.id : null;
      var h = '<defs>' + [["me-a", "muted"], ["me-ac", "acc"], ["me-av", "vel"], ["me-ai", "ink"]].map(function (m) {
        return '<marker id="' + m[0] + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--' + m[1] + ')"/></marker>';
      }).join("") + "</defs><g class=\"me-edges\">";
      M.edges.forEach(function (e) {
        if (!V.vis[e.from] || !V.vis[e.to] || M.collapsed[e.from]) return;
        var g = edgeGeom(e), cls = "";
        if (id0) {
          if ((e.to === id0 || ch.up[e.to]) && ch.up[e.from]) cls += " cause";
          if ((e.from === id0 || ch.down[e.from]) && ch.down[e.to]) cls += " effect";
        }
        if (sel && sel.type === "edge" && sel.id === e.id) cls += " esel";
        h += '<g class="cm-edge me-edge' + cls + '" data-edge="' + e.id + '"><path class="me-hit" d="' + g.d + '"/><path class="me-line" d="' + g.d + '"/>' +
          (e.label ? '<text x="' + g.lx.toFixed(1) + '" y="' + (g.ly + 3).toFixed(1) + '" text-anchor="middle">' + esc(e.label) + "</text>" : "") + "</g>";
      });
      h += '</g><g class="me-nodes">';
      Object.keys(M.nodes).forEach(function (id) {
        if (!V.vis[id]) return;
        var n = M.nodes[id], w = width(n.label), cls = "";
        if (id === id0) cls += " sel";
        if (ch.up[id]) cls += " cause";
        if (ch.down[id]) cls += " effect";
        if (pending === id) cls += " pending";
        if (M.collapsed[id]) cls += " folded";
        h += '<g class="cm-node me-node' + cls + '" data-id="' + esc(id) + '" transform="translate(' + n.x + " " + n.y + ')" style="--c:var(--' + n.color + ')" tabindex="0" role="button" aria-label="' + esc(n.label) + '">' +
          '<rect width="' + w + '" height="' + NH + '" rx="17"/><text x="' + (w / 2) + '" y="21.5" text-anchor="middle">' + esc(short(n.label)) + "</text>";
        if (V.out[id].length) {
          var lab = M.collapsed[id] ? "+" + (V.hidden[id] || "") : "−";
          h += '<g class="me-toggle" transform="translate(' + (w / 2) + " " + NH + ')"><title>' + (M.collapsed[id] ? "Expand: show its effects" : "Collapse: hide its effects") + '</title><circle r="9"/><text y="3.6" text-anchor="middle">' + lab + "</text></g>";
        }
        h += '<circle class="me-handle" cx="' + w + '" cy="' + (NH / 2) + '" r="7"><title>Drag to connect to another idea</title></circle></g>';
      });
      h += "</g>";
      if (act && act.kind === "link") {
        var a = center(M.nodes[act.from]);
        h += '<line class="me-preview" x1="' + a.x + '" y1="' + a.y + '" x2="' + act.p.x + '" y2="' + act.p.y + '" marker-end="url(#me-ai)"/>';
      }
      svg.innerHTML = h;
      svg.classList.toggle("focused", !!id0);
      box.classList.toggle("connect", mode === "connect");
      applyView();
      hint.textContent = mode === "connect" ? (pending ? "Now click the idea it leads to (the effect) · Esc to stop" : "Connect mode: click the cause, then its effect") :
        "Drag ideas to move them · drag from the dot on an idea's right edge to connect it · − / + folds a branch";
    }
    function applyView() {
      var cw = box.clientWidth || 800, chh = box.clientHeight || 500;
      svg.setAttribute("viewBox", view.x.toFixed(1) + " " + view.y.toFixed(1) + " " + (cw / view.k).toFixed(1) + " " + (chh / view.k).toFixed(1));
    }
    function fit() {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Object.keys(M.nodes).forEach(function (id) {
        if (V && !V.vis[id]) return;
        var n = M.nodes[id];
        x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + width(n.label)); y1 = Math.max(y1, n.y + NH + 10);
      });
      if (!isFinite(x0)) { x0 = -200; y0 = -100; x1 = 200; y1 = 100; }
      var cw = box.clientWidth || 800, chh = box.clientHeight || 500, pad = 40;
      view.k = K.clamp(Math.min(cw / (x1 - x0 + pad * 2), chh / (y1 - y0 + pad * 2)), 0.25, 1.3);
      view.x = (x0 + x1) / 2 - cw / view.k / 2; view.y = (y0 + y1) / 2 - chh / view.k / 2;
      applyView();
    }
    function zoomAt(p, f) {
      userView = true;
      var k = K.clamp(view.k * f, 0.25, 2.5);
      view.x = p.x - (p.x - view.x) * view.k / k; view.y = p.y - (p.y - view.y) * view.k / k; view.k = k;
      applyView();
    }
    function centerOn(id) {
      var c = center(M.nodes[id]), cw = box.clientWidth, chh = box.clientHeight;
      view.x = c.x - cw / view.k / 2; view.y = c.y - chh / view.k / 2; applyView();
    }

    /* ---------- editing ---------- */
    function select(s) { sel = s; render(); panel(); }
    function addNode(p) {
      pushUndo();
      var id = "u" + (M.next++), w = width("New idea");
      while (M.nodes[id]) id = "u" + (M.next++);
      if (!p) { var cw = box.clientWidth, chh = box.clientHeight; p = { x: view.x + cw / view.k / 2, y: view.y + chh / view.k / 2 }; }
      M.nodes[id] = { label: "New idea", why: "", lab: "", color: "ink", x: Math.round(p.x - w / 2), y: Math.round(p.y - NH / 2), custom: true };
      changed(); select({ type: "node", id: id });
      var inp = side.querySelector("[data-f=label]");
      if (inp) { inp.focus(); inp.select(); }
    }
    function addEdge(from, to) {
      if (from === to) return;
      var ex = M.edges.filter(function (e) { return e.from === from && e.to === to; })[0];
      if (ex) { flash("Those two are already connected"); select({ type: "edge", id: ex.id }); return; }
      pushUndo();
      var e = { id: "e" + M.next++, from: from, to: to, label: "leads to" };
      M.edges.push(e);
      if (M.collapsed[from]) delete M.collapsed[from];
      delete M.removed["e:" + from + ">" + to];
      changed(); select({ type: "edge", id: e.id });
      var inp = side.querySelector("[data-f=verb]");
      if (inp) { inp.focus(); inp.select(); }
      flash("Connected · now say how: what does the cause do to the effect?");
    }
    function removeNode(id) {
      pushUndo();
      M.edges = M.edges.filter(function (e) {
        if (e.from !== id && e.to !== id) return true;
        if (Maps.NODES[e.from] && Maps.NODES[e.to]) M.removed["e:" + e.from + ">" + e.to] = 1;
        return false;
      });
      if (Maps.NODES[id]) M.removed["n:" + id] = 1;
      delete M.nodes[id]; delete M.collapsed[id];
      sel = null; changed(); panel();
    }
    function removeEdge(eid) {
      pushUndo();
      M.edges = M.edges.filter(function (e) {
        if (e.id !== eid) return true;
        if (Maps.NODES[e.from] && Maps.NODES[e.to]) M.removed["e:" + e.from + ">" + e.to] = 1;
        return false;
      });
      sel = null; changed(); panel();
    }
    function toggle(id) { pushUndo(); if (M.collapsed[id]) delete M.collapsed[id]; else M.collapsed[id] = true; changed(); panel(); }
    function setMode(m) {
      mode = m; pending = null;
      q('[data-do="connect"]').setAttribute("aria-pressed", String(m === "connect"));
      render();
    }

    /* ---------- side panel ---------- */
    function nodeLink(id) { var n = M.nodes[id]; return '<button type="button" class="me-link" data-go="' + esc(id) + '">' + esc(n ? n.label : id) + "</button>"; }
    function panel() {
      var h = "";
      if (sel && sel.type === "node" && M.nodes[sel.id]) {
        var id = sel.id, n = M.nodes[id], lab = K.labs.filter(function (l) { return l.id === n.lab; })[0];
        var ins = M.edges.filter(function (e) { return e.to === id; }), outs = M.edges.filter(function (e) { return e.from === id; });
        h += '<label class="me-field"><span>Idea</span><input data-f="label" maxlength="60" value="' + esc(n.label) + '" /></label>' +
          '<label class="me-field"><span>Why it matters</span><textarea data-f="why" rows="3" placeholder="One line: why this idea matters">' + esc(n.why || "") + "</textarea></label>" +
          '<div class="me-field"><span>Colour</span><div class="me-swatches">' + COLORS.map(function (c) {
            return '<button type="button" data-color="' + c[0] + '" aria-label="' + c[1] + '" aria-pressed="' + (n.color === c[0]) + '" style="--c:var(--' + c[0] + ')"></button>';
          }).join("") + "</div></div>" +
          '<label class="me-field"><span>Taught in</span><select data-f="lab"><option value="">No lab</option>' + K.labs.map(function (l) {
            return '<option value="' + l.id + '"' + (l.id === n.lab ? " selected" : "") + ">" + esc(K.chapter(l.chapter).title + " · " + l.title) + "</option>";
          }).join("") + "</select></label>" +
          (lab ? '<p><a class="btn btn-sm" href="#/' + lab.chapter + "/" + lab.id + '">Open the ' + esc(lab.title) + " lab →</a></p>" : "") +
          '<p class="cmap-line cause"><span>because of</span> ' + (ins.length ? ins.map(function (e) { return nodeLink(e.from) + ' <i class="muted">' + esc(e.label) + "</i>"; }).join(" · ") : '<span class="muted">nothing yet: it\'s a root cause</span>') + "</p>" +
          '<p class="cmap-line effect"><span>so it</span> ' + (outs.length ? outs.map(function (e) { return '<i class="muted">' + esc(e.label) + "</i> " + nodeLink(e.to); }).join(" · ") : '<span class="muted">leads nowhere yet</span>') + "</p>" +
          '<div class="me-actions"><button class="btn btn-sm btn-primary" data-a="from" type="button">Connect to…</button>' +
          (outs.length ? '<button class="btn btn-sm" data-a="fold" type="button">' + (M.collapsed[id] ? "Expand its effects" : "Collapse its effects") + "</button>" : "") +
          '<button class="btn btn-sm" data-a="delnode" type="button">Delete idea</button></div>';
      } else if (sel && sel.type === "edge") {
        var e = M.edges.filter(function (x) { return x.id === sel.id; })[0];
        if (!e) { sel = null; return panel(); }
        h += "<h3>Connection</h3>" +
          '<p class="me-arrow">' + nodeLink(e.from) + ' <span class="muted">→</span> ' + nodeLink(e.to) + "</p>" +
          '<label class="me-field"><span>How the cause acts on the effect</span><input data-f="verb" maxlength="40" value="' + esc(e.label) + '" placeholder="sets, changes, limits…" /></label>' +
          '<p class="control-hint">Read it as a sentence: <b>' + esc(M.nodes[e.from].label) + "</b> " + esc(e.label || "…") + " <b>" + esc(M.nodes[e.to].label) + "</b>.</p>" +
          '<div class="me-actions"><button class="btn btn-sm" data-a="reverse" type="button">Reverse</button><button class="btn btn-sm" data-a="deledge" type="button">Delete connection</button></div>';
      } else {
        var nIdeas = Object.keys(M.nodes).length, nHidden = nIdeas - Object.keys(V ? V.vis : {}).length;
        h += "<h3>Your concept map</h3>" +
          '<p class="muted">' + nIdeas + " ideas · " + M.edges.length + " connections" + (nHidden ? " · " + nHidden + " folded away" : "") + "</p>" +
          '<label class="me-field"><span>Find an idea</span><input data-f="find" list="me-ideas" placeholder="Type to search…" /></label>' +
          '<datalist id="me-ideas">' + Object.keys(M.nodes).map(function (id) { return '<option value="' + esc(M.nodes[id].label) + '"></option>'; }).join("") + "</datalist>" +
          '<ol class="me-help"><li><b>Tap an idea</b> to see its causes and effects, and to edit it.</li><li><b>Drag from the dot</b> on its right edge onto another idea to connect them. Give the arrow a verb.</li>' +
          "<li><b>− / +</b> under an idea folds away everything it leads to.</li><li><b>Double-click</b> empty space to add your own idea.</li></ol>" +
          '<p class="control-hint">Your map is saved in this browser. Copy link or Download to keep or share it.</p>';
      }
      side.innerHTML = h;
    }
    side.addEventListener("click", function (e) {
      var go = e.target.closest("[data-go]");
      if (go) { select({ type: "node", id: go.dataset.go }); centerOn(go.dataset.go); return; }
      var sw = e.target.closest("[data-color]");
      if (sw && sel && sel.type === "node") { pushUndo(); M.nodes[sel.id].color = sw.dataset.color; changed(); panel(); return; }
      var a = e.target.closest("[data-a]");
      if (!a || !sel) return;
      if (a.dataset.a === "from") { setMode("connect"); pending = sel.id; render(); }
      else if (a.dataset.a === "fold") toggle(sel.id);
      else if (a.dataset.a === "delnode") removeNode(sel.id);
      else if (a.dataset.a === "deledge") removeEdge(sel.id);
      else if (a.dataset.a === "reverse") {
        var ed = M.edges.filter(function (x) { return x.id === sel.id; })[0];
        if (M.edges.some(function (x) { return x.from === ed.to && x.to === ed.from; })) { flash("There's already an arrow the other way"); return; }
        pushUndo(); var t = ed.from; ed.from = ed.to; ed.to = t; changed(); panel();
      }
    });
    side.addEventListener("focusin", function (e) { if (e.target.matches("[data-f=label],[data-f=why],[data-f=verb]")) pushUndo(); });
    side.addEventListener("input", function (e) {
      var f = e.target.dataset.f;
      if (!f || !sel) return;
      if (f === "label" && sel.type === "node") { M.nodes[sel.id].label = e.target.value || "Untitled"; changed(); }
      else if (f === "why" && sel.type === "node") { M.nodes[sel.id].why = e.target.value; save(); }
      else if (f === "verb" && sel.type === "edge") { M.edges.filter(function (x) { return x.id === sel.id; })[0].label = e.target.value; changed(); }
    });
    side.addEventListener("change", function (e) {
      var f = e.target.dataset.f;
      if (f === "lab" && sel && sel.type === "node") { pushUndo(); M.nodes[sel.id].lab = e.target.value; changed(); panel(); }
      if (f === "find") {
        var v = e.target.value.trim().toLowerCase(), id = Object.keys(M.nodes).filter(function (k) { return M.nodes[k].label.toLowerCase() === v; })[0] ||
          Object.keys(M.nodes).filter(function (k) { return M.nodes[k].label.toLowerCase().indexOf(v) !== -1; })[0];
        if (!id) { flash("No idea matches"); return; }
        if (!V.vis[id]) { Object.keys(M.collapsed).forEach(function (c) { delete M.collapsed[c]; }); render(); }
        select({ type: "node", id: id }); centerOn(id);
      }
    });

    /* ---------- pointer: move, connect, pan, zoom ---------- */
    function pt(e) { var r = svg.getBoundingClientRect(); return { x: view.x + (e.clientX - r.left) / view.k, y: view.y + (e.clientY - r.top) / view.k }; }
    function nodeAt(p) {                              // topmost visible idea under a map point (with a little slack)
      var ids = Object.keys(M.nodes), hit = null;
      ids.forEach(function (id) {
        var n = M.nodes[id];
        if (V.vis[id] && p.x >= n.x - 6 && p.x <= n.x + width(n.label) + 6 && p.y >= n.y - 6 && p.y <= n.y + NH + 6) hit = id;
      });
      return hit;
    }
    svg.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var p = pt(e), t = e.target, nodeEl = t.closest(".me-node"), edgeEl = t.closest(".me-edge");
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      e.preventDefault();
      if (t.closest(".me-toggle")) { act = { kind: "none" }; toggle(nodeEl.dataset.id); return; }
      if (t.closest(".me-handle")) { act = { kind: "link", from: nodeEl.dataset.id, p: p }; render(); return; }
      if (nodeEl) { var n = M.nodes[nodeEl.dataset.id]; act = { kind: "node", id: nodeEl.dataset.id, dx: p.x - n.x, dy: p.y - n.y, sx: e.clientX, sy: e.clientY, moved: false }; return; }
      if (edgeEl) { act = { kind: "none" }; select({ type: "edge", id: edgeEl.dataset.edge }); return; }
      act = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    });
    svg.addEventListener("pointermove", function (e) {
      if (!act) return;
      var p = pt(e);
      if (act.kind === "node") {
        if (!act.moved && Math.hypot(e.clientX - act.sx, e.clientY - act.sy) < 4) return;
        if (!act.moved) { pushUndo(); act.moved = true; }
        var n = M.nodes[act.id];
        n.x = Math.round(p.x - act.dx); n.y = Math.round(p.y - act.dy);
        render();
      } else if (act.kind === "link") { act.p = p; render(); }
      else if (act.kind === "pan") {
        if (Math.hypot(e.clientX - act.sx, e.clientY - act.sy) > 3) act.moved = true;
        userView = true;
        view.x = act.vx - (e.clientX - act.sx) / view.k; view.y = act.vy - (e.clientY - act.sy) / view.k;
        applyView();
      }
    });
    function end(e) {
      if (!act) return;
      var a = act; act = null;
      if (a.kind === "node") {
        if (a.moved) { save(); return; }
        if (mode === "connect") {
          if (!pending) { pending = a.id; render(); }
          else if (pending !== a.id) { var from = pending; pending = null; addEdge(from, a.id); }
          else { pending = null; render(); }
          return;
        }
        select({ type: "node", id: a.id });
      } else if (a.kind === "link") {
        var tid = nodeAt(pt(e));
        if (tid && tid !== a.from) addEdge(a.from, tid);
        else render();
      } else if (a.kind === "pan" && !a.moved) {
        if (mode === "connect" && pending) { pending = null; render(); }
        else if (sel) select(null);
      }
    }
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", function () { act = null; render(); });
    svg.addEventListener("dblclick", function (e) { if (!e.target.closest(".me-node,.me-edge")) addNode(pt(e)); });
    svg.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(pt(e), Math.exp(-e.deltaY * 0.0025));
    }, { passive: false });
    svg.addEventListener("keydown", function (e) {
      var g = e.target.closest && e.target.closest(".me-node");
      if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select({ type: "node", id: g.dataset.id }); }
    });
    // keep the whole map in view as the canvas settles or resizes, until the student pans or zooms it
    var ro = new ResizeObserver(function () { if (!userView && box.clientWidth) fit(); else applyView(); });
    ro.observe(box);

    /* ---------- toolbar ---------- */
    q(".me-toolbar").addEventListener("click", function (e) {
      var b = e.target.closest("[data-do]");
      if (!b) return;
      var c = { x: view.x + box.clientWidth / view.k / 2, y: view.y + box.clientHeight / view.k / 2 };
      switch (b.dataset.do) {
        case "add": addNode(); break;
        case "connect": setMode(mode === "connect" ? "move" : "connect"); break;
        case "collapse":
          pushUndo();
          Object.keys(M.nodes).forEach(function (id) { var r = !M.edges.some(function (x) { return x.to === id; }); if (r && M.edges.some(function (x) { return x.from === id; })) M.collapsed[id] = true; });
          changed(); fit(); panel(); flash("Showing only the root causes · tap + to open a branch"); break;
        case "expand": pushUndo(); M.collapsed = {}; changed(); fit(); panel(); break;
        case "arrange": pushUndo(); arrange(M); changed(); fit(); break;
        case "fit": fit(); break;
        case "zoomin": zoomAt(c, 1.25); break;
        case "zoomout": zoomAt(c, 0.8); break;
        case "undo": doUndo(); break;
        case "reset":
          if (window.confirm("Go back to the original course map? Your ideas and changes will be lost (Undo can still bring them back).")) { pushUndo(); M = defaults(); sel = null; changed(); fit(); panel(); }
          break;
        case "link": {
          var url = location.href.split("#")[0] + "#/map/" + encode(JSON.stringify(M));
          var ok = function () { flash("Link copied: it opens your version of the map"); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { window.prompt("Copy this link", url); });
          else window.prompt("Copy this link", url);
          break;
        }
        case "download": {
          var blob = new Blob([JSON.stringify(M, null, 1)], { type: "application/json" }), a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = "kinetic-concept-map.json";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          break;
        }
        case "import": fileIn.click(); break;
      }
    });
    fileIn.addEventListener("change", function () {
      var f = fileIn.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var m = JSON.parse(txt);
        if (!valid(m)) throw new Error("not a map");
        pushUndo(); M = clean(m); sel = null; changed(); fit(); panel(); flash("Map imported");
      }).catch(function () { flash("That file isn't a Kinetic concept map"); });
      fileIn.value = "";
    });
    function doUndo() {
      if (!undo.length) { flash("Nothing to undo"); return; }
      M = clean(JSON.parse(undo.pop()));
      if (sel && sel.type === "node" && !M.nodes[sel.id]) sel = null;
      if (sel && sel.type === "edge" && !M.edges.some(function (x) { return x.id === sel.id; })) sel = null;
      changed(); panel();
    }
    function onKey(e) {
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); return; }
      if (e.key === "Escape") { if (mode === "connect") setMode("move"); else if (sel) select(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        if (sel.type === "node") removeNode(sel.id); else removeEdge(sel.id);
      }
    }
    document.addEventListener("keydown", onKey);

    render(); fit();
    if (M.nodes.n2 && !code) select({ type: "node", id: "n2" }); else panel();
    if (code) flash("Opened a shared map · edits are saved as your own copy");
    if (location.hostname === "localhost") window.__map = { get M() { return M; }, select: select, render: render, addEdge: addEdge, addNode: addNode, toggle: toggle, view: view };

    return function destroy() { document.removeEventListener("keydown", onKey); ro.disconnect(); };
  }

  return { mount: mount };
})();
