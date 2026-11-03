#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
APP=/var/www/flowsee-studio
STATE=/var/lib/flowsee-studio-preview
DOMAIN=studio.flowsee.ir
[[ $EUID -eq 0 ]] || { echo 'Run this script as root on the Flowsee server.' >&2; exit 1; }
[[ -d "$APP/.git" && -d "$APP/node_modules" ]] || { echo 'Expected Studio repository or dependencies are missing.' >&2; exit 1; }
[[ -f "$APP/.flowsee-preview.vite.config.mjs" ]] || { echo 'The preview Vite configuration is missing; no files were changed.' >&2; exit 1; }
[[ -d "$STATE/dist" || -L "$STATE/dist" ]] || { echo 'The current Studio document root is missing; no files were changed.' >&2; exit 1; }
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  export NVM_DIR="${NVM_DIR:-/root/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then set +u; . "$NVM_DIR/nvm.sh"; set -u; fi
fi
for tool in git tar node npm curl; do command -v "$tool" >/dev/null || { echo "Missing required command: $tool" >&2; exit 1; }; done
git -C "$APP" fetch origin main
git -C "$APP" reset --hard origin/main
SHA=$(git -C "$APP" rev-parse origin/main)
[[ $SHA =~ ^[0-9a-f]{40}$ ]] || { echo 'Could not resolve origin/main.' >&2; exit 1; }
BUILD=$(mktemp -d "$STATE/.studio-build.XXXXXX")
OLD_TARGET=
cleanup() { rm -rf -- "$BUILD"; }
trap cleanup EXIT
mkdir "$BUILD/source"
git -C "$APP" archive "$SHA" | tar -x -C "$BUILD/source"
(
 cd "$BUILD/source"
 npm ci --no-audit --no-fund
)
(
 cd "$BUILD/source"
 VITE_MAIN_API_URL="https://flowsee.ir" npm run build -- --config "$BUILD/source/.flowsee-preview.vite.config.mjs" --outDir "$BUILD/dist" --emptyOutDir
)
[[ -s "$BUILD/dist/index.html" ]] || { echo 'Build output is incomplete.' >&2; exit 1; }
grep -R -q -F '/website-messages' "$BUILD/dist/assets" || { echo 'The built app does not contain the website messages route.' >&2; exit 1; }
grep -R -q -F '/site-content' "$BUILD/dist/assets" || { echo 'The built app does not contain the site content route.' >&2; exit 1; }
RELEASES="$STATE/releases"
RELEASE="$RELEASES/$SHA"
install -d -m 755 "$RELEASES"
if [[ -e "$RELEASE" ]]; then
 [[ -s "$RELEASE/index.html" ]] && grep -R -q -F '/website-messages' "$RELEASE/assets" && grep -R -q -F '/site-content' "$RELEASE/assets" || { echo 'Existing release failed validation.' >&2; exit 1; }
else mv "$BUILD/dist" "$RELEASE"; fi
if [[ -L "$STATE/dist" ]]; then OLD_TARGET=$(readlink -f "$STATE/dist"); else OLD_TARGET="$STATE/dist.rollback.$(date +%Y%m%d%H%M%S)"; mv "$STATE/dist" "$OLD_TARGET"; fi
ln -s "$RELEASE" "$STATE/dist.next"
mv -Tf "$STATE/dist.next" "$STATE/dist"
if ! curl --noproxy '*' --fail --silent --show-error --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/website-messages" >/dev/null; then
 rm -f "$STATE/dist"
 if [[ -n "$OLD_TARGET" && -d "$OLD_TARGET" ]]; then ln -s "$OLD_TARGET" "$STATE/dist"; fi
 echo 'Health check failed; previous Studio build was restored.' >&2
 exit 1
fi
printf 'Studio published: %s\nhttps://%s/website-messages\n' "$SHA" "$DOMAIN"
