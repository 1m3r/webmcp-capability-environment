#!/usr/bin/env bash
# Redeploy Mirror to GitHub Pages.
#
# Pages serves the `gh-pages` branch at its root, and that branch is playertwo/
# split out of this one — so the live URL is clean rather than /playertwo/, and
# nothing about the repo layout has to bend to the host.
#
#   https://1m3r.github.io/webmcp-capability-environment/
#
# The tests run first. A deploy is the one place where "it probably still works"
# is not good enough, and this bundle has already shipped one defect that every
# passing test missed.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ tests"
node --test 'playertwo/tests/*.test.js'

echo "→ splitting playertwo/ onto gh-pages"
git branch -D gh-pages 2>/dev/null || true
git subtree split --prefix playertwo -b gh-pages >/dev/null

echo "→ pushing"
git push origin gh-pages --force-with-lease

echo "✓ https://1m3r.github.io/webmcp-capability-environment/"
echo "  Pages takes ~30s to rebuild. Verify with:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' https://1m3r.github.io/webmcp-capability-environment/"
