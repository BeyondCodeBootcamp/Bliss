var Sync = {};

(async function () {
  "use strict";

  // from env.js
  let ENV = window.ENV;

  // scheme => 'https:'
  // host => 'localhost:3000'
  // pathname => '/api/authn/session/oidc/google.com'
  //let baseUrl = document.location.protocol + "//" + document.location.host;
  let baseUrl = ENV.BASE_API_URL;

  let $ = window.$;
  let $$ = window.$$;
  let Encoding = window.Encoding;
  let Encraption = window.Encraption;
  let Debouncer = window.Debouncer;
  let Session = {
    getToken: async function () {
      return Session._token;
    },
    _setToken: function (token) {
      Session._token = token;
    },
  };

  function noop() {}

  function die(err) {
    console.error(err);
    window.alert(
      "Oops! There was an unexpected error.\nIt's not your fault.\n\n" +
        "Technical Details for Tech Support: \n" +
        err.message
    );
    throw err;
  }

  async function attemptRefresh() {
    let resp = await window
      .fetch(baseUrl + "/api/authn/refresh", { method: "POST" })
      .catch(noop);
    if (!resp) {
      return;
    }
    return await resp.json().catch(die);
  }

  async function completeOauth2SignIn(baseUrl, query) {
    let Tab = window.Tab;

    // nix token from browser history
    window.history.pushState(
      "",
      document.title,
      window.location.pathname + window.location.search
    );
    // TODO fire hash change event synthetically via the DOM?
    Tab._hashChange();

    // Show the token for easy capture
    //console.debug("access_token", query.access_token);

    if ("github.com" === query.issuer) {
      // TODO this is moot. We could set the auth cookie at time of redirect
      // and include the real (our) id_token
      let resp = await window
        .fetch(baseUrl + "/api/authn/session/oauth2/github.com", {
          method: "POST",
          body: JSON.stringify({
            timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: window.navigator.language,
          }),
          headers: {
            Authorization: query.access_token,
            "Content-Type": "application/json",
          },
        })
        .catch(die);
      let result = await resp.json().catch(die);

      //console.debug("Our bespoken token(s):");
      //console.debug(result);

      await doStuffWithUser(result).catch(die);
    }
    // TODO what if it's not github?
  }

  async function init() {
    let Auth3000 = window.Auth3000;
    $$(".js-authenticated").forEach(function ($el) {
      $el.hidden = true;
    });
    $$(".js-guest").forEach(function ($el) {
      $el.hidden = true;
    });

    var githubSignInUrl = Auth3000.generateOauth2Url(
      "https://github.com/login/oauth/authorize",
      ENV.GITHUB_CLIENT_ID,
      ENV.GITHUB_REDIRECT_URI,
      ["read:user", "user:email"]
    );
    $(".js-github-oauth2-url").href = githubSignInUrl;

    $(".js-logout").addEventListener("click", async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      window.removeEventListener("beforeunload", Session._beforeunload);
      //window.removeEventListener("unload", Session._beforeunload);
      clearInterval(Session._syncTimer);

      let resp = await window
        .fetch(baseUrl + "/api/authn/session", {
          method: "DELETE",
        })
        .catch(die);
      let result = await resp.json().catch(die);
      console.log(result);
      window.alert("Logged out!");
      init();
    });

    var querystring = document.location.hash.slice(1);
    var query = Auth3000.parseQuerystring(querystring);
    if (query.id_token) {
      //completeOidcSignIn(query);
      console.log("Google Sign In not implemented");
      return;
    }
    if (query.access_token && "bearer" === query.token_type) {
      completeOauth2SignIn(baseUrl, query);
      return;
    }

    let result = await attemptRefresh();
    //console.debug("Refresh Token: (may be empty)");
    //console.debug(result);

    if (result.id_token || result.access_token) {
      await doStuffWithUser(result).catch(die);
      return;
    }

    $$(".js-guest").forEach(function ($el) {
      $el.hidden = false;
    });
    //$(".js-social-login").hidden = false;
    return;
  }

  //
  // Sync Code Stuff
  //

  let crypto = window.crypto;
  let Passphrase = window.Passphrase;
  let PostModel = window.PostModel;
  let Post = window.Post;

  async function doStuffWithUser(result) {
    if (!result.id_token && !result.access_token) {
      window.alert("No token, something went wrong.");
      return;
    }
    $$(".js-authenticated").forEach(function ($el) {
      $el.hidden = false;
    });

    let token = result.id_token || result.access_token;
    Session._setToken(token);

    // Note: this CANNOT be an async function !!
    Session._beforeunload = function (ev) {
      if (0 === Sync.getSyncable().length) {
        return;
      }

      ev.preventDefault();
      ev.returnValue = "Some items may not be saved. Close the window anyway?";

      /*
      // start syncing, even though it may not finish...
      syncUp().catch(function (err) {
        console.warn("Error during sync on 'beforeunload'");
        console.warn(err);
      });
      */

      return ev.returnValue;
    };

    window.addEventListener("beforeunload", Session._beforeunload);
    //window.addEventListener("unload", Session._beforeunload);
    window.document.addEventListener("visibilitychange", async function () {
      // fires when user switches tabs, apps, goes to homescreen, etc.
      if ("hidden" !== document.visibilityState) {
        return;
      }

      await syncDown()
        .then(syncUp)
        .catch(function (err) {
          console.warn("Error during sync down on 'visibilitychange'");
          console.warn(err);
        });
    });

    Session._syncTimer = setInterval(async function () {
      console.log("[DEBUG] Interval is working");

      // sync down first so that backups are created
      await syncDown().catch(function (err) {
        console.warn("Error during sync (download) on interval timer");
        console.warn(err);
      });
      await syncUp().catch(function (err) {
        console.warn("Error during sync (upload) on interval timer");
        console.warn(err);
      });
    }, 5 * 60 * 1000);

    await syncUserContent();
  }

  PostModel._syncHook = async function __syncHook(post) {
    let token = await Session.getToken();
    let key2048 = getKey2048();

    if (!post.title) {
      // don't sync "Untitled" posts
      // TODO don't save empty posts at all
      console.warn("[WARN] skipped attempt to sync empty post");
      return;
    }

    // impossible condition: would require a new bug in the code
    // (double parse to ensure a valid date (i.e. NaN => 0))
    let updatedAt = new Date(new Date(post.updated).valueOf() || 0);
    if (!updatedAt) {
      // TODO what's the sane quick fix for this?
      console.warn("[WARN] bad `updated` date:", post);
    }
    if (updatedAt && post.sync_version === post.updated) {
      console.warn(
        "[WARN] skipped attempt to double sync same version of post"
      );
      return;
    }

    await _syncPost(token, key2048, post);
  };

  let debounceSync = Debouncer.create(async function () {
    function showAndReturnError(err) {
      console.error(err);
      window.alert(
        "Oops! The sync failed.\nIt may have been a network error.\nIt's not your fault.\n\n" +
          "Technical Details for Tech Support: \n" +
          err.message
      );
      return err;
    }

    let err = await syncUp().catch(showAndReturnError);
    if (err instanceof Error) {
      return;
    }
    await syncUp().catch(showAndReturnError);
  }, 200);
  window.document.body.addEventListener("click", async function (ev) {
    if (!ev.target.matches(".js-sync")) {
      return;
    }

    ev.target.disabled = "disabled";
    // TODO make async/await
    // TODO disable button, add spinner
    //$('button.js-sync').disabled = true;
    let result = await debounceSync().catch(Object);
    ev.target.removeAttribute("disabled");
    if (result instanceof Error) {
      return;
    }
  });

  /*
  $$('.js-sync').forEach(function ($el) {
      $el.addEventListener("click", function (ev) {
      });
  })
  */

  async function getPostKey(sync_id) {
    // TODO decide how to share keys so that we can have shared projects
    let keyBytes;
    let key64 = localStorage.getItem(`post.${sync_id}.key`);
    if (key64) {
      keyBytes = Encoding.base64ToBuffer(key64);
    } else {
      let key2048 = await getKey2048();
      let buf512 = await Passphrase.pbkdf2(key2048, sync_id);
      keyBytes = buf512.slice(0, 16);
    }

    return await Encraption.importKeyBytes(keyBytes);
  }

  async function decryptPost(item) {
    let postKey = await getPostKey(item.uuid);

    let data = item.data;

    let syncedPost = await Encraption.decrypt64(data.encrypted, postKey).catch(
      function (err) {
        err.data = data;
        throw err;
      }
    );
    return syncedPost;
  }

  async function docCreate(token) {
    let resp = await window.fetch(baseUrl + "/api/user/doc", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: JSON.stringify({}),
      }),
    });
    let body = await resp.json();
    if (!body.uuid || !new Date(body.updated_at).valueOf()) {
      // TODO
      throw new Error("Sync was not successful");
    }
    return body;
  }

  async function docUpdate(token, key, post) {
    let resp = await window.fetch(`${baseUrl}/api/user/doc/${post.sync_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: JSON.stringify({
          encrypted: await Encraption.encryptObj(post, key),
        }),
      }),
    });
    let body = await resp.json();
    if (!body.uuid || !new Date(body.updated_at).valueOf()) {
      // TODO
      throw new Error("Sync was not successful");
    }
    return body;
  }

  async function _syncPost(token, key2048, post) {
    post._type = "post";

    if (!post.sync_id) {
      let item = await docCreate(token);
      post.sync_id = item.uuid;
      PostModel.save(post);
    }

    let postKey = await getPostKey(post.sync_id);

    // Note: We intentionally don't use the remote's `updated_at`.
    // We keep local `updated` for local sync logic
    // Example (of what not to do): post.updated = resp.updated_at.toISOString();

    await docUpdate(token, postKey, post);
    post.sync_version = post.updated;
    PostModel.save(post);
  }

  function showError(err) {
    console.error(err);
    window.alert("that's not a valid key");
  }

  function getLastDown() {
    // double parsing date to guarantee a valid date or the zero date
    return new Date(
      new Date(localStorage.getItem("bliss:last-sync-down")).valueOf() || 0
    );
  }

  function getLastUp() {
    return new Date(
      new Date(localStorage.getItem("bliss:last-sync-up")).valueOf() || 0
    );
  }

  async function getKey2048() {
    let key64 = localStorage.getItem("bliss:enc-key");
    if (!key64) {
      let err = new Error("no key exists");
      err.code = "NOT_FOUND";
      throw err;
    }
    let keyBytes = Encoding.base64ToBuffer(key64);
    let key2048 = await Passphrase.encode(keyBytes);
    return key2048;
  }

  async function askForKey2048() {
    // while (true) is for ninnies
    for (;;) {
      let _key2048 = window
        .prompt(
          "What's your encryption passphrase? (check in Settings on the system that you first used Bliss)",
          ""
        )
        .trim();
      let keyBytes = await Passphrase.decode(_key2048).catch(showError);
      if (!keyBytes) {
        continue;
      }
      let key64 = Encoding.bufferToBase64(keyBytes); // can't fail
      let key = await Encraption.importKey64(key64).catch(showError);
      if (!key) {
        continue;
      }

      // TODO try to decrypt something to ensure correctness
      localStorage.setItem("bliss:enc-key", key64);
      return _key2048;
    }
  }

  async function syncUserContent() {
    await syncDown();
    await syncUp();
  }

  async function syncDown(_cannotReDo) {
    let token = await Session.getToken();
    let lastSyncDown = getLastDown();

    let resp = await window
      .fetch(baseUrl + "/api/user/doc?since=" + lastSyncDown.toISOString(), {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
        },
      })
      .catch(die);
    let items = await resp.json().catch(die);

    //console.debug("Items:");
    //console.debug(items);

    // Use MEGA-style https://site.com/invite#priv ?
    // hash(priv) => pub
    let key2048 = await getKey2048().catch(function (err) {
      if ("NOT_FOUND" !== err.code) {
        throw err;
      }
      return "";
    });

    // We should always have at least the "How to Sync Drafts" post
    if (0 === lastSyncDown.valueOf() && !items.length) {
      // this is a new account on its first computer
      // gen 128-bit key
      if (!key2048) {
        let keyBytes = crypto.getRandomValues(new Uint8Array(16));
        let key64 = Encoding.bufferToBase64(keyBytes);
        key2048 = await Passphrase.encode(keyBytes);
        localStorage.setItem("bliss:enc-key", key64);
      }

      await syncTemplatePost(token, key2048);

      // shouldn't be possible to be called thrice but...
      // just in case...
      if (!_cannotReDo) {
        return await syncDown(true);
      }
      throw new Error("impossible condition: empty content after first sync");
    }

    if (!key2048) {
      key2048 = await askForKey2048();
    }

    await updateLocal(items);

    // TODO make public or make... different
    Post._renderRows();
  }

  async function updateLocal(items) {
    let lastSyncDown = getLastDown();

    // poor man's forEachAsync
    await items.reduce(async function (promise, item) {
      await promise;

      try {
        // because this is double stringified (for now)
        item.data = JSON.parse(item.data);
      } catch (e) {
        e.data = item.data;
        console.warn(e);
        return;
      }

      let remotePost = await decryptPost(item).catch(function (e) {
        console.warn("Could not parse or decrypt:");
        console.warn(item.data);
        console.warn(e);
        throw e;
      });
      if (remotePost._type && "post" !== remotePost._type) {
        console.warn("couldn't handle type", remotePost._type);
        console.warn(remotePost);
        return;
      }

      let updatedAt = new Date(item.updated_at);
      if (updatedAt.valueOf() > lastSyncDown.valueOf()) {
        // updated once in localStorage at the end
        lastSyncDown = new Date(item.updated_at);
      }

      // `post.updated` may be newer than `post.sync_version`
      // `remotePost.updated` may match `post.sync_version`
      // TODO get downloads as the response to an upload (v1.1+)
      let localPost = PostModel.get(remotePost.uuid);
      if (!localPost) {
        // new thing, guaranteed conflict-free
        // TODO sync_version should stay local
        remotePost.sync_version = remotePost.updated;
        PostModel.save(remotePost);
        return;
      }

      let syncedVersion = new Date(localPost.syncVersion).valueOf() || 0;
      let localUpdated = new Date(localPost.updated).valueOf() || 0;
      let remoteUpdated = new Date(remotePost.updated).valueOf() || 0;

      // The local is ahead of the remote.
      // The local has non-synced updates.
      // The remote version doesn't match the last synced version.
      if (localUpdated >= remoteUpdated && remoteUpdated !== syncedVersion) {
        PostModel.saveVersion(remotePost);
        console.debug(
          "Choosing winner wins strategy: local, more recent post is kept; older, synced post saved as alternate version."
        );
        // return because we keep the more-up-to-date local
        // TODO go ahead and sync the local upwards?
        return;
      }

      if (remoteUpdated === localUpdated && syncedVersion === localUpdated) {
        // unlikely condition, but... don't resave items that haven't changed
        return;
      }

      // The remote is ahead of the local.
      // The local has non-synced updates.
      // The remote version doesn't match the last synced version.
      if (remoteUpdated >= localUpdated && localUpdated !== syncedVersion) {
        PostModel.saveVersion(localPost);
        console.debug(
          "Choosing winner wins strategy: remote, more recent post is kept; older, local post saved as alternate version."
        );
        // TODO update UI??
        // don't return because we overwrite the local with the newer remote
      }

      // TODO update UI??
      // the remote was newer, it wins
      remotePost.sync_version = remotePost.updated;
      PostModel.save(remotePost);
    }, Promise.resolve());

    localStorage.setItem("bliss:last-sync-down", lastSyncDown.toISOString());
  }

  async function syncTemplatePost(token, key2048) {
    let howToSyncTemplate = {
      title: "🎉🔥🚀 NEW! How to Sync Drafts",
      description: "Congrats! Now you can sync drafts between computers!",
      //updated: new Date(0).toISOString(),
      content: `Bliss uses secure local encryption for syncing drafts.

(you're probably not a weirdo, but if you are, we don't even want to be able to find out 😉)

Your browser has generated a secure, random, 128-bit encryption passphrase which you must use in order to sync drafts between computers.

To enable 🔁 Sync on another computer:
1. Sign in to Bliss on the other computer.
2. You will be prompted for your encryption passphrase.
3. Copy and paste your passphrase from Settings

Enjoy! 🥳`,
    };

    // calling _syncPost directly as to not update sync date
    await _syncPost(token, key2048, PostModel.normalize(howToSyncTemplate));
  }

  Sync.getSyncable = function () {
    return PostModel.ids()
      .map(function (id) {
        // get posts rather than ids
        let post = PostModel.getOrCreate(id);
        post.__updated_ms = new Date(post.updated).valueOf();
        if (!post.__updated_ms) {
          console.warn("[WARN] post without `updated`:", post);
          post.__updated_ms = 0;
        }
        return post;
      })
      .sort(function (a, b) {
        // Note: syncHook MUST be called on posts in ascending `updated_at` order
        // (otherwise drafts will be older than `_lastSyncUp` and be skipped / lost)
        return a.__updated_ms - b.__updated_ms;
      })
      .filter(function (post) {
        if (!post.title) {
          // don't sync "Untitled" posts
          // TODO don't save empty posts at all
          return false;
        }

        if (post.sync_version === post.updated) {
          return false;
        }

        // it's impossible for the sync_version to be ahead of the updated
        // but... the impossible happens all the time in programming!
        if (new Date(post.sync_version).valueOf() > post.__updated_ms) {
          console.warn(
            "[WARN] sync_version is ahead of updated... ¯\\_(ツ)_/¯"
          );
        }

        return true;
      });
  };

  async function syncUp() {
    let _lastSyncUp = getLastUp();

    // update all existing posts
    let syncable = Sync.getSyncable();
    await syncable.reduce(async function (p, post) {
      await p;
      await PostModel._syncHook(post);

      // Only update if newer...
      if (post.__updated_ms > _lastSyncUp.valueOf()) {
        _lastSyncUp = new Date(post.__updated_ms);
        localStorage.setItem("bliss:last-sync-up", _lastSyncUp.toISOString());
      }
    }, Promise.resolve());

    Post._renderRows();
  }

  init().catch(function (err) {
    console.error(err);
    window.alert(`Fatal Error: ${err.message}`);
  });
})();
