#!/usr/bin/env bash
# Every check, one after another (the browser runs share ports, so never two at once):
#   types        TypeScript
#   lint         ESLint
#   chromium     the end-to-end suite in Chromium (next dev)
#   firefox      the same in Firefox
#   webkit       the same in WebKit, Safari's engine (Docker; skipped without it)
#   production   a production build, then the suite against it (dev mode has hidden bugs before)
#   screens      15 pages × 22 screen sizes in Chromium, forced dark and Firefox, then WebKit
# Usage: scripts/test-all.sh [stage ...]   (default: all, about two hours; detach it with setsid nohup)
# Logs, screenshots and summary.txt go to $TEST_OUT (default ~/.cache/scrumspecter-tests/<time>).
# Exits 1 if any stage failed.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=${TEST_OUT:-$HOME/.cache/scrumspecter-tests/$(date +%Y%m%d-%H%M%S)}
mkdir -p "$OUT"
failed=0

run() {
    local name=$1 start=$SECONDS result counts
    shift
    echo "▶ $name ($(date +%T))"
    if "$@" > "$OUT/$name.log" 2>&1; then result=PASS; else result=FAIL; failed=1; fi
    # The next stage wipes test-results: keep this one's failure traces and screenshots
    [ "$result" = FAIL ] && [ -d test-results ] && cp -r test-results "$OUT/$name-results"
    counts=$(grep -E "^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)" "$OUT/$name.log" | tr -s ' ' | paste -sd, -)
    printf "%-17s %s %5ss %s\n" "$name" "$result" "$((SECONDS - start))" "$counts" | tee -a "$OUT/summary.txt"
}

skip() { printf "%-17s SKIP  %s\n" "$1" "$2" | tee -a "$OUT/summary.txt"; }

docker_ok() { docker info > /dev/null 2>&1; }

for stage in ${*:-types lint chromium firefox webkit production screens}; do
    case $stage in
        types) run types npx tsc --noEmit ;;
        lint) run lint npm run lint ;;
        chromium) run chromium npx playwright test ;;
        firefox) run firefox env E2E_BROWSER=firefox npx playwright test ;;
        webkit) if docker_ok; then run webkit scripts/e2e-webkit.sh; else skip webkit "no Docker"; fi ;;
        production)
            # NEXT_PUBLIC_* values are baked in at build time: the test server's URL and its
            # test-only VAPID public key (kept in playwright.config.ts)
            key=$(grep -oP 'NEXT_PUBLIC_VAPID_PUBLIC_KEY: "\K[^"]+' playwright.config.ts)
            run production-build env NEXT_DIST_DIR=.next-build NEXT_PUBLIC_APP_URL=http://localhost:3100 \
                NEXT_PUBLIC_VAPID_PUBLIC_KEY="$key" npx next build
            if grep -q "production-build *PASS" "$OUT/summary.txt"; then
                run production env E2E_PROD=1 npx playwright test
            fi
            rm -rf .next-build
            ;;
        screens)
            run screens env COMPAT="$OUT/screens" COMPAT_BROWSERS=chromium,chromium-forcedark,firefox npx playwright test e2e/compat.spec.ts
            if docker_ok; then run screens-webkit scripts/compat-webkit.sh "$OUT/screens-webkit"; else skip screens-webkit "no Docker"; fi
            ;;
        *) echo "Unknown stage: $stage" >&2; exit 2 ;;
    esac
done

echo "Summary in $OUT/summary.txt"
exit $failed
