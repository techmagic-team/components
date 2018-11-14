set -e
npm run cleanse --prefix ./registry
npm run clean
rm -rf node_modules
rm -f package-lock.json
