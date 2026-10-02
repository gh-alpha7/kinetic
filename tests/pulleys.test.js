// Example test: the Atwood machine against a = (m2 - m1) g / (m1 + m2) and T = 2 m1 m2 g / (m1 + m2).
T.run(function () {
  var t = T.mount("pulleys");
  T.click(/^Release/);
  t.sim.pause();
  T.steps(t.sim, 60);
  var text = T.text(".readouts");
  T.ok("readouts render", text && text.length > 20, text && text.slice(0, 80));
  T.check("Atwood a (3 kg, 5 kg)", parseFloat(/ACCELERATION\s*([\d.]+)/i.exec(text.toUpperCase())[1]), 2.45, 0.01);
});
