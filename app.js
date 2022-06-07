(async function () {
  "use strict";

  let $ = window.$;
  let Tab = window.Tab;
  let PostModel = window.PostModel;
  let Post = window.Post;
  let Blog = window.Blog;

  Tab._init();
  PostModel._init();
  Post._init();
  Blog._init();

  // deprecated
  localStorage.removeItem("all");

  function _initFromTemplate() {
    var pathname = window.document.location.hash.slice(1);
    // base url doesn't matter - we're just using this for parsing
    var url = new URL("https://ignore.me/" + pathname);
    var query = {};
    url.searchParams.forEach(function (val, key) {
      query[key] = val || true; // ght = true
    });
    if (!query.h && query.ght) {
      query.h = "github.com";
    }
    if (!query.h || !query.o || !query.r) {
      return;
    }

    // https://{host}/{owner}/{repo}#{branch}
    var repoUrl = "https://" + query.h + "/" + query.o + "/" + query.r;
    if (query.b) {
      repoUrl += "#" + query.b;
    }

    if (query.ght) {
      $('select[name="blog"]').value = "eon"; // TODO should be 'hugo'
    }
    $('input[name="repo"]').value = repoUrl;
    var event = new Event("change");
    $('input[name="repo"]').dispatchEvent(event);

    var hashless = window.document.location.href.split("#")[0];
    history.replaceState({}, document.title, hashless);
    console.log("[DEBUG] replaced history state", hashless);
    Tab._setToFirst();
  }
  _initFromTemplate();
})();
