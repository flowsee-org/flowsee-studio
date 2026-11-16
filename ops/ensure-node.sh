#!/usr/bin/env bash
set -Eeuo pipefail
# Private Studio runtime: leave the system Node and other applications untouched.
VERSION=22.23.5
CHECKSUM=cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8
ROOT=/opt/flowsee-studio-runtime
TARGET="$ROOT/node-v$VERSION-linux-x64"
if [[ -x "$TARGET/bin/node" ]]; then printf '%s\n' "$TARGET/bin"; exit 0; fi
[[ $(uname -m) == x86_64 ]] || { echo 'Unsupported Studio runtime architecture.' >&2; exit 1; }
install -d -m 755 "$ROOT"
WORK=$(mktemp -d "$ROOT/.install.XXXXXX")
cleanup() { [[ $WORK == "$ROOT"/.install.* ]] && rm -rf -- "$WORK"; }
trap cleanup EXIT
ARCHIVE="node-v$VERSION-linux-x64.tar.xz"
curl --fail --silent --show-error --location --retry 2 --max-time 180 "https://nodejs.org/dist/v$VERSION/$ARCHIVE" -o "$WORK/$ARCHIVE"
printf '%s  %s\n' "$CHECKSUM" "$WORK/$ARCHIVE" | sha256sum --check --status
tar -xJf "$WORK/$ARCHIVE" -C "$WORK"
mv "$WORK/node-v$VERSION-linux-x64" "$TARGET"
printf '%s\n' "$TARGET/bin"
