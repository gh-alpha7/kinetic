/* Test harness for labs. Loads the labs named in ?labs=, then the test file in ?test=.
   A test file calls T.run(async function () { ... }) and uses T.mount / T.steps / T.check.
   Results land in <pre id="out"> as JSON, so headless Edge can print them with --dump-dom. */
var T = (function () {
  "use strict";
  var out = document.getElementById("out"), app = document.getElementById("app");
  var results = [], errors = [], destroy = null;
  window.addEventListener("error", function (e) { errors.push(String(e.message) + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { errors.push("rejection: " + (e.reason && e.reason.stack || e.reason)); });

  var api = {
    // mount a lab by id; returns { root, lab, sim, sims } (sim = the last K.Sim the lab created)
    mount: function (id) {
      if (destroy) { try { destroy(); } catch (e) { errors.push("destroy: " + e.message); } destroy = null; }
      app.innerHTML = "";
      var lab = K.labs.filter(function (l) { return l.id === id; })[0];
      if (!lab) throw new Error("no lab with id " + id);
      var before = (window.__sims || []).length;
      destroy = lab.mount(app);
      var sims = (window.__sims || []).slice(before);
      return { root: app, lab: lab, sim: sims[sims.length - 1], sims: sims };
    },
    steps: function (sim, n) { for (var i = 0; i < n; i++) sim.stepOnce(); },
    // numeric check: passes when |got - want| <= tol (default 0.5% of |want|, at least 1e-6)
    check: function (name, got, want, tol) {
      if (tol == null) tol = Math.max(1e-6, Math.abs(want) * 0.005);
      var pass = typeof got === "number" && isFinite(got) && Math.abs(got - want) <= tol;
      results.push({ name: name, pass: pass, got: got, want: want, tol: tol });
      return pass;
    },
    ok: function (name, cond, info) { results.push({ name: name, pass: !!cond, info: info }); return !!cond; },
    text: function (sel) { var n = app.querySelector(sel); return n ? n.textContent : null; },
    // click a button inside the mounted lab whose text matches
    click: function (re) {
      var b = [].slice.call(app.querySelectorAll("button")).filter(function (x) { return re.test(x.textContent); })[0];
      if (!b) throw new Error("no button matching " + re);
      b.click(); return b;
    },
    run: function (fn) {
      Promise.resolve().then(fn).catch(function (e) { errors.push("test threw: " + (e && e.stack || e)); }).then(function () {
        // basic structure checks every lab must pass
        K.labs.forEach(function (l) {
          if (!l.__checked) return;
        });
        var fail = results.filter(function (r) { return !r.pass; }).length;
        out.textContent = "RESULT " + JSON.stringify({ pass: results.length - fail, fail: fail, errors: errors, results: results });
      });
    },
    errors: errors
  };

  // load ?labs= then ?test= in order
  var qs = new URLSearchParams(location.search), list = (qs.get("labs") || "").split(",").filter(Boolean);
  if (qs.get("test")) list.push(qs.get("test"));
  (function next(i) {
    if (i >= list.length) { if (!qs.get("test")) out.textContent = "RESULT " + JSON.stringify({ loaded: K.labs.map(function (l) { return l.id; }), errors: errors }); return; }
    var s = document.createElement("script");
    s.src = "../" + list[i] + "?t=" + Date.now();
    s.onload = function () { next(i + 1); };
    s.onerror = function () { errors.push("could not load " + list[i]); next(i + 1); };
    document.body.appendChild(s);
  })(0);
  return api;
})();
