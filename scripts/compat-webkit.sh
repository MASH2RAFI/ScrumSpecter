#!/usr/bin/env bash
# The screen × browser check (e2e/compat.spec.ts) in WebKit, Safari's engine (every iPhone browser
# uses it), inside Playwright's own Docker image: for systems whose packages WebKit's build can't
# use (Arch, for one). Needs Docker. Screenshots and report.json land in the folder given.
# Usage: [COMPAT_SIZES=phone-320,...] scripts/compat-webkit.sh /path/to/output
set -euo pipefail
OUT=$(realpath -m "${1:?usage: scripts/compat-webkit.sh /path/to/output}")
mkdir -p "$OUT"
VERSION=$(node -p 'require("@playwright/test/package.json").version')
docker run --rm --ipc=host --network host \
    -u "$(id -u):$(id -g)" -e HOME=/tmp -e COMPAT_SIZES="${COMPAT_SIZES:-}" \
    -v "$PWD":/work -v "$OUT":/out -w /work \
    "mcr.microsoft.com/playwright:v$VERSION-noble" \
    bash -c "COMPAT=/out COMPAT_BROWSERS=webkit npx playwright test e2e/compat.spec.ts"
