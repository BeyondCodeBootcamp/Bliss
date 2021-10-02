var Tab = {};

(function () {
  "use strict";

  let $ = window.$;
  let $$ = window.$$;

  Tab._init = function () {
    window.addEventListener("hashchange", Tab._hashChange, false);
    if ("" !== location.hash.slice(1)) {
      Tab._hashChange();
      return;
    }

    Tab._setToFirst();
  };

  Tab._setToFirst = function () {
    let name = $$("[data-ui]")[0].dataset.ui;
    location.hash = `#${name}`;
    console.log("[DEBUG] set hash to", location.hash);
  };

  Tab._hashChange = function () {
    let name = location.hash.slice(1);
    if (!name) {
      Tab._setToFirst();
      return;
    }
    if (!$$(`[data-ui="${name}"]`).length) {
      console.warn(
        "something else took over the hash routing:",
        name.slice(0, 10) + "..."
      );
      return;
    }

    // TODO requestAnimationFrame

    // switch to the visible tab
    $$("[data-ui]").forEach(function ($tabBody, i) {
      let tabName = $tabBody.dataset.ui;

      if (name !== tabName) {
        $tabBody.hidden = true;
        return;
      }

      let $tabLink = $(`[data-href="#${name}"]`);
      $tabLink.classList.add("active");
      $tabLink.removeAttribute("href");
      $tabBody.hidden = false;
    });

    // switch to the visible tab
    $$("a[data-href]").forEach(function ($tabLink) {
      let tabName = $tabLink.dataset.href.slice(1);
      if (name === tabName) {
        return;
      }
      $tabLink.classList.remove("active");
      $tabLink.href = `#${tabName}`;
    });
  };
})();
