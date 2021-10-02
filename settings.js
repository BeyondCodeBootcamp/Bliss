var Settings = {};

(async function () {
  "use strict";

  let $ = window.$;
  let Passphrase = window.Passphrase;
  let Encoding = window.Encoding;

  let units = ["b", "kb", "mb", "gb"];

  function fromBytes(n) {
    // NaN's a trixy number...
    n = parseInt(n, 10) || 0;
    if (n < 1024) {
      return n + "b";
    }

    let unit = 0;
    for (;;) {
      if (n < 1024) {
        break;
      }
      n /= 1024;
      unit += 1;
    }

    return n.toFixed(1) + units[unit];
  }

  Settings.setUsage = function (usage) {
    let $totalSize = $('.js-usage [name="total-size"]');
    let totalSize = fromBytes(usage.total_size) || 0;
    $totalSize.value = $totalSize.value.replace(/.* of/, `${totalSize} of`);

    let $totalCount = $('.js-usage [name="total-count"]');
    let totalCount = usage.total_count || 0;
    $totalCount.value = $totalCount.value.replace(/.* of/, `${totalCount} of`);
  };

  Settings.togglePassphrase = async function (ev) {
    let pass = ev.target
      .closest("form")
      .querySelector(".js-passphrase")
      .value.trim();
    if ("[hidden]" !== pass) {
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
    let newPass = ev.target
      .closest("form")
      .querySelector(".js-passphrase")
      .value.trim()
      .split(/[\s,:-]+/)
      .filter(Boolean)
      .join(" ");

    let bytes;
    try {
      bytes = await Passphrase.decode(newPass);
    } catch (e) {
      ev.target.closest("form").querySelector(".js-hint").innerText = e.message;
      return;
    }
    ev.target.closest("form").querySelector(".js-hint").innerText = "";

    let new64 = Encoding.bufferToBase64(bytes);

    let isoNow = new Date().toISOString();
    let current64 = localStorage.getItem("bliss:enc-key");
    if (current64 === new64) {
      return;
    }

    localStorage.setItem("bliss:enc-key", new64);
    localStorage.setItem(`bliss:enc-key:backup:${isoNow}`, newPass);
    ev.target.closest("form").querySelector(".js-hint").innerText =
      "Saved New Passphrase!";
  };

  function _init() {
    let PostModel = window.PostModel;

    let ids = PostModel.ids();
    let usage = { total_count: ids.length, total_size: 0 };

    ids.forEach(function (id) {
      let post = PostModel.get(id);
      let size = new TextEncoder().encode(JSON.stringify(post)).byteLength;
      usage.total_size += size;
    });

    Settings.setUsage(usage);
  }

  _init();
})();
