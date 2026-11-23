// Robot arm: picks up my face and drops it; it bounces, splits into cells (agar-style)
// and the cells zoom off to the right. Plays once, about 6 seconds.
// We only ever say where the gripper (the "wrist") should be; simple two-link
// inverse kinematics works out where the elbow goes. That keeps the timeline readable.
(function () {
  var svg = document.getElementById("arm-scene");
  if (!svg) return;

  var SHOULDER = { x: 90, y: 190 };
  var L1 = 140, L2 = 130;            // upper arm, forearm
  var OPEN = 56, SHUT = 47;          // half the gap between the fingers
  var HOLD = 50;                     // face centre sits this far below the wrist
  var R = 44;                        // face radius
  var FLOOR = 270;                   // invisible floor: bottom edge of everything
  var FLOOR_FACE = { x: 195, y: FLOOR - R };
  var DROP_X = 330;                  // where the face lands
  var SETTLED = 3.7;                 // face has landed and stopped wobbling
  var SPLIT = 3.95;                  // the face becomes two cells
  var SPLIT2 = 4.35;                 // ...and then four
  var END = 6.0;                     // seconds

  var P = {
    away:  { x: 70,  y: 30 },        // arm starts swung away
    above: { x: 195, y: 120 },
    pick:  { x: 195, y: 176 },
    lift:  { x: 275, y: -15 },       // control point of the arc
    drop:  { x: DROP_X, y: 104 },
    rest:  { x: 150, y: 66 }
  };

  var el = {};
  ["l1", "l1i", "l2", "l2i", "elbow", "grip", "fL", "fR", "face", "c0", "c1", "c2", "c3"].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
  var cellEls = [el.c0, el.c1, el.c2, el.c3];

  // --- small maths helpers ---
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function part(t, a, b) { return clamp01((t - a) / (b - a)); }   // 0..1 progress inside [a, b]
  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function easeIn(p) { return p * p * p; }
  function easeOut(p) { return 1 - (1 - p) * (1 - p) * (1 - p); }
  function mix(a, b, p) { return a + (b - a) * p; }
  function mixPt(a, b, p) { return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) }; }
  function arc(a, c, b, p) { // quadratic Bézier: a smooth lift through c
    return mixPt(mixPt(a, c, p), mixPt(c, b, p), p);
  }

  // Elbow position for a wrist target ("elbow up", like a real desk arm).
  function elbowFor(w) {
    var dx = w.x - SHOULDER.x, dy = w.y - SHOULDER.y;
    var d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
    var a = Math.atan2(dy, dx);
    var b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    return { x: SHOULDER.x + L1 * Math.cos(a - b), y: SHOULDER.y + L1 * Math.sin(a - b) };
  }

  // Arm and whole face at second t.
  function pose(t) {
    var wrist, grip = OPEN, face = { x: FLOOR_FACE.x, y: FLOOR_FACE.y }, tilt = 0, swell = 1;

    if (t < 0.8)       wrist = mixPt(P.away, P.above, easeInOut(part(t, 0, 0.8)));
    else if (t < 1.15) wrist = mixPt(P.above, P.pick, easeInOut(part(t, 0.8, 1.15)));
    else if (t < 1.4)  wrist = P.pick;
    else if (t < 2.4)  wrist = arc(P.pick, P.lift, P.drop, easeInOut(part(t, 1.4, 2.4)));
    else if (t < 2.55) wrist = P.drop;
    else               wrist = mixPt(P.drop, P.rest, easeInOut(part(t, 2.55, 3.4)));

    if (t >= 1.15) grip = mix(OPEN, SHUT, part(t, 1.15, 1.4)); // close on the face
    if (t >= 2.4)  grip = mix(SHUT, OPEN, part(t, 2.4, 2.55)); // let go

    if (t >= 1.4 && t < 2.55) {             // carried
      face = { x: wrist.x, y: wrist.y + HOLD };
    } else if (t >= 2.55) {                 // fall, two bounces, settle
      var top = P.drop.y + HOLD, floor = FLOOR_FACE.y;
      var y = mix(top, floor, part(t, 2.55, 2.9) * part(t, 2.55, 2.9));
      if (t >= 2.9)  y = mix(floor, floor - 26, easeOut(part(t, 2.9, 3.05)));
      if (t >= 3.05) y = mix(floor - 26, floor, part(t, 3.05, 3.2) * part(t, 3.05, 3.2));
      if (t >= 3.2)  y = mix(floor, floor - 8, easeOut(part(t, 3.2, 3.28)));
      if (t >= 3.28) y = mix(floor - 8, floor, part(t, 3.28, 3.36));
      if (t >= 3.36) {
        var p = part(t, 3.36, SETTLED);
        tilt = Math.sin(p * Math.PI * 2) * 6 * (1 - p);   // a small wobble as it settles
      }
      // Just before splitting it swells a little, like a cell gathering itself.
      swell = 1 + 0.08 * Math.sin(Math.PI * part(t, SETTLED, SPLIT));
      face = { x: DROP_X, y: y };
    }
    return { wrist: wrist, grip: grip, face: face, tilt: tilt, swell: swell };
  }

  // The cells after the split. Each splits in two halves of equal area (radius / √2),
  // the front half is shot forward, then everything drifts right, speeds up and fades.
  function cellsAt(t) {
    if (t < SPLIT) return [];
    var R1 = R / Math.SQRT2, R2 = R / 2;
    var p = part(t, SPLIT, SPLIT2), e = easeOut(p);
    var kick = 0.2 * (1 - p);                    // squash-and-stretch right after a split

    var a = { x: DROP_X - 12 - 8 * e, y: FLOOR - R1, r: R1, sx: 1, sy: 1 };
    var b = { x: DROP_X + 12 + 84 * e, y: FLOOR - R1, r: R1, sx: 1 + kick, sy: 1 - kick };
    if (t < SPLIT2) return [a, b];

    var q = part(t, SPLIT2, SPLIT2 + 0.35), f = easeOut(q), kick2 = 0.2 * (1 - q);
    var cells = [
      { x: a.x - 8 * f,      y: FLOOR - R2,            r: R2, sx: 1, sy: 1 },
      { x: a.x + 8 + 56 * f, y: FLOOR - R2 - 22 * f,   r: R2, sx: 1 + kick2, sy: 1 - kick2 },
      { x: b.x - 6 * f,      y: FLOOR - R2,            r: R2, sx: 1, sy: 1 },
      { x: b.x + 8 + 56 * f, y: FLOOR - R2 - 38 * f,   r: R2, sx: 1 + kick2, sy: 1 - kick2 }
    ];
    // Off to the right, one after another; stretched by the speed, fading at the end.
    cells.forEach(function (c, i) {
      var s = part(t, SPLIT2 + 0.35 + i * 0.08, END - 0.1);
      c.x += 620 * easeIn(s);
      c.sx *= 1 + 0.25 * s;
      c.sy *= 1 - 0.1 * s;
      c.o = 1 - part(s, 0.5, 1);
    });
    return cells;
  }

  function setLine(line, a, b) {
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
  }

  function draw(t) {
    var s = pose(t), e = elbowFor(s.wrist);
    setLine(el.l1, SHOULDER, e); setLine(el.l1i, SHOULDER, e);
    setLine(el.l2, e, s.wrist);  setLine(el.l2i, e, s.wrist);
    el.elbow.setAttribute("cx", e.x); el.elbow.setAttribute("cy", e.y);
    el.grip.setAttribute("transform", "translate(" + s.wrist.x + " " + s.wrist.y + ")");
    el.fL.setAttribute("transform", "translate(" + -s.grip + " 0)");
    el.fR.setAttribute("transform", "translate(" + s.grip + " 0)");
    el.face.setAttribute("transform",
      "translate(" + s.face.x + " " + (s.face.y + R * (1 - s.swell)) + ") rotate(" + s.tilt + ") scale(" + s.swell + ")");
    el.face.setAttribute("opacity", t < SPLIT ? 1 : 0);

    var cells = cellsAt(t);
    cellEls.forEach(function (node, i) {
      var c = cells[i];
      if (!c) { node.setAttribute("opacity", 0); return; }
      var k = c.r / R;
      node.setAttribute("transform",
        "translate(" + c.x + " " + c.y + ") scale(" + k * c.sx + " " + k * c.sy + ")");
      node.setAttribute("opacity", c.o == null ? 1 : c.o);
    });
  }

  // --- playback ---
  // Our own clock: it only moves while frames are actually drawn, and never jumps more
  // than 1/20 s per frame. So if the page loads in a background tab (a link opened from
  // a chat app, say), the show waits instead of being over before anyone looks.
  var t = 0, last = 0, frame = 0, started = false, finished = false;
  function tick(now) {
    if (last) t += Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(Math.min(t, END));
    if (t < END) frame = requestAnimationFrame(tick);
    else { frame = 0; finished = true; }
  }
  function play() {
    if (started || finished) return;
    started = true;
    frame = requestAnimationFrame(tick);
  }
  function skip() {
    if (finished) return;
    cancelAnimationFrame(frame);
    frame = 0; finished = true;
    draw(END);
  }

  // People who asked their system for less motion see the portrait resting, no motion.
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm) { draw(SETTLED); return; }

  draw(0); // start pose: portrait on the floor, arm swung away

  // Wait for the photo (so the arm never grabs an empty circle), at most 2 seconds.
  var photoReady = new Promise(function (done) {
    var img = new Image();
    img.onload = img.onerror = done;
    img.src = "img/face.webp";
    setTimeout(done, 2000);
  });

  // Start only once the scene is actually on screen (half of it at least).
  function startWhenSeen() {
    if (!("IntersectionObserver" in window)) { play(); return; }
    var seen = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { seen.disconnect(); play(); }
    }, { threshold: 0.5 });
    seen.observe(svg);
  }
  photoReady.then(startWhenSeen);

  // Plays once per visit. Click anywhere (or Esc) jumps to the end.
  document.addEventListener("click", skip);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") skip(); });
})();
