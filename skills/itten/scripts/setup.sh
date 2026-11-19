#!/usr/bin/env bash
# ITTEN's setup, once per install of this skill. Installs exactly what this
# folder's lockfile pins, and nothing else:
#   - npm ci: the packages in package-lock.json (Playwright, at the version the
#     lockfile names) into node_modules/ in this folder;
#   - Playwright's own installer, from that node_modules/: the Chromium and
#     WebKit builds this Playwright version pins, into Playwright's browser cache.
# Without --yes it prints that list and installs nothing, so the user can agree
# first. No script is fetched from the network and piped into a shell, and
# nothing is installed globally.
#
# Usage: bash scripts/setup.sh [--yes]
# Exit codes: 0 done (or the list printed), 1 a step failed, 64 bad usage.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
yes=0
for a in "$@"; do
  case "$a" in
    --yes) yes=1 ;;
    -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "setup: unknown argument \"$a\" (usage: bash scripts/setup.sh [--yes])" >&2; exit 64 ;;
  esac
done

pw="$(node -e 'const l=require(process.argv[1]); const p=l.packages["node_modules/playwright"]; process.stdout.write(p ? p.version : "")' "$here/package-lock.json" 2>/dev/null || true)"
case "$(uname -s)" in
  Darwin) cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}" ;;
  *) cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" ;;
esac

echo "ITTEN setup installs:"
echo "  1. npm packages pinned in $here/package-lock.json (Playwright ${pw:-?}), into $here/node_modules"
echo "  2. the Chromium and WebKit builds Playwright ${pw:-?} pins, into $cache (about 600 MB together)"
if [[ "$yes" != 1 ]]; then
  echo "Nothing installed. Run again with --yes once the user agrees."
  exit 0
fi

command -v node >/dev/null || { echo "setup: Node 20 or later is needed, and node is not on PATH" >&2; exit 1; }
major="$(node -p 'process.versions.node.split(".")[0]')"
if (( major < 20 )); then echo "setup: Node 20 or later is needed; this is Node $(node -v)" >&2; exit 1; fi
command -v npm >/dev/null || { echo "setup: npm is needed, and it is not on PATH" >&2; exit 1; }
[[ -n "$pw" ]] || { echo "setup: $here/package-lock.json does not pin playwright" >&2; exit 1; }

cd "$here"
# --ignore-scripts: no package's install script runs. --include=dev: Playwright
# is a devDependency of ITTEN's package.json.
npm ci --include=dev --ignore-scripts --no-audit --no-fund
installed="$(node -p 'require("./node_modules/playwright/package.json").version')"
[[ "$installed" == "$pw" ]] || { echo "setup: npm installed Playwright $installed, not the $pw the lockfile pins" >&2; exit 1; }
./node_modules/.bin/playwright install chromium webkit
echo "ITTEN setup done: Playwright $installed, Chromium and WebKit."
