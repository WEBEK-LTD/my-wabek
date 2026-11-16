#!/usr/bin/env bash
# Builds public/downloads/wabek-wordpress-plugin.zip from
# integrations/wordpress/wabek-whatsapp (replaces the previous zip).
#
# Steps: php -l on every PHP file (when php is available), compile the .po
# translations to .mo, then zip the plugin folder.
#
# Usage:  integrations/wordpress/build.sh
# To refresh the translation template first:
#         php integrations/wordpress/tools/make-pot.php integrations/wordpress/wabek-whatsapp
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SLUG="wabek-whatsapp"
SRC="$HERE/$SLUG"
OUT="$ROOT/public/downloads/wabek-wordpress-plugin.zip"

[ -f "$SRC/$SLUG.php" ] || { echo "Plugin not found at $SRC" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

if command -v php >/dev/null; then
  echo "Linting PHP ($(php -r 'echo PHP_VERSION;'))…"
  while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null || { echo "Syntax error in $file" >&2; exit 1; }
  done < <(find "$SRC" -name '*.php' -print0)

  for po in "$SRC"/languages/*.po; do
    [ -e "$po" ] || continue
    if command -v msgfmt >/dev/null; then
      msgfmt --check -o "${po%.po}.mo" "$po"
    else
      php "$HERE/tools/po2mo.php" "$po" "${po%.po}.mo" >/dev/null
    fi
  done
else
  echo "php not found: skipping lint and .mo compilation (committed .mo files are used)." >&2
fi

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$SRC" "$TMP/$SLUG"
find "$TMP/$SLUG" \( -name '.DS_Store' -o -name '*.orig' -o -name '*.rej' -o -name '*~' \) -delete

rm -f "$OUT"
(cd "$TMP" && zip -r -X -q "$OUT" "$SLUG")
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
