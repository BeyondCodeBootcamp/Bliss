var Post = {};

// TODO sync version using String.fromCharCode()?
Post._getRandomValues = function (arr) {
  var len = arr.byteLength || arr.length;
  var i;
  for (i = 0; i < len; i += 1) {
    arr[i] = Math.round(Math.random() * 255);
  }
  return arr;
};

Post._uuid = function () {
  var rnd = new Uint8Array(18);
  Post._getRandomValues(rnd);
  var hex = [].slice
    .apply(rnd)
    .map(function (ch) {
      return ch.toString(16);
    })
    .join("")
    .split("");
  hex[8] = "-";
  hex[13] = "-";
  hex[14] = "4";
  hex[18] = "-";
  hex[19] = (8 + (parseInt(hex[19], 16) % 4)).toString(16);
  hex[23] = "-";
  return hex.join("");
};

Post._toSlug = function (str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/g, "")
    .replace(/-$/g, "")
    .trim();
};

Post._toLocalDatetime = function (d = new Date()) {
  d = new Date(d);
  return (
    [
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-") +
    "T" +
    [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
    ].join(":")
  );
};

Post._preview = function (_post) {
  _post._slug = Post._toSlug(_post.title);
  _post._filename = _post._slug + ".md";
  _post._frontMatter = [
    "---",
    "title: " + _post.title,
    "date: " + _post.created,
    "updated: " + _post.created,
    "uuid:" + _post.uuid,
    "categories: []",
    "permalink: /articles/" + _post._slug,
    "---",
  ].join("\n");

  var filestr = _post._frontMatter + "\n\n" + _post.content;
  if (_post._filename && _post.content) {
    $(".js-preview-container").hidden = false;
    $(".js-filename").innerText = _post._filename;
    $(".js-preview").innerText = filestr;
  } else {
    $(".js-preview-container").hidden = true;
  }
};

Post.restore = function (uuid) {
  var _post = {};

  _post.uuid = uuid || Post._uuid();
  _post.title = localStorage.getItem(_post.uuid + ".title") || "";
  _post.created =
    localStorage.getItem(_post.uuid + ".created") ||
    Post._toLocalDatetime(new Date());
  _post.updated =
    localStorage.getItem(_post.uuid + ".updated") || _post.created;
  _post.content = localStorage.getItem(_post.uuid + ".content") || "";

  return _post;
};

Post._all = function () {
  return (localStorage.getItem("all") || "")
    .split(/[\s,;:|]+/g)
    .filter(Boolean);
};

Post._store = function (_post) {
  // TODO debounce with max time
  _post.title = $('input[name="title"]').value;
  _post.created = $('input[name="created"]').value;
  _post.content = $('textarea[name="content"]').value;

  var sep = " ";
  var all = Post._all();
  if (!all.includes(_post.uuid)) {
    all.push(_post.uuid);
    localStorage.setItem("all", all.join(sep).trim());
  }
  localStorage.setItem(_post.uuid + ".title", _post.title);
  localStorage.setItem(_post.uuid + ".created", _post.created);
  localStorage.setItem(_post.uuid + ".updated", _post.updated);
  localStorage.setItem(_post.uuid + ".content", _post.content);
};

Post.save = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  Post._update();
};

Post.load = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  console.log(ev);

  var parent = ev.target.closest(".js-row");
  var uuid = $('input[name="uuid"]', parent).value;
  Post._load(uuid);
};

Post._load = function (uuid) {
  Post._current = Post.restore(uuid);
  var _post = Post._current;
  $('input[name="title"]').value = _post.title;
  $('input[name="created"]').value = Post._toLocalDatetime(_post.created);
  $('textarea[name="content"]').value = _post.content;

  Post._preview(_post);
};

(async function () {
  "use strict";

  Post._update = function () {
    /*
     * Example:
      ---
      description: "Change ME to a good search engine-friendly description"
      ogimage: 'https://...'
      player: 'https://www.youtube.com/embed/XXXXXXXX?rel=0'
      youtube: XXXXXXXX
      categories:
        - Videography
      permalink: /articles/CHANGE-ME-SLUG/
      ---
     */

    Post._store(Post._current);
    localStorage.setItem("current", Post._current.uuid);
    Post._preview(Post._current);
  };

  Post.list = function () {
    var items = Post._all().map(function (uuid) {
      console.log("yo yo yo", uuid);
      var _post = Post.restore(uuid);
      var tmpl = listTmpl
        .replace(/ hidden/g, "")
        .replace(
          "{{title}}",
          _post.title.slice(0, 50).replace(/</g, "&lt;") || "<i>Untitled</i>"
        )
        .replace("{{uuid}}", _post.uuid)
        .replace("{{created}}", _post.created)
        .replace("{{updated}}", _post.created);
      return tmpl;
    });
    if (!items.length) {
      items.push(
        listTmpl
          .replace(/ hidden/g, "")
          .replace("{{title}}", "<i>Untitled</i>")
          .replace("{{uuid}}", "")
          .replace("{{created}}", Post._toLocalDatetime(new date()))
          .replace("{{updated}}", Post._toLocalDatetime(new date()))
      );
    }
    console.log(items);
    $(".js-items").innerHTML = items.join("\n");
  };

  var listTmpl = $(".js-row").outerHTML;
  $(".js-row").remove();
  console.log(listTmpl);

  Post._load(localStorage.getItem("current"));
  Post.list();
})();
