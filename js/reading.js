// Reading list: two columns of books from books.json, in the order they are listed there.
// "status": "reading" puts a book under "Reading now", everything else goes under "Read".
// A review shows only when there is one. Built with textContent, never innerHTML.
(function () {
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function bookCard(b) {
    var li = make("li", "book");
    // Covers keep their own shape and stand on a common baseline, like books on a shelf.
    var box = make("div", "cover-box");
    if (b.cover) {
      var img = document.createElement("img");
      img.src = b.cover;
      img.alt = "Cover of " + b.title;
      img.loading = "lazy"; img.decoding = "async";
      box.appendChild(img);
    }
    li.appendChild(box);
    li.appendChild(make("h3", null, b.title));
    li.appendChild(make("p", "by", b.author));
    if (b.review) li.appendChild(make("p", "review", b.review));
    return li;
  }

  fetch("books.json")
    .then(function (r) { return r.json(); })
    .then(function (books) {
      if (!Array.isArray(books) || books.length === 0) return; // keep "First books soon."
      var box = document.getElementById("books");
      box.replaceChildren();
      [["reading", "Reading now"], ["read", "Read"]].forEach(function (g) {
        var some = books.filter(function (b) { return (b.status === "reading") === (g[0] === "reading"); });
        if (!some.length) return;
        box.appendChild(make("h2", "group", g[1]));
        var ul = make("ul", "shelf");
        some.forEach(function (b) { ul.appendChild(bookCard(b)); });
        box.appendChild(ul);
      });
    })
    .catch(function () { /* no books file: the default text stays */ });
})();
