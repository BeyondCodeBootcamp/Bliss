var Settings = {};

(async function () {
  "use strict";

  Settings.togglePassphrase = async function (ev) {
    let pass = ev.target
      .closest("form")
      .querySelector(".js-passphrase")
      .value.trim();
    if ("[hidden]" != pass) {
      ev.target.closest("form").querySelector("button").innerText = "Show";
      ev.target.closest("form").querySelector(".js-passphrase").value =
        "[hidden]";
      return;
    }

    let b64 = localStorage.getItem("bliss:enc-key") || "";
    let bytes = Encoding.base64ToBuffer(b64);
    pass = await Passphrase.encode(bytes);

    // TODO standardize controller container ma-bob
    ev.target.closest("form").querySelector(".js-passphrase").value = pass;
    ev.target.closest("form").querySelector("button").innerText = "Hide";
  };

  Settings.savePassphrase = async function (ev) {
    let pass = ev.target
      .closest("form")
      .querySelector(".js-passphrase")
      .value.trim()
      .split(/[\s,:-]+/)
      .filter(Boolean)
      .join(" ");

    let bytes;
    try {
      bytes = await Passphrase.decode(pass);
    } catch (e) {
      ev.target.closest("form").querySelector(".js-hint").innerText = e.message;
      return;
    }
    ev.target.closest("form").querySelector(".js-hint").innerText = "";

    let new64 = Encoding.bufferToBase64(bytes);

    let current64 = localStorage.getItem("bliss:enc-key");
    if (current64 === new64) {
      return;
    }

    let isoNow = new Date().toISOString();
    let oldPass = await Passphrase.encode(base64ToBuffer(current64));
    localStorage.setItem(`bliss:enc-key:backup:${isoNow}`, oldPass);

    localStorage.setItem("bliss:enc-key", new64);
    ev.target.closest("form").querySelector(".js-hint").innerText =
      "Saved New Passphrase!";
  };
})();

(async function () {
  "use strict";

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
