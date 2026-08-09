#!/usr/bin/env bash
# Build (unless already built), start Next on a free port, crawl critical/sitemap URLs,
# prove browser-hydrated parity by default, then tear down.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${SEO_CRAWL_PORT:-3010}"
BASE="http://127.0.0.1:${PORT}"
LOG="$(mktemp -t seo-crawl-server.XXXXXX)"
BROWSER_MODE="${SEO_RENDER_BROWSER:-1}"

if [[ "$BROWSER_MODE" != "0" && "$BROWSER_MODE" != "1" ]]; then
  echo "RENDERED_GATE: SEO_RENDER_BROWSER must be 0 or 1, got '$BROWSER_MODE'" >&2
  exit 4
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

if [[ "${SEO_SKIP_BUILD:-0}" == "1" ]]; then
  if [[ ! -d .next ]]; then
    echo "RENDERED_GATE: SEO_SKIP_BUILD=1 but .next is missing" >&2
    exit 4
  fi
  echo "RENDERED_GATE: reusing exact-head production build"
else
  echo "RENDERED_GATE: building..."
  npm run build
fi

if [[ "$BROWSER_MODE" == "1" ]]; then
  echo "RENDERED_GATE: ensuring Chromium runtime is installed..."
  npx playwright install --with-deps chromium
fi

echo "RENDERED_GATE: starting next on ${PORT}..."
npx next start --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "$BASE/" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server died during boot:" >&2
    cat "$LOG" >&2
    exit 2
  fi
  sleep 1
done

if ! curl -sf "$BASE/" >/dev/null 2>&1; then
  echo "Server did not become ready:" >&2
  cat "$LOG" >&2
  exit 2
fi

echo "RENDERED_GATE: crawling; browser=${BROWSER_MODE}"
SEO_CRAWL_BASE_URL="$BASE" SEO_RENDER_BROWSER="$BROWSER_MODE" npx tsx scripts/seo/crawl-rendered.ts
