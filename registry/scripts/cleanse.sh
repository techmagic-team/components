set -e
babel-node ./js/cleanse.js
rm -rf node_modules
rm -f package-lock.json
