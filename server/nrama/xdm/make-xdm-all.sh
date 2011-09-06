#! /bin/bash

cat jquery.min.js >xdm-all.js
echo '' >>xdm-all.js
cat db.ex-kanso.js | jsmin  >>xdm-all.js
echo '' >>xdm-all.js
cat session.ex-kanso.js | jsmin >>xdm-all.js
echo '' >>xdm-all.js
cat easyXDM.min.js >>xdm-all.js
echo '' >>xdm-all.js
uglifyjs provider.js >>xdm-all.js
