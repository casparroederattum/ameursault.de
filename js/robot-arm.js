// Robot arm: picks up my face, drops it in a bucket, I peek out. About 4 seconds.
// We only ever say where the gripper (the "wrist") should be; simple two-link
// inverse kinematics works out where the elbow goes. That keeps the timeline readable.
(function () {
  var svg = document.getElementById("arm-scene");
  if (!svg) return;

  var SHOULDER = { x: 90, y: 190 };
  var L1 = 140, L2 = 130;            // upper arm, forearm
  var OPEN = 56, SHUT = 47;          // half the gap between the fingers
  var HOLD = 50;                     // face centre sits this far below the wrist
  var FLOOR_FACE = { x: 195, y: 226 };
  var BUCKET_X = 330, PEEK_Y = 196;  // eyes just above the rim
  var END = 3.9;                     // seconds

  var P = {
    away:  { x: 70,  y: 30 },        // arm starts swung away
    above: { x: 195, y: 120 },
    pick:  { x: 195, y: 176 },
    lift:  { x: 275, y: -15 },       // control point of the arc
    drop:  { x: BUCKET_X, y: 104 },
    rest:  { x: 150, y: 66 }
  };

  var el = {};
  ["l1", "l1i", "l2", "l2i", "elbow", "grip", "fL", "fR", "face", "again"].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  // --- small maths helpers ---
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function part(t, a, b) { return clamp01((t - a) / (b - a)); }   // 0..1 progress inside [a, b]
  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function easeIn(p) { return p * p; }
  function easeOut(p) { return 1 - (1 - p) * (1 - p); }
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

  // The whole show as one function of time: where is everything at second t?
  function pose(t) {
    var wrist, grip = OPEN, face = { x: FLOOR_FACE.x, y: FLOOR_FACE.y }, tilt = 0;

    if (t < 0.8)       wrist = mixPt(P.away, P.above, easeInOut(part(t, 0, 0.8)));
    else if (t < 1.15) wrist = mixPt(P.above, P.pick, easeInOut(part(t, 0.8, 1.15)));
    else if (t < 1.4)  wrist = P.pick;
    else if (t < 2.4)  wrist = arc(P.pick, P.lift, P.drop, easeInOut(part(t, 1.4, 2.4)));
    else if (t < 2.55) wrist = P.drop;
    else               wrist = mixPt(P.drop, P.rest, easeInOut(part(t, 2.55, 3.4)));

    if (t >= 1.15) grip = mix(OPEN, SHUT, part(t, 1.15, 1.4)); // close on the face
    if (t >= 2.4)  grip = mix(SHUT, OPEN, part(t, 2.4, 2.55)); // let go over the bucket

    if (t >= 1.4 && t < 2.55) {             // carried
      face = { x: wrist.x, y: wrist.y + HOLD };
    } else if (t >= 2.55) {                 // fall, small bounce, then peek
      var top = P.drop.y + HOLD;
      var y = mix(top, 222, easeIn(part(t, 2.55, 2.9)));
      if (t >= 2.9)  y = mix(222, 206, easeOut(part(t, 2.9, 3.05)));
      if (t >= 3.05) y = mix(206, 216, easeIn(part(t, 3.05, 3.2)));
      if (t >= 3.35) {
        var p = part(t, 3.35, 3.85);
        y = mix(216, PEEK_Y, easeOut(p));
        tilt = Math.sin(p * Math.PI * 2) * 7 * (1 - p);   // a curious little wobble
      }
      face = { x: BUCKET_X, y: y };
    }
    return { wrist: wrist, grip: grip, face: face, tilt: tilt };
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
      "translate(" + s.face.x + " " + s.face.y + ") rotate(" + s.tilt + ")");
  }

  // --- playback ---
  var start = 0, frame = 0;
  function tick(now) {
    var t = (now - start) / 1000;
    draw(Math.min(t, END));
    frame = t < END ? requestAnimationFrame(tick) : 0;
  }
  function play() {
    cancelAnimationFrame(frame);
    draw(0);
    start = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function skip() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    draw(END);
  }

  // People who asked their system for less motion get the punchline without the motion.
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm) { draw(END); return; }

  el.again.hidden = false;
  el.again.addEventListener("click", function (ev) { ev.stopPropagation(); play(); });
  document.addEventListener("click", skip);            // click anywhere skips
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") skip(); });
  play();
})();
