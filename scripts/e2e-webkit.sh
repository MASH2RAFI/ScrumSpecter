#!/usr/bin/env bash
# The whole end-to-end suite in WebKit (Safari's engine, which every iPhone browser uses), inside
# Playwright's own Docker image: for systems whose packages WebKit's build can't use (Arch, for
# one). Needs Docker. Extra arguments go to `playwright test` (e.g. a spec file, --grep).
# Usage: scripts/e2e-webkit.sh [playwright test arguments]
set -euo pipefail
VERSION=$(node -p 'require("@playwright/test/package.json").version')
docker run --rm --ipc=host --network host \
    -u "$(id -u):$(id -g)" -e HOME=/tmp -e E2E_BROWSER=webkit \
    -v "$PWD":/work -w /work \
    "mcr.microsoft.com/playwright:v$VERSION-noble" \
    npx playwright test "$@"
