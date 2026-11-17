#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
APP=/var/www/flowsee-studio
STATE=/var/lib/flowsee-studio-preview
DOMAIN=studio.flowsee.ir
[[ $EUID -eq 0 ]] || { echo 'Run this script as root on the Flowsee server.' >&2; exit 1; }
[[ -d "$APP/.git" ]] || { echo 'Studio checkout is missing.' >&2; exit 1; }
RUNTIME_BIN=$(bash "$APP/ops/ensure-node.sh")
export PATH="$RUNTIME_BIN:$PATH"
for tool in git tar node npm curl; do command -v "$tool" >/dev/null || { echo "Missing: $tool" >&2; exit 1; }; done
SHA=$(git -C "$APP" rev-parse HEAD)
[[ $SHA =~ ^[0-9a-f]{40}$ ]] || exit 1
install -d -m 755 "$STATE/releases"
BUILD=$(mktemp -d "$STATE/.studio-build.XXXXXX")
# Only the temporary directory created by this invocation is removed.
cleanup() { [[ $BUILD == "$STATE"/.studio-build.* ]] && rm -rf -- "$BUILD"; }
trap cleanup EXIT
mkdir "$BUILD/source"
git -C "$APP" archive "$SHA" | tar -x -C "$BUILD/source"
(
 cd "$BUILD/source"
 npm ci --no-audit --no-fund
 VITE_MAIN_API_URL=https://flowsee.ir npm run build -- --outDir "$BUILD/dist" --emptyOutDir
)
[[ -s "$BUILD/dist/index.html" ]] || { echo 'Build output is incomplete.' >&2; exit 1; }
grep -R -q -F '/website-messages' "$BUILD/dist/assets"
grep -R -q -F '/site-content' "$BUILD/dist/assets"
# Authentication must be available before publishing the frontend.
bash "$APP/ops/ensure-api.sh"
RELEASE="$STATE/releases/$SHA"
if [[ -e "$RELEASE" ]]; then
 [[ -s "$RELEASE/index.html" ]] || { echo 'Invalid existing release.' >&2; exit 1; }
else
 mv "$BUILD/dist" "$RELEASE"
fi
OLD_TARGET=
if [[ -L "$STATE/dist" ]]; then
 OLD_TARGET=$(readlink -f "$STATE/dist")
elif [[ -d "$STATE/dist" ]]; then
 OLD_TARGET="$STATE/dist.rollback.$(date +%Y%m%d%H%M%S)"
 mv "$STATE/dist" "$OLD_TARGET"
fi
ln -s "$RELEASE" "$STATE/dist.next"
mv -Tf "$STATE/dist.next" "$STATE/dist"
# Nginx and the Node fallback serve the same release.
if [[ ! -L "$APP/dist" || $(readlink -f "$APP/dist") != "$RELEASE" ]]; then
 if [[ -e "$APP/dist" || -L "$APP/dist" ]]; then mv "$APP/dist" "$STATE/dist.original.$(date +%Y%m%d%H%M%S)"; fi
 ln -s "$STATE/dist" "$APP/dist"
fi
if ! curl --noproxy '*' --fail --silent --show-error --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" | grep -q '"status":"ok"'; then
 rm -f "$STATE/dist"
 [[ -z "$OLD_TARGET" ]] || ln -s "$OLD_TARGET" "$STATE/dist"
 echo 'Public API health check failed; previous frontend was restored.' >&2
 exit 1
fi
curl --noproxy '*' --fail --silent --show-error --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/login" >/dev/null
printf 'Studio frontend and API published: %s\n' "$SHA"
