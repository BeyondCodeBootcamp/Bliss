var CC = {};
window.CC = CC;

(function () {
  "use strict";
  var sep = " ";

  // from env.js
  let ENV = window.ENV;

  // scheme => 'https:'
  // host => 'localhost:3000'
  // pathname => '/api/authn/session/oidc/google.com'
  //let baseUrl = document.location.protocol + "//" + document.location.host;
  let baseUrl = ENV.BASE_API_URL;

  // 4242-4242-4242-4242
  function formatVisa(digits, pos) {
    var all = "";
    all += digits.slice(0, 4);
    if (all.length < 4) {
      return [all, pos];
    }
    if (pos >= all.length) {
      pos += 1;
    }
    all += sep;

    all += digits.slice(4, 8);
    if (all.length < 9) {
      return [all, pos];
    }
    if (pos >= all.length) {
      pos += 1;
    }
    all += sep;

    all += digits.slice(8, 12);
    if (all.length < 14) {
      return [all, pos];
    }
    if (pos >= all.length) {
      pos += 1;
    }
    all += sep;

    all += digits.slice(12);
    return [all, pos];
  }

  // 37xx-654321-54321
  function formatAmex(digits, pos) {
    var all = "";
    all += digits.slice(0, 4);
    if (all.length < 4) {
      return [all, pos];
    }
    if (pos >= all.length) {
      pos += 1;
    }
    all += sep;

    all += digits.slice(4, 10);
    if (all.length < 11) {
      return [all, pos];
    }
    if (pos >= all.length) {
      pos += 1;
    }
    all += sep;

    all += digits.slice(10);
    return [all, pos];
  }

  CC.formatCardDigits = function (ev) {
    // TODO handle backspace
    var $cc = ev.target;
    var digits = $cc.value;
    var pos = $cc.selectionStart;
    // 1: 4242-4242-42|
    // 2: 4242-424|2-42 // 8
    // 3: 4242-4244|2-42 // 9
    // 4: 4242-4244-|242 // 10

    // check the character before the cursor
    // (ostensibly the character that was just typed)
    // assuming a left-to-right writing system
    // 4242-|
    if (!/[0-9]/.test(ev.key)) {
      return;
    }

    var parts = CC._formatCardDigits(digits, pos);
    $cc.value = parts[0];
    $cc.selectionStart = parts[1];
    $cc.selectionEnd = $cc.selectionStart;
  };

  CC._formatCardDigits = function (raw, pos = 0) {
    var digits = "";

    // rework position
    var j = pos;
    var i;
    for (i = 0; i < raw.length; i += 1) {
      if (raw[i].match(/[0-9]/)) {
        digits += raw[i];
        continue;
      }
      if (i < j) {
        pos -= 1;
      }
    }

    // https://stevemorse.org/ssn/List_of_Bank_Identification_Numbers.html
    //var reVisa = /^4/;
    //var reMastercard = /^5[1-5]/;
    var reAmex = /^37/;
    var parts;
    if (reAmex.test(digits)) {
      parts = formatAmex(digits, pos);
    } else {
      parts = formatVisa(digits, pos);
    }
    return parts;
  };

  CC.pay = async function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    var $payForm = ev.target;
    var $digits = $payForm.querySelector('[name="cc-digits"]');
    var card = {
      name: $payForm.querySelector('[name="cc-name"]').value,
      email: $payForm.querySelector('[name="cc-email"]').value,
      digits: CC._formatCardDigits($digits.value)[0],
      mm: $payForm.querySelector('[name="cc-mm"]').value,
      yyyy: $payForm.querySelector('[name="cc-yyyy"]').value,
      code: $payForm.querySelector('[name="cc-code"]').value,
    };

    $digits.value = card.digits;

    await CC._pay(card)
      .then(async function (resp) {
        console.log(resp);
        window.alert("Thanks!");
      })
      .catch(function (err) {
        console.error(err);
        window.alert("Oops! Trouble! (see console)");
      });
  };
  CC._pay = async function (card) {
    let resp = await window
      .fetch(baseUrl + "/api/pay/FAIL", {
        method: "POST",
        body: JSON.stringify(card),
        headers: {
          //Authorization: query.access_token,
          "Content-Type": "application/json",
        },
      })
      .then(async function (resp) {
        let body = await resp.json();
        resp.data = body;
        if (!resp.ok) {
          let err = new Error(body.message || "unknown error");
          err.code = body.code;
          err.status = body.status;
          err.detail = body.detail;
          err.response = resp;
          throw err;
        }
        return resp;
      });
    return resp;
  };
})();
