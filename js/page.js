// Page behaviour: which seat is lit, project cards + overlay, Substack posts, fade-in.
// Everything is built with textContent (never innerHTML), so text from the feed can't inject code.
(function () {
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tiny helper: make an element with a class and some text.
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return /^https?:\/\//.test(u || "") ? u : null; }

  // --- fade-in on scroll ---
  var revealer = ("IntersectionObserver" in window && !calm)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" })
    : null;
  function reveal(node) {
    if (revealer) revealer.observe(node); else node.classList.add("in");
  }
  document.querySelectorAll(".reveal").forEach(reveal);

  // --- light up the seat of the section in the middle of the screen ---
  var sections = Array.prototype.slice.call(document.querySelectorAll(".sec"));
  var inMiddle = new Set();
  function lightSeat() {
    // The footer is short and never reaches the middle of the screen,
    // so at the very bottom of the page the last seat (the stern) wins.
    var atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    sections.forEach(function (s, i) {
      var here = atBottom ? i === sections.length - 1 : inMiddle.has(s);
      s.classList.toggle("is-here", here);
    });
  }
  if ("IntersectionObserver" in window) {
    var seats = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) inMiddle.add(e.target); else inMiddle.delete(e.target);
      });
      lightSeat();
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { seats.observe(s); });
    window.addEventListener("scroll", lightSeat, { passive: true });
  }

  // --- projects ---
  var dialog = document.getElementById("project-dialog");
  var lastCard = null;

  function openProject(p, card) {
    lastCard = card;
    document.getElementById("sheet-title").textContent = p.title;
    fillTags(document.getElementById("sheet-tags"), p.tags);
    var body = document.getElementById("sheet-body");
    body.replaceChildren();
    (p.more || []).forEach(function (s) { body.appendChild(make("p", null, s)); });
    var links = document.getElementById("sheet-links");
    links.replaceChildren();
    (p.links || []).forEach(function (l) {
      var url = safeUrl(l.url);
      if (!url) return;
      var a = make("a", null, l.label + " ↗");
      a.href = url;
      a.target = "_blank";  // the arrow promises a new tab
      a.rel = "noopener";
      links.appendChild(a);
    });
    dialog.showModal();
  }

  function fillTags(ul, tags) {
    ul.replaceChildren();
    (tags || []).forEach(function (t) { ul.appendChild(make("li", null, t)); });
  }

  if (dialog) {
    document.getElementById("sheet-close").addEventListener("click", function () { dialog.close(); });
    // The dialog box itself has no padding, so a click whose target is the <dialog> is the backdrop.
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () { if (lastCard) lastCard.focus(); });
  }

  fetch("projects.json")
    .then(function (r) { return r.json(); })
    .then(function (projects) {
      var list = document.getElementById("cards");
      projects.forEach(function (p, i) {
        var li = make("li", "reveal");
        li.style.transitionDelay = (i % 2) * 80 + "ms"; // neighbours arrive one after another
        // <article> keeps the heading a real heading; the title button opens the overlay.
        var card = make("article", "card");
        var h3 = make("h3");
        var open = make("button", null, p.title);
        open.type = "button";
        open.setAttribute("aria-haspopup", "dialog");
        open.addEventListener("click", function () { openProject(p, open); });
        h3.appendChild(open);
        card.appendChild(h3);
        card.appendChild(make("p", null, p.line));
        var tags = make("ul", "tags");
        fillTags(tags, p.tags);
        card.appendChild(tags);
        card.appendChild(make("span", "more", "Read more +"));
        li.appendChild(card);
        list.appendChild(li);
        reveal(li);
      });
    })
    .catch(function () { /* the noscript-style fallback text is enough; nothing to break */ });

  // --- writing (posts.json is written by scripts/fetch_substack.py) ---
  fetch("posts.json")
    .then(function (r) { return r.json(); })
    .then(function (posts) {
      if (!Array.isArray(posts) || posts.length === 0) return; // keep "Writing soon."
      var list = document.getElementById("posts");
      list.replaceChildren();
      posts.slice(0, 5).forEach(function (post) {
        var url = safeUrl(post.link);
        if (!url) return;
        var li = make("li");
        var a = make("a");
        a.href = url;
        var date = new Date(post.date);
        var time = make("time", null, isNaN(date) ? "" :
          date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
        if (!isNaN(date)) time.dateTime = post.date;
        a.appendChild(time);
        a.appendChild(make("span", null, post.title));
        li.appendChild(a);
        list.appendChild(li);
      });
      document.getElementById("substack-cta").textContent = "Subscribe on Substack";
    })
    .catch(function () { /* no posts file: the default text stays */ });
})();
