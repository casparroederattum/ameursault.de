// The pixels top right run Rule 30, a one-dimensional cellular automaton.
// Every beat a new row is born at the bottom from the row above it:
// a cell is on when  left XOR (self OR right)  was true in the row above.
// Black cells are on; orange ones have just switched on (they were off one row earlier).
(function () {
  var svg = document.querySelector(".pixels");
  if (!svg) return;

  var COLS = 10, ROWS = 6, WIDTH = 64;      // we show 10 cells of a 64-cell ring
  var FIRST = Math.floor(WIDTH / 2) - 5;     // left edge of the window, centred on the seed
  var BEAT = 650;                            // ms per new row
  var NS = "http://www.w3.org/2000/svg";

  // Rule 30 on a ring: a single cell in the middle to start with.
  function next(row) {
    var out = new Array(WIDTH);
    for (var i = 0; i < WIDTH; i++) {
      var l = row[(i - 1 + WIDTH) % WIDTH], c = row[i], r = row[(i + 1) % WIDTH];
      out[i] = l ^ (c | r);
    }
    return out;
  }
  var row = new Array(WIDTH).fill(0);
  row[Math.floor(WIDTH / 2)] = 1;
  var rows = [row];
  // Run ahead a little so the window is already full of pattern when the page opens.
  for (var g = 0; g < 18 + ROWS; g++) rows.push(next(rows[rows.length - 1]));
  rows = rows.slice(-(ROWS + 1)); // one extra row above, to know what "just switched on" means

  // Build the 60 squares once (this replaces the static fallback squares).
  svg.replaceChildren();
  var cells = [];
  for (var y = 0; y < ROWS; y++) {
    for (var x = 0; x < COLS; x++) {
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x * 10 + 0.6); r.setAttribute("y", y * 10 + 0.6);
      r.setAttribute("width", 8.8); r.setAttribute("height", 8.8);
      svg.appendChild(r);
      cells.push(r);
    }
  }

  function paint() {
    for (var y = 0; y < ROWS; y++) {
      var above = rows[y], here = rows[y + 1];
      for (var x = 0; x < COLS; x++) {
        var i = FIRST + x;
        var state = !here[i] ? "off" : above[i] ? "on" : "new";
        cells[y * COLS + x].setAttribute("class", state);
      }
    }
  }
  paint();

  // People who asked for less motion get one still frame of the pattern.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Only tick while the pixels are on screen and the tab is visible.
  var seen = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; }).observe(svg);
  }
  setInterval(function () {
    if (!seen || document.hidden) return;
    rows.push(next(rows[rows.length - 1]));
    rows.shift();
    paint();
  }, BEAT);
})();
