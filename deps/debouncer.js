var Debouncer;

(function () {
  "use strict";

  // should work with browser, node, ...and maybe even webpack?
  if ("undefined" !== typeof module) {
    Debouncer = module.exports;
  } else {
    Debouncer = {};
    window.Debouncer = Debouncer;
  }

  Debouncer.create = function _debounce(fn, delay) {
    let state = { running: false, _timer: null, _promise: null };

    function rePromise() {
      // all three of these should be set synchronously
      state._promise = {};
      state._promise.promise = new Promise(function (resolve, reject) {
        state._promise.resolve = resolve;
        state._promise.reject = reject;
      });
      return state._promise;
    }

    rePromise();

    let err = new Error("debounce");
    return async function _debounce() {
      let args = Array.prototype.slice.call(arguments);
      if (state.running) {
        throw err;
      }

      let pInfo = state._promise;
      if (state._timer) {
        clearTimeout(state._timer);
        pInfo.reject(err);
        pInfo = rePromise();
      }

      state._timer = setTimeout(function () {
        state.running = true;
        state._timer = null;
        rePromise();

        fn.apply(null, args)
          .then(function (result) {
            state.running = false;
            pInfo.resolve(result);
          })
          .catch(function (err) {
            state.running = false;
            pInfo.reject(err);
          });
      }, delay);

      return pInfo.promise;
    };
  };
})();
