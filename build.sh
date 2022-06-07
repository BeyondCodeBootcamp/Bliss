#!/bin/bash

set -u
set -e
set -x

# script dependencies
# webi sd

# TODO mvp.css
curl -fsSL https://unpkg.com/ajquery/ajquery.js -o deps/ajquery.js
curl -fsSL https://unpkg.com/xtz/xtz.js -o deps/xtz.js
curl -fsSL https://unpkg.com/@root/debounce -o deps/debouncer.js
curl -fsSL https://unpkg.com/@root/passphrase -o deps/passphrase.js

rm -- *.min.js

# create deps.xxxx.min.js
cat \
    deps/ajquery.js \
    deps/xtz.js \
    deps/debouncer.js \
    deps/passphrase.js \
    encoding.js \
    encraption.js \
    > deps.tmp.js

uglifyjs deps.tmp.js -o deps.min.js
rm deps.tmp.js
my_deps_sum="deps.$(shasum -b deps.min.js | cut -d' ' -f1).min.js"
mv deps.min.js "${my_deps_sum}"

# create app.xxxx.min.js
node genenv.js .env.prod
cat \
    env.js \
    deps/xtz.js \
    deps/debouncer.js \
    deps/passphrase.js \
    encoding.js \
    encraption.js \
    > deps.tmp.js

uglifyjs deps.tmp.js -o deps.min.js
rm deps.tmp.js
my_deps_sum="deps.$(shasum -b deps.min.js | cut -d' ' -f1).min.js"
mv deps.min.js "${my_deps_sum}"

sd -fms '<!-- DEV .* /DEV -->' '    <!-- DEV -->
    <!-- /DEV -->
' index.html
sd -fms '<!-- PROD .* /PROD -->' "    <!-- PROD -->
    <script src=\"${my_deps_sum}\"></script>
    <script src=\"${my_app_sum}\"></script>
    <!-- /PROD -->
" index.html
