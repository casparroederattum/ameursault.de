// Robot arm: picks up my face and drops it; it bounces, splits into cells (agar-style),
// the cells zoom off to the right, and the face grows back at its old spot. Plays once,
// under 8 seconds. After that the arm is yours: drag the orange joints, tap the gripper,
// and pick the face up and drop it again if you like.
// During the show we only say where the gripper (the "wrist") should be; simple two-link
// inverse kinematics works out where the elbow goes. That keeps the timeline readable.
(function () {
  var svg = document.getElementById("arm-scene");
  if (!svg) return;
  var stage = svg.closest(".stage");

  var SHOULDER = { x: 90, y: 190 };
  var L1 = 140, L2 = 130;            // upper arm, forearm
  var OPEN = 56, SHUT = 47, CLOSED = 12; // half the gap between the fingers
  var HOLD = 50;                     // face centre sits this far below the wrist
  var R = 44;                        // face radius
  var FLOOR = 270;                   // invisible floor: bottom edge of everything
  var HOME = { x: 195, y: FLOOR - R }; // where the face starts, and where it comes back
  var DROP_X = 330;                  // where the face lands
  var SETTLED = 3.7;                 // face has landed and stopped wobbling
  var SPLIT = 3.95;                  // the face becomes two cells
  var SPLIT2 = 4.35;                 // ...and then four
  var GONE = 6.0;                    // the last cell has left
  var BACK = 6.2;                    // the face starts to grow back at home
  var END = 7.7;                     // seconds

  var P = {
    away:  { x: 70,  y: 30 },        // arm starts swung away
    above: { x: HOME.x, y: 120 },
    pick:  { x: HOME.x, y: 176 },
    lift:  { x: 275, y: -15 },       // control point of the arc
    drop:  { x: DROP_X, y: 104 },
    rest:  { x: 150, y: 66 }
  };

  var el = {};
  ["l1", "l1i", "l2", "l2i", "elbow", "grip", "fL", "fR", "face", "c0", "c1", "c2", "c3",
   "h-shoulder", "h-elbow", "h-grip"].forEach(function (id) {
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
  function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }
  function deg(a) { return Math.round(a * 180 / Math.PI); }

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
    var wrist, grip = OPEN, face = { x: HOME.x, y: HOME.y }, tilt = 0, swell = 1, show = 1;

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
    } else if (t >= 2.55 && t < BACK) {     // fall, two bounces, settle
      var top = P.drop.y + HOLD, floor = HOME.y;
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
      if (t >= SPLIT) show = 0;
    } else if (t >= BACK) {                 // grows back at home, slowly, from the floor up
      var g = easeInOut(part(t, BACK, END));
      swell = mix(0.25, 1, g);
      show = g;
    }
    return { wrist: wrist, grip: grip, face: face, tilt: tilt, swell: swell, show: show };
  }

  // The cells after the split. Each splits in two halves of equal area (radius / √2),
  // the front half is shot forward, then everything drifts right, speeds up and fades.
  function cellsAt(t) {
    if (t < SPLIT || t >= GONE) return [];
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
      var s = part(t, SPLIT2 + 0.35 + i * 0.08, GONE - 0.1);
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

  function drawArm(e, w, grip) {
    setLine(el.l1, SHOULDER, e); setLine(el.l1i, SHOULDER, e);
    setLine(el.l2, e, w);        setLine(el.l2i, e, w);
    el.elbow.setAttribute("cx", e.x); el.elbow.setAttribute("cy", e.y);
    el["h-shoulder"].setAttribute("cx", e.x); el["h-shoulder"].setAttribute("cy", e.y);
    el.grip.setAttribute("transform", "translate(" + w.x + " " + w.y + ")");
    el.fL.setAttribute("transform", "translate(" + -grip + " 0)");
    el.fR.setAttribute("transform", "translate(" + grip + " 0)");
  }

  function draw(t) {
    var s = pose(t);
    drawArm(elbowFor(s.wrist), s.wrist, s.grip);
    el.face.setAttribute("transform",
      "translate(" + s.face.x + " " + (s.face.y + R * (1 - s.swell)) + ") rotate(" + s.tilt + ") scale(" + s.swell + ")");
    el.face.setAttribute("opacity", s.show);

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

  // People who asked their system for less motion get no show and no animated gripper.
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- the arm is yours: three degrees of freedom ---
  // a1: shoulder angle (absolute), a2: elbow angle (relative to the upper arm), grip: finger gap.
  var live = false, a1 = 0, a2 = 0, grip = OPEN, gripTo = OPEN, gripFrame = 0;
  // The face, once the arm is yours: lying somewhere on the floor, held, or falling.
  // While held it keeps its offset (dx, dy) from the wrist.
  var face = { x: HOME.x, y: HOME.y, held: false, dx: 0, dy: 0, vy: 0, fallFrame: 0 };

  function joints(n1, n2) {
    var e = { x: SHOULDER.x + L1 * Math.cos(n1), y: SHOULDER.y + L1 * Math.sin(n1) };
    var w = { x: e.x + L2 * Math.cos(n1 + n2), y: e.y + L2 * Math.sin(n1 + n2) };
    return { e: e, w: w };
  }
  // Keep the arm above the floor (fingers included), out of the text above, and not folded onto itself.
  // A held face has to stay above the floor and inside the picture as well.
  function allowed(j, n2) {
    var ok = Math.abs(n2) <= 2.6 && j.e.y <= FLOOR - 16 && j.w.y <= FLOOR - 60 && j.w.y >= -12 && j.e.y >= -12;
    if (ok && face.held) {
      var fx = j.w.x + face.dx, fy = j.w.y + face.dy;
      ok = fy <= HOME.y && fx >= R && fx <= 420 - R;
    }
    return ok;
  }
  function setAngles(n1, n2) {
    n1 = wrapAngle(n1); n2 = wrapAngle(n2);
    var j = joints(n1, n2);
    if (!allowed(j, n2)) return;
    a1 = n1; a2 = n2;
    drawLive();
  }
  function drawLive() {
    var j = joints(a1, a2);
    drawArm(j.e, j.w, grip);
    if (face.held) { face.x = j.w.x + face.dx; face.y = j.w.y + face.dy; }
    el.face.setAttribute("transform", "translate(" + face.x + " " + face.y + ")");
    el.face.setAttribute("opacity", 1);
    el["h-shoulder"].setAttribute("aria-valuenow", deg(-a1));
    el["h-elbow"].setAttribute("aria-valuenow", deg(-a2));
  }
  function setGrip(open) {
    if (open) {
      gripTo = OPEN;
      if (face.held) { face.held = false; fall(); }   // let go: it drops
    } else {
      // Close on the face if it hangs between the fingers, else close all the way.
      var w = joints(a1, a2).w, dx = face.x - w.x, dy = face.y - w.y;
      if (!face.fallFrame && Math.abs(dx) < 26 && dy > 18 && dy < 80) {
        face.held = true; face.dx = dx; face.dy = dy;
        gripTo = SHUT;
      } else {
        gripTo = CLOSED;
      }
    }
    el["h-grip"].setAttribute("aria-checked", open ? "true" : "false");
    el["h-grip"].setAttribute("aria-label", open ? "Gripper open" : "Gripper closed");
    if (calm) { grip = gripTo; drawLive(); return; }
    if (!gripFrame) gripFrame = requestAnimationFrame(stepGrip);
  }
  function stepGrip() {
    grip += (gripTo - grip) * 0.22;
    if (face.held) {
      // The closing fingers pull the face to the middle, hanging just below the palm.
      var w = joints(a1, a2).w;
      face.dx *= 0.78;
      face.dy += (Math.min(HOLD, HOME.y - w.y) - face.dy) * 0.22;
    }
    if (Math.abs(gripTo - grip) < 0.3) { grip = gripTo; gripFrame = 0; }
    else gripFrame = requestAnimationFrame(stepGrip);
    drawLive();
  }

  // A dropped face falls, bounces twice or so and lies still. Units: drawing pixels and seconds.
  function fall() {
    face.vy = 0;
    if (calm) { face.y = HOME.y; drawLive(); return; }
    var last = 0;
    function step(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      face.vy += 1600 * dt;
      face.y += face.vy * dt;
      if (face.y >= HOME.y) {
        face.y = HOME.y;
        face.vy = -face.vy * 0.4;
        if (Math.abs(face.vy) < 70) { face.vy = 0; face.fallFrame = 0; drawLive(); return; }
      }
      drawLive();
      face.fallFrame = requestAnimationFrame(step);
    }
    cancelAnimationFrame(face.fallFrame);
    face.fallFrame = requestAnimationFrame(step);
  }

  function goLive() {
    if (live) return;
    live = true;
    var e = elbowFor(P.rest);
    a1 = Math.atan2(e.y - SHOULDER.y, e.x - SHOULDER.x);
    a2 = wrapAngle(Math.atan2(P.rest.y - e.y, P.rest.x - e.x) - a1);
    grip = gripTo = OPEN;
    drawLive();
    ["h-shoulder", "h-elbow", "h-grip"].forEach(function (id) { el[id].setAttribute("tabindex", "0"); });
    if (stage) stage.classList.add("live");
  }

  // Pointer position in the drawing's own coordinates.
  function svgPoint(ev) {
    var m = svg.getScreenCTM().inverse();
    return { x: m.a * ev.clientX + m.c * ev.clientY + m.e, y: m.b * ev.clientX + m.d * ev.clientY + m.f };
  }

  var drag = null; // { which, id, from, moved }
  function down(which) {
    return function (ev) {
      if (ev.button > 0) return;
      ev.preventDefault();
      skip(); goLive();
      drag = { which: which, id: ev.pointerId, from: svgPoint(ev), moved: false };
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (err) { /* old browsers */ }
    };
  }
  function move(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var p = svgPoint(ev);
    if (Math.hypot(p.x - drag.from.x, p.y - drag.from.y) > 3) drag.moved = true;
    if (drag.which === "shoulder") {
      setAngles(Math.atan2(p.y - SHOULDER.y, p.x - SHOULDER.x), a2);
    } else if (drag.which === "elbow") {
      var e = joints(a1, a2).e;
      setAngles(a1, Math.atan2(p.y - e.y, p.x - e.x) - a1);
    }
  }
  function up(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    if (drag.which === "grip" && !drag.moved) setGrip(gripTo !== OPEN);
    drag = null;
  }
  [["h-shoulder", "shoulder"], ["h-elbow", "elbow"], ["h-grip", "grip"]].forEach(function (h) {
    var node = el[h[0]];
    node.addEventListener("pointerdown", down(h[1]));
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });

  // Keyboard: arrows turn the focused joint by 5°, Enter or Space opens/closes the gripper.
  var STEP = 5 * Math.PI / 180;
  function keys(which) {
    return function (ev) {
      var k = ev.key, d = 0;
      if (which === "grip") {
        if (k !== "Enter" && k !== " ") return;
        ev.preventDefault(); setGrip(gripTo !== OPEN); return;
      }
      if (k === "ArrowUp" || k === "ArrowRight") d = -STEP;      // up = counter-clockwise on screen
      else if (k === "ArrowDown" || k === "ArrowLeft") d = STEP;
      else return;
      ev.preventDefault();
      if (which === "shoulder") setAngles(a1 + d, a2); else setAngles(a1, a2 + d);
    };
  }
  el["h-shoulder"].addEventListener("keydown", keys("shoulder"));
  el["h-elbow"].addEventListener("keydown", keys("elbow"));
  el["h-grip"].addEventListener("keydown", keys("grip"));

  // --- the show ---
  // Our own clock: it only moves while frames are actually drawn, and never jumps more
  // than 1/20 s per frame. So if the page loads in a background tab (a link opened from
  // a chat app, say), the show waits instead of being over before anyone looks.
  var t = 0, last = 0, frame = 0, started = false, finished = false;
  function tick(now) {
    if (last) t += Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(Math.min(t, END));
    if (t < END) frame = requestAnimationFrame(tick);
    else { frame = 0; finished = true; goLive(); }
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
    goLive();
  }

  if (calm) { finished = true; draw(END); goLive(); return; }

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
