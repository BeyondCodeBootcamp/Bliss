var Encoding = {};

(function () {
  "use strict";

  Encoding.base64ToBuffer = function (b64) {
    let binstr = atob(b64);
    let arr = binstr.split("").map(function (ch) {
      return ch.charCodeAt();
    });
    return Uint8Array.from(arr);
  };

  Encoding.bufferToBase64 = function (buf) {
    var binstr = buf
      .reduce(function (arr, ch) {
        arr.push(String.fromCharCode(ch));
        return arr;
      }, [])
      .join("");
    return btoa(binstr);
  };
})();
