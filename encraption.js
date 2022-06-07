var Encraption = {};

(function () {
  "use strict";

  let Encoding = window.Encoding;

  Encraption.importKeyBytes = async function importKey(keyU8) {
    let crypto = window.crypto;
    let usages = ["encrypt", "decrypt"];
    let extractable = false;

    return await crypto.subtle.importKey(
      "raw",
      keyU8,
      { name: "AES-CBC" },
      extractable,
      usages
    );
  };

  Encraption.importKey = async function importKey(key64) {
    let rawKey = Encoding.base64ToBuffer(key64);
    let key = await Encraption.importKeyBytes(rawKey);
    return key;
  };

  Encraption.importKey64 = Encraption.importKey;

  Encraption.encryptObj = async function encryptObj(obj, key) {
    var crypto = window.crypto;
    var ivLen = 16; // the IV is always 16 bytes

    function joinIvAndData(iv, data) {
      var buf = new Uint8Array(iv.length + data.length);
      Array.prototype.forEach.call(iv, function (byte, i) {
        buf[i] = byte;
      });
      Array.prototype.forEach.call(data, function (byte, i) {
        buf[ivLen + i] = byte;
      });
      return buf;
    }

    async function _encrypt(data, key) {
      // a public value that should be generated for changes each time
      var initializationVector = new Uint8Array(ivLen);

      crypto.getRandomValues(initializationVector);

      return await crypto.subtle
        .encrypt({ name: "AES-CBC", iv: initializationVector }, key, data)
        .then(function (encrypted) {
          var ciphered = joinIvAndData(
            initializationVector,
            new Uint8Array(encrypted)
          );

          var base64 = Encoding.bufferToBase64(ciphered);
          /*
            .replace(/\-/g, "+")
            .replace(/_/g, "/");
          while (base64.length % 4) {
            base64 += "=";
          }
          */
          return base64;
        });
    }
    //return _encrypt(Encoding.base64ToBuffer(b64), key);
    let u8 = new TextEncoder().encode(JSON.stringify(obj));
    return await _encrypt(u8, key);
  };

  Encraption.decrypt64 = async function decrypt64(b64, key) {
    var crypto = window.crypto;
    var ivLen = 16; // the IV is always 16 bytes

    function separateIvFromData(buf) {
      var iv = new Uint8Array(ivLen);
      var data = new Uint8Array(buf.length - ivLen);
      Array.prototype.forEach.call(buf, function (byte, i) {
        if (i < ivLen) {
          iv[i] = byte;
        } else {
          data[i - ivLen] = byte;
        }
      });
      return { iv: iv, data: data };
    }

    function _decrypt(buf, key) {
      var parts = separateIvFromData(buf);

      return crypto.subtle
        .decrypt({ name: "AES-CBC", iv: parts.iv }, key, parts.data)
        .then(function (decrypted) {
          var str = new TextDecoder().decode(new Uint8Array(decrypted));
          //var base64 = Encoding.bufferToBase64(new Uint8Array(decrypted));
          /*
            .replace(/\-/g, "+")
            .replace(/_/g, "/");
          while (base64.length % 4) {
            base64 += "=";
          }
          */
          return JSON.parse(str);
        });
    }
    return _decrypt(Encoding.base64ToBuffer(b64), key);
  };
})();
