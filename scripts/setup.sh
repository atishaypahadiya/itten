#!/usr/bin/env bash
# Run once after cloning. Links .itten-private-terms, the patterns the public
# hygiene check in scripts/check.js reads, to the list every specialist on this
# machine shares: ~/.config/specialists/private-terms. The patterns match
# claims of authorship, and the few names the list marks "subject ", which a
# repository that uses them may allow in .private-terms-allow. Neither file is
# ever committed: the link is ignored by git and the shared list lives outside
# every repository.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
link=".itten-private-terms"
shared="$HOME/.config/specialists/private-terms"

if ! git check-ignore -q "$link"; then
  echo "setup: $link is not ignored by git; add it to .gitignore first" >&2
  exit 1
fi

# The shared list: made from this repository's own list if there is one and no
# shared list yet, otherwise empty, with a warning.
if [[ ! -e "$shared" ]]; then
  mkdir -p "$(dirname "$shared")"
  if [[ -f "$link" && ! -L "$link" ]]; then
    cp "$link" "$shared"
    echo "setup: created $shared from $link"
  else
    : > "$shared"
    echo "setup: warning: created an empty $shared; add authorship patterns to it, or the hygiene check has nothing to look for" >&2
  fi
fi

if [[ -L "$link" && "$(readlink "$link")" == "$shared" ]]; then
  echo "setup: $link already links to $shared"
else
  if [[ -f "$link" && ! -L "$link" ]]; then
    # A list of this repository's own: kept, privately, in dist/ (ignored).
    backup="dist/private-terms/itten-private-terms.$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$(dirname "$backup")"
    mv "$link" "$backup"
    echo "setup: moved the old $link to $backup"
  else
    rm -f "$link"
  fi
  ln -s "$shared" "$link"
  echo "setup: $link -> $shared"
fi

if [[ ! -s "$shared" ]]; then
  echo "setup: warning: $shared is empty; the hygiene check has nothing to look for" >&2
fi
