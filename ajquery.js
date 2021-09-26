/*jshint ignore:start*/
function $(sel, el) {
  return (el || document).querySelector(sel);
}

function $$(sel, el) {
  return (el || document).querySelectorAll(sel);
}
/*jshint ignore:end*/
