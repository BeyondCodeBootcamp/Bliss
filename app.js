"use strict";

var XTZ = window.XTZ;
var $ = window.$;
var $$ = window.$$;
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

Post._uuid_sep = " ";

Post._toSlug = function (str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/g, "")
    .replace(/-$/g, "")
    .trim();
};

Post._toInputDatetimeLocal = function (
  d = new Date(),
  tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  // TODO
  // It's quite reasonable that a person may create the post
  // in an Eastern state on New York time and later edit the
  // same post in a Western state on Mountain Time.
  //
  // How to we prevent the time from being shifted accidentally?
  //
  // ditto for updated at
  /*
  if ("string" === typeof d) {
    return d.replace(/([+-]\d{4}|Z)$/, '');
  }
  */
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

Post._format = function (_key, val, _system) {
  // 2021-07-01T13:59:59-0600
  // => 2021-07-01 1:59:59 pm
  var parts = val.split("T");
  var date = parts[0];
  var time = parts[1];
  var times = time.replace(/([-+]\d{4}|Z)$/g, "").split(":");
  var hour = parseInt(times[0], 10) || 0;
  var meridian = "am";
  if (hour >= 12) {
    hour -= 12;
    meridian = "pm";
    times[0] = hour;
  }
  times[2] = "00";
  // 2021-07-01 + ' ' + 1:59:59 + ' ' +  pm
  return date + " " + times.join(":") + " " + meridian;
};

Post._preview = function (post) {
  var systems = {
    desi: [
      "---",
      'title: "{{title}}"',
      'description: "CHANGE ME !!!!!!"',
      'timezone: "{{timezone}}"',
      'date: "{{created}}"',
      'updated: "{{updated}}"',
      "uuid: {{uuid}}",
      "categories:",
      "  - CHANGE_ME_______________",
      "permalink: /articles/{{slug}}/",
      "---",
    ],
    eon: [
      "---",
      'title: "{{title}}"',
      'description: "CHANGE ME !!!!!!"',
      'timezone: "{{timezone}}"',
      'date: "{{created}}"',
      'updated: "{{updated}}"',
      "uuid: {{uuid}}",
      "categories:",
      "  - CHANGE_ME_______________",
      "---",
    ],
    bash: [],
  };
  post._slug = Post._toSlug(post.title);
  post._filename = post._slug + ".md";
  post._template = (systems[post._blog] || systems.eon).join("\n");

  var created = Post._format("created", post.created, post._system);
  var updated = Post._format("updated", post.updated, post._system);
  post._frontMatter = post._template
    // TODO loop to make look nicer?
    // ['title', 'timezone', 'created', 'updated', ... ]
    // str = str.replace(new RegExp('{{'+key+'}}', 'g'), val)
    // str = str.replace(new RegExp('"{{'+key+'}}"', 'g'), val)
    .replace(/"{{title}}"/g, JSON.stringify(post.title))
    .replace(/{{title}}/g, post.title)
    .replace(/"{{timezone}}"/g, JSON.stringify(post.timezone))
    .replace(/{{timezone}}/g, post.timezone)
    .replace(/"{{created}}"/g, JSON.stringify(created))
    .replace(/{{created}}/g, created)
    .replace(/"{{updated}}"/g, JSON.stringify(updated))
    .replace(/{{updated}}/g, updated)
    .replace(/"{{uuid}}"/g, JSON.stringify(post.uuid))
    .replace(/{{uuid}}/g, post.uuid)
    .replace(/"{{slug}}"/g, JSON.stringify(post._slug))
    .replace(/{{slug}}/g, post._slug);

  var filestr;
  if (post._frontMatter.trim()) {
    filestr = post._frontMatter + "\n\n" + post.content;
  } else {
    filestr = post.content;
  }
  if (post._filename && post.content) {
    $(".js-preview-container").hidden = false;
    $(".js-filename").innerText = post._filename;
    $(".js-preview").innerText = filestr;
  } else {
    $(".js-preview-container").hidden = true;
  }

  $("span.js-githost").innerText = $(
    'select[name="githost"] option:checked'
  ).innerText;
  // ex: https://github.com/beyondcodebootcamp/beyondcodebootcamp.com/
  $("a.js-commit-url").href = post._repo.replace(/\/$/, "");

  var pathname = "";
  switch (post._blog) {
    case "desi":
      pathname = "/posts";
      break;
    case "eon":
      pathname = "/content/blog";
      break;
    case "bash":
      pathname = "/articles";
      break;
    default:
      // TODO log error
      console.warn(
        "Warning: using a default post._blog by accident",
        post._blog
      );
      pathname = "/articles";
  }
  pathname = encodeURI(pathname);

  var content = encodeURIComponent(filestr);
  var commitPath;
  // TODO branch name (default main or master)
  switch (post._githost) {
    case "gitea":
      // TODO example url
      $("a.js-commit-url").href +=
        // TODO "/_new/main?filename=" +
        "/_new/main" +
        pathname +
        "/" +
        // TODO filename?
        post._slug +
        ".md?value=" +
        content;
      break;
    case "github":
      // TODO example url
      $("a.js-commit-url").href +=
        "/new/main?filename=" +
        pathname +
        "/" +
        // TODO filename?
        post._slug +
        ".md&value=" +
        content;
      break;
    default:
      // TODO log error
      console.warn(
        "Warning: using a default post._blog by accident",
        post._blog
      );
      $("a.js-commit-url").href +=
        "/new/main?filename=" +
        pathname +
        "/" +
        // TODO filename?
        post._slug +
        ".md&value=" +
        content;
  }

  $("code.js-raw-url").innerText = $("a.js-commit-url").href;
};

Post.restore = function (uuid) {
  var post = JSON.parse(localStorage.getItem("post." + uuid + ".meta") || "{}");
  post.uuid = uuid || Post._uuid();

  if (!post._repo) {
    post._repo = "";
  }

  if (!post.title) {
    post.title =
      // TODO deprecate
      localStorage.getItem(post.uuid + ".title") || "";
  }

  if (!post.timezone) {
    post.timezone =
      // TODO deprecate
      localStorage.getItem(post.uuid + ".timezone") ||
      new Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  if (!post.created) {
    post.created =
      // TODO deprecate
      localStorage.getItem(post.uuid + ".created") ||
      XTZ.toTimeZone(new Date(), post.timezone).toISOString();
  }

  if (!post.updated) {
    post.updated =
      // TODO deprecate
      localStorage.getItem(post.uuid + ".updated") || post.created;
  }

  // TODO _blog, _githost, _repo

  post.content =
    localStorage.getItem("post." + post.uuid + ".data") ||
    localStorage.getItem(post.uuid + ".content") ||
    "";

  return post;
};

Post._all = function () {
  return (localStorage.getItem("all") || "")
    .split(/[\s,;:|]+/g)
    .filter(Boolean);
};

Post._store = function (post) {
  // TODO debounce with max time
  var timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  post.timezone = post.timezone || timezone;
  post._blog = $('select[name="blog"]').value || "eon";
  post._githost = $('select[name="githost"]').value;
  post._repo = $('input[name="repo"]').value || "";
  post.title = $('input[name="title"]').value;
  // 2021-07-01T13:59:59 => 2021-07-01T13:59:59-0600
  post.created = XTZ.toUTC(
    $('input[name="created"]').value,
    timezone
  ).toISOString();
  post.updated = post.updated || post.created;
  post.content = $('textarea[name="content"]').value;

  var all = Post._all();
  if (!all.includes(post.uuid)) {
    all.push(post.uuid);
    localStorage.setItem("all", all.join(Post._uuid_sep).trim());
  }
  // TODO deprecate
  localStorage.setItem(post.uuid + ".title", post.title);
  localStorage.setItem(post.uuid + ".created", post.created);
  localStorage.setItem(post.uuid + ".updated", post.updated);
  localStorage.setItem(post.uuid + ".content", post.content);

  localStorage.setItem(
    "post." + post.uuid + ".meta",
    JSON.stringify({
      title: post.title,
      uuid: post.uuid,
      _slug: post._slug,
      created: post.created,
      updated: post.updated,
      timezone: post.timezone,
      _blog: post._blog,
      _githost: post._githost,
      _repo: post._repo,
    })
  );
  localStorage.setItem("post." + post.uuid + ".data", post.content);
};

Post.save = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  Post._update(Post._current);
};

Post.undelete = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  Post._update(Post._current);
  $(".js-undelete").hidden = true;
  Post.list();
};

Post.load = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  var parent = ev.target.closest(".js-row");
  var uuid = $('input[name="uuid"]', parent).value;
  localStorage.setItem("current", uuid);
  Post._current = Post._load(uuid);
};

Post.create = function (ev) {
  ev.preventDefault();
  ev.stopPropagation();

  var uuid = Post._uuid();
  localStorage.setItem("current", uuid);
  Post._current = Post._load(uuid);
  Post._store(Post._current);
  Post.list();
};

Post.delete = function (ev) {
  var q = "Are you sure you want to permanently delete this draft?";

  var parent = ev.target.closest(".js-row");
  var uuid = $('input[name="uuid"]', parent).value;

  if (!window.confirm(q)) {
    return;
  }

  if (!$(".js-undelete").hidden) {
    // if we're deleting multiple things, we don't want to re-save on delete
    Post.save(ev);
  }
  Post._delete(uuid);
  if (uuid === Post._current.uuid) {
    // load as a failsafe, just in case
    localStorage.removeItem("current", uuid);
    localStorage.setItem("current", Post._all()[0]);
  } else {
    Post._current = Post._load(uuid);
  }
  Post.list();
  $(".js-undelete").hidden = false;
};

Post._delete = function (uuid) {
  var all = Post._all();
  all = all.filter(function (_uuid) {
    return uuid !== _uuid;
  });
  localStorage.setItem("all", all.join(Post._uuid_sep).trim());
};

Post._load = function (uuid) {
  var post = Post.restore(uuid);
  $('input[name="title"]').value = post.title;
  $('input[name="created"]').value = Post._toInputDatetimeLocal(post.created);
  if (post._githost) {
    $('select[name="githost"]').value = post._githost;
  }
  if (post._blog) {
    $('select[name="blog"]').value = post._blog;
  }
  $('input[name="repo"]').value = post._repo;
  $('textarea[name="content"]').value = post.content;
  $(".js-undelete").hidden = true;

  Post._preview(post);
  return post;
};

(async function () {
  "use strict";

  Post._update = function (post) {
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

    Post._store(post);
    Post._preview(post);
  };

  Post.list = function () {
    var items = Post._all().map(function (uuid) {
      var post = Post.restore(uuid);
      var tmpl = listTmpl
        .replace(/ hidden/g, "")
        .replace(
          "{{title}}",
          post.title.slice(0, 50).replace(/</g, "&lt;") || "<i>Untitled</i>"
        )
        .replace("{{uuid}}", post.uuid)
        .replace(
          "{{created}}",
          "🗓" + Post._toInputDatetimeLocal(post.created).replace(/T/g, " ⏰")
        )
        .replace(
          "{{updated}}",
          "🗓" + Post._toInputDatetimeLocal(post.updated).replace(/T/g, " ⏰")
        );
      return tmpl;
    });
    if (!items.length) {
      items.push(
        listTmpl
          .replace(/ hidden/g, "")
          .replace("{{title}}", "<i>Untitled</i>")
          .replace("{{uuid}}", "")
          .replace(
            "{{created}}",
            "🗓" + Post._toInputDatetimeLocal(new Date()).replace(/T/g, " ⏰")
          )
          .replace(
            "{{updated}}",
            "🗓" + Post._toInputDatetimeLocal(new Date()).replace(/T/g, " ⏰")
          )
      );
    }
    $(".js-items").innerHTML = items.join("\n");
  };

  var listTmpl = $(".js-row").outerHTML;
  $(".js-row").remove();

  Post._current = Post._load(localStorage.getItem("current"));
  Post.list();
})();
