// Reading list: builds one entry per book from books.json (newest first, as listed there).
// Built with textContent, never innerHTML.
(function () {
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  fetch("books.json")
    .then(function (r) { return r.json(); })
    .then(function (books) {
      if (!Array.isArray(books) || books.length === 0) return; // keep "First books soon."
      var box = document.getElementById("books");
      box.replaceChildren();
      books.forEach(function (b) {
        var art = make("article", "book");
        art.appendChild(make("h2", null, b.title));
        var by = make("p", "by");
        if (b.author) by.appendChild(make("span", null, b.author));
        if (b.read) by.appendChild(make("span", null, "Read " + b.read));
        art.appendChild(by);
        art.appendChild(make("p", "review", b.review));
        box.appendChild(art);
      });
    })
    .catch(function () { /* no books file: the default text stays */ });
})();
