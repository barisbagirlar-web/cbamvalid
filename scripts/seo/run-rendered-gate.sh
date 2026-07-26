#!/usr/bin/env bash
# Build, start Next on a free port, crawl all sitemap URLs, tear down.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${SEO_CRAWL_PORT:-3010}"
BASE="http://127.0.0.1:${PORT}"
LOG="$(mktemp -t seo-crawl-server.XXXXXX)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

echo "RENDERED_GATE: building..."
npm run build

echo "RENDERED_GATE: starting next on ${PORT}..."
npx next start --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

# Wait for ready
for i in $(seq 1 60); do
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

echo "RENDERED_GATE: crawling..."
SEO_CRAWL_BASE_URL="$BASE" npx tsx scripts/seo/crawl-rendered.ts
