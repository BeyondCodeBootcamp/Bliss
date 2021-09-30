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
  let Encoding = window.Encoding;
  let Encraption = window.Encraption;

  function noop() {}

  function die(err) {
    console.error(err);
    window.alert(
      "Oops! There was an unexpected error on the server.\nIt's not your fault.\n\n" +
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
    $(".js-logout").hidden = true;
    $(".js-sign-in-github").hidden = true;

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

    $(".js-sign-in-github").hidden = false;
    //$(".js-social-login").hidden = false;
    return;
  }

  async function doStuffWithUser(result) {
    if (!result.id_token && !result.access_token) {
      window.alert("No token, something went wrong.");
      return;
    }
    $(".js-logout").hidden = false;
    let token = result.id_token || result.access_token;
    await syncUserContent(token);
  }

  //
  // Sync Code Stuff
  //

  let crypto = window.crypto;
  let Passphrase = window.Passphrase;
  let PostModel = window.PostModel;
  let Post = window.Post;

  async function decryptPost(key, item) {
    let data = item.data;

    let syncedPost = await Encraption.decrypt64(data.encrypted, key).catch(
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

  async function _syncPost(token, key2048, post, _lastSyncUp) {
    post._type = "post";

    // Note: syncHook MUST be called on posts in ascending `updated_at` order
    // (otherwise drafts will be older than `_lastSyncUp` and be skipped / lost)
    let postUpdatedAt = new Date(post.updated).valueOf() || 0;
    if (postUpdatedAt < _lastSyncUp.valueOf()) {
      return _lastSyncUp;
    }

    if (!post.sync_id) {
      let item = await docCreate(token);
      post.sync_id = item.uuid;
      PostModel.save(post);
    }

    let buf512 = await Passphrase.pbkdf2(key2048, post.sync_id);
    let buf128 = buf512.slice(0, 16);
    let key = await Encraption.importKeyBytes(buf128).catch(showError);

    // Note: We intentionally don't use the remote's `updated_at`.
    // We keep local `updated` for local sync logic
    // Example (of what not to do): post.updated = resp.updated_at.toISOString();

    await docUpdate(token, key, post);

    // double parse to ensure a valid date (i.e. NaN => 0)
    let updatedAt = new Date(new Date(post.updated).valueOf() || 0);
    if (!updatedAt) {
      console.warn("bad `updated` date:", post);
      return _lastSyncUp;
    }

    return updatedAt;
  }

  function showError(err) {
    console.error(err);
    window.alert("that's not a valid key");
  }

  async function syncUserContent(token, _cannotReDo) {
    let howToSyncTemplate = {
      title: "🎉🔥🚀 NEW! How to Sync Drafts",
      description: "Congrats! Now you can sync drafts between computers!",
      content: `Bliss uses secure local encryption for syncing drafts.

(you're probably not a weirdo, but if you are, we don't even want to be able to find out 😉)

Your browser has generated a secure, random, 128-bit encryption passphrase which you must use in order to sync drafts between computers.

To enable 🔁 Sync on another computer:
1. Sign in to Bliss on the other computer.
2. You will be prompted for your encryption passphrase.
3. Copy and paste your passphrase from Settings

Enjoy! 🥳`,
    };

    // Use MEGA-style https://site.com/invite#priv ?
    // hash(priv) => pub
    let key64 = localStorage.getItem("bliss:enc-key");
    let key;
    let key2048;
    let keyBytes;
    if (key64) {
      keyBytes = Encoding.base64ToBuffer(key64);
      key2048 = await Passphrase.encode(keyBytes);
      key = await Encraption.importKey64(key64).catch(showError);
    }

    // double parsing date to guarantee a valid date or the zero date
    let lastSyncDown = new Date(
      new Date(localStorage.getItem("bliss:last-sync-down")).valueOf() || 0
    );

    let lastSyncUp = new Date(
      new Date(localStorage.getItem("bliss:last-sync-up")).valueOf() || 0
    );

    PostModel._syncHook = async function __syncHook(post) {
      if (!post.title) {
        // don't sync "Untitled" posts
        // TODO don't save empty posts at all
        return;
      }
      lastSyncUp = await _syncPost(token, key2048, post, lastSyncUp);
      localStorage.setItem("bliss:last-sync-up", lastSyncUp.toISOString());
    };

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

    // We should always have at least the "How to Sync Drafts" post
    if (0 === lastSyncDown.valueOf() && !items.length) {
      // this is a new account on its first computer
      // gen 128-bit key
      if (!key) {
        keyBytes = crypto.getRandomValues(new Uint8Array(16));
        key64 = Encoding.bufferToBase64(keyBytes);
        key2048 = await Passphrase.encode(keyBytes);
        key = await Encraption.importKey64(key64);
        localStorage.setItem("bliss:enc-key", key64);
      }

      await PostModel._syncHook(PostModel.normalize(howToSyncTemplate));
      // shouldn't be possible to be called thrice but...
      // just in case...
      if (!_cannotReDo) {
        return syncUserContent(token, true);
      }
    }

    if (!key) {
      // while (true) is for ninnies
      for (;;) {
        let key2048 = window.prompt(
          "What's your encryption passphrase? (check in Settings on the system that you first used Bliss)",
          ""
        );
        let keyBytes = await Passphrase.decode(key2048.trim()).catch(showError);
        if (!keyBytes) {
          continue;
        }
        key64 = Encoding.bufferToBase64(keyBytes); // can't fail
        key = await Encraption.importKey64(key64).catch(showError);
        if (!key) {
          continue;
        }

        // TODO try to decrypt something to ensure correctness
        localStorage.setItem("bliss:enc-key", key64);
        break;
      }
    }

    /*
    let remoteIds = PostModel.ids().reduce(function (map, id) {
      let post = PostModel.getOrCreate(id);
      map[post.sync_id] = true;
    }, {});
    */

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

      // TODO decide how to keyshare so that we can have shared projects
      let buf512 = await Passphrase.pbkdf2(key2048, item.uuid);
      let buf128 = buf512.slice(0, 16);

      let postKey = await Encraption.importKeyBytes(buf128);
      let syncedPost = await decryptPost(postKey, item).catch(function (e) {
        console.warn("Could not parse or decrypt:");
        console.warn(item.data);
        console.warn(e);
        throw e;
      });
      if (syncedPost._type && "post" !== syncedPost._type) {
        console.warn("couldn't handle type", syncedPost._type);
        console.warn(syncedPost);
        return;
      }

      if (lastSyncDown.valueOf() < new Date(item.updated_at).valueOf()) {
        // updated once in localStorage at the end
        lastSyncDown = new Date(item.updated_at);
      }

      let localPost = PostModel.get(syncedPost.uuid);
      if (localPost) {
        // localPost is guaranteed to have a sync_id by all rational logic
        let localUpdated = new Date(localPost.updated).valueOf() || 0;
        let syncedUpdated = new Date(syncedPost.updated).valueOf() || 0;
        if (localUpdated > syncedUpdated) {
          PostModel.saveVersion(syncedPost);
          console.debug(
            "Choosing winner wins strategy: local, more recent post is kept; older, synced post saved as alternate version."
          );
          return;
        }
      }

      // TODO don't resave items that haven't changed?
      syncedPost.sync_id = item.uuid;
      syncedPost.synced_at = item.updated_at;
      PostModel.save(syncedPost);
    }, Promise.resolve());
    localStorage.setItem("bliss:last-sync-down", lastSyncDown.toISOString());
    // TODO make public or make... different
    Post._renderRows();

    // TODO handle offline case: if new things have not been synced, sync them

    // update all existing posts
    await PostModel.ids()
      .map(function (id) {
        // get posts rather than ids
        return PostModel.getOrCreate(id);
      })
      .sort(function (a, b) {
        let aDate = new Date(a.updated).valueOf() || 0;
        let bDate = new Date(b.updated).valueOf() || 0;
        return aDate - bDate;
      })
      .reduce(async function (p, post) {
        await p;
        await PostModel._syncHook(post, lastSyncUp).catch(die);
      }, Promise.resolve());
  }

  init().catch(function (err) {
    console.error(err);
    window.alert(`Fatal Error: ${err.message}`);
  });
})();
