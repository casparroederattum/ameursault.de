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

  function openProject(p, card, withLine) {
    lastCard = card;
    document.getElementById("sheet-title").textContent = p.title;
    var body = document.getElementById("sheet-body");
    body.replaceChildren();
    if (withLine && p.line) body.appendChild(make("p", "lead", p.line));
    (p.more || []).forEach(function (s) { body.appendChild(make("p", null, s)); });
    // Pictures inside the overlay are only created (and downloaded) when it opens.
    (p.gallery || []).forEach(function (g) {
      var fig = make("figure", "shot");
      var box = make("div", "shot-box");  // scrolls sideways if the picture is wider than the sheet
      box.tabIndex = 0;
      box.setAttribute("role", "region");
      box.setAttribute("aria-label", g.alt);
      box.appendChild(picture(g, "eager"));
      fig.appendChild(box);
      function edge() { box.classList.toggle("more-right", box.scrollLeft + box.clientWidth < box.scrollWidth - 2); }
      box.addEventListener("scroll", edge, { passive: true });
      requestAnimationFrame(edge); // once the sheet is open and has a width
      if (g.caption) fig.appendChild(make("figcaption", null, g.caption));
      body.appendChild(fig);
    });
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

  function picture(im, loading) {
    var img = document.createElement("img");
    img.src = im.src;
    img.alt = im.alt || "";
    if (im.width) img.width = im.width;
    if (im.height) img.height = im.height;
    img.loading = loading;
    img.decoding = "async";
    return img;
  }

  function cardFor(p, i) {
    var li = make("li", "reveal");
    li.style.transitionDelay = (i % 2) * 80 + "ms"; // neighbours arrive one after another
    // <article> keeps the heading a real heading; the title button opens the overlay.
    var card = make("article", "card");
    if (p.image) {
      var cover = picture(p.image, "lazy");
      cover.className = "cover";
      card.appendChild(cover);
    }
    var h4 = make("h4");
    var open = make("button", null, p.title);
    open.type = "button";
    open.setAttribute("aria-haspopup", "dialog");
    open.addEventListener("click", function () { openProject(p, open); });
    h4.appendChild(open);
    card.appendChild(h4);
    if (p.topic) card.appendChild(make("span", "topic", p.topic));
    card.appendChild(make("p", null, p.line));
    card.appendChild(make("span", "more", "Read more"));
    li.appendChild(card);
    return li;
  }

  // Projects without a group: a small oval with just the name. It opens the same overlay,
  // which then starts with the one-line description, since the pill doesn't show it.
  function pillFor(p, i) {
    var li = make("li", "reveal");
    li.style.transitionDelay = i * 60 + "ms";
    var open = make("button", "pill", p.title);
    open.type = "button";
    open.title = p.line || "";
    open.setAttribute("aria-haspopup", "dialog");
    open.addEventListener("click", function () { openProject(p, open, true); });
    li.appendChild(open);
    return li;
  }

  if (dialog) {
    document.getElementById("sheet-close").addEventListener("click", function () { dialog.close(); });
    // The dialog box itself has no padding, so a click whose target is the <dialog> is the backdrop.
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () { if (lastCard) lastCard.focus(); });
  }

  fetch("projects.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (projects) {
      // Projects with a "group" are shown together under that name, groups in the order they
      // first appear in projects.json; projects without one come last, under "More projects".
      var box = document.getElementById("cards");
      var groups = [], byName = {};
      projects.forEach(function (p) {
        var name = p.group || "More projects";
        if (!byName[name]) { byName[name] = []; groups.push(name); }
        byName[name].push(p);
      });
      if (byName["More projects"]) { groups.splice(groups.indexOf("More projects"), 1); groups.push("More projects"); }
      groups.forEach(function (name) {
        box.appendChild(make("h3", "group reveal", name));
        var small = name === "More projects";
        var list = make("ul", small ? "pills" : "cards");
        byName[name].forEach(function (p, i) { list.appendChild(small ? pillFor(p, i) : cardFor(p, i)); });
        box.appendChild(list);
      });
      box.querySelectorAll(".reveal").forEach(reveal);
    })
    .catch(function () { /* the noscript-style fallback text is enough; nothing to break */ });

  // --- writing (posts.json is written by scripts/fetch_substack.py) ---
  fetch("posts.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (posts) {
      if (!Array.isArray(posts) || posts.length === 0) return; // keep "Learning it right now."
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
