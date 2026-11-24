// Papers and videos page: the list from finds.json, in the order listed there.
// Built with textContent, never innerHTML.
(function () {
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return /^https?:\/\//.test(u || "") ? u : null; }
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
  fetch("finds.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (finds) {
      if (!Array.isArray(finds) || finds.length === 0) return; // keep "First ones soon."
      var list = document.getElementById("finds-list");
      list.replaceChildren();
      function outLink(url, cls, text) {
        var a = make("a", cls, text);
        a.href = url;
        a.target = "_blank";  // the arrow promises a new tab
        a.rel = "noopener";
        return a;
      }
      finds.forEach(function (f) {
        var url = safeUrl(f.url);
        if (!url || !f.title) return;
        var li = make("li", "find-item");
        // The picture is a link too (hidden from screen readers and Tab, the title link is enough).
        if (f.image && f.image.src) {
          var pic = outLink(url, "find-pic");
          pic.tabIndex = -1;
          pic.setAttribute("aria-hidden", "true");
          pic.appendChild(picture(f.image, "lazy"));
          li.appendChild(pic);
        }
        var text = make("div", "find");
        text.appendChild(make("span", "kind", f.kind || ""));
        text.appendChild(outLink(url, "find-title", f.title + " ↗"));
        if (f.by) text.appendChild(make("span", "find-by", f.by));
        if (f.note) text.appendChild(make("p", "find-note", f.note));
        var extra = (f.links || []).filter(function (l) { return safeUrl(l.url) && l.label; });
        if (extra.length) {
          var more = make("span", "find-more");
          extra.forEach(function (l) { more.appendChild(outLink(l.url, null, l.label + " ↗")); });
          text.appendChild(more);
        }
        if (f.credit) text.appendChild(make("span", "find-credit", f.credit));
        li.appendChild(text);
        list.appendChild(li);
      });
    })
    .catch(function () { /* no finds file: the default text stays */ });
})();
