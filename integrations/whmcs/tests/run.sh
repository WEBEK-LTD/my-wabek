#!/usr/bin/env bash
# WABEK for WHMCS — theme render check + screenshots, without a WHMCS install.
#
#   integrations/whmcs/tests/run.sh [WORKDIR]   (default: $TMPDIR/wabek-theme-test)
#
# Fetches Bootstrap 3.4.1 / 4.6.2 (npm pack) and Smarty 3.1 (composer, if
# available) into WORKDIR — never into the repository — renders every
# template into simulated six / Lagom 1 / twenty-one / Lagom 2 (light, dark)
# pages in LTR and RTL, then screenshots them with Playwright at 390px and
# 1280px. Pages and screenshots stay in WORKDIR.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${1:-${TMPDIR:-/tmp}/wabek-theme-test}"
mkdir -p "$WORK"

for v in 3.4.1 4.6.2; do
  if [ ! -f "$WORK/bootstrap-$v/package/dist/css/bootstrap.min.css" ]; then
    (cd "$WORK" && npm pack --silent "bootstrap@$v" >/dev/null)
    mkdir -p "$WORK/bootstrap-$v"
    tar xzf "$WORK/bootstrap-$v.tgz" -C "$WORK/bootstrap-$v"
  fi
done

SMARTY_ARG=()
if command -v composer >/dev/null 2>&1; then
  if [ ! -f "$WORK/smarty/vendor/autoload.php" ]; then
    mkdir -p "$WORK/smarty"
    (cd "$WORK/smarty" && composer require --no-interaction --quiet "smarty/smarty:^3.1") || true
  fi
  [ -f "$WORK/smarty/vendor/autoload.php" ] && SMARTY_ARG=("--smarty=$WORK/smarty/vendor/autoload.php")
fi

php "$HERE/render-check.php" --out="$WORK/pages" "${SMARTY_ARG[@]}" \
  --bs3="$WORK/bootstrap-3.4.1/package/dist/css/bootstrap.min.css" \
  --bs4="$WORK/bootstrap-4.6.2/package/dist/css/bootstrap.min.css"

node "$HERE/screenshot.mjs" "$WORK/pages" "$WORK/shots"
