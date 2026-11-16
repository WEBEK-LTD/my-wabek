#!/usr/bin/env bash
# Build the WABEK WHMCS addon download:
#   public/downloads/wabek-whmcs-addon.zip
# containing modules/addons/wabek/ (upload into the WHMCS root) plus README.md
# and CHANGELOG.md. Lints every PHP file first when php is available.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$REPO/public/downloads/wabek-whmcs-addon.zip"

cd "$HERE"

if command -v php >/dev/null 2>&1; then
  echo "Linting PHP ($(php -r 'echo PHP_VERSION;'))..."
  while IFS= read -r -d '' f; do
    php -l "$f" >/dev/null || { echo "Lint failed: $f" >&2; exit 1; }
  done < <(find modules -name '*.php' -print0)
else
  echo "php not found: skipping lint" >&2
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/wabek-whmcs-addon"
cp -R modules "$TMP/wabek-whmcs-addon/"
cp README.md CHANGELOG.md "$TMP/wabek-whmcs-addon/"
find "$TMP" \( -name '.DS_Store' -o -name '*.swp' -o -name '*~' \) -delete

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
# Stable timestamps so rebuilding unchanged sources gives the same archive.
find "$TMP/wabek-whmcs-addon" -exec touch -h -t 202601010000 {} +
if command -v zip >/dev/null 2>&1; then
  (cd "$TMP" && find wabek-whmcs-addon -print | LC_ALL=C sort | zip -X -q "$OUT" -@)
else
  python3 - "$TMP" "$OUT" <<'PY'
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in sorted(os.walk(root)):
        dirs.sort()
        for name in sorted(files):
            path = os.path.join(base, name)
            arc = os.path.relpath(path, root)
            info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(path, 'rb') as fh:
                z.writestr(info, fh.read())
PY
fi

echo "Built $OUT"
if command -v unzip >/dev/null 2>&1; then
  unzip -l "$OUT" | tail -n 1
fi
