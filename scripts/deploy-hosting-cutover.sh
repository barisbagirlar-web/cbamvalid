#!/usr/bin/env bash
# Deploy Firebase Framework-Aware Hosting as one atomic HTML/SSR/static-asset
# release. Do not alter Cloud Run traffic after Firebase completes the deploy:
# the Hosting release, backend pin and generated Next.js chunk set must stay
# bound to the same deployment.
set -Eeuo pipefail

PROJECT="${FIREBASE_PROJECT:-cbam-desk}"
LIVE_URL="${LIVE_BASE_URL:-https://cbamvalid.com}"
DEPLOY_SHA="$(git rev-parse HEAD)"
# The global `firebase` binary is a firepit snapshot whose embedded npm fails to
# spawn child processes (EAGAIN) on this machine; `npx firebase-tools` runs the
# same CLI on the system npm, which is what CI uses.
FIREBASE_CMD="${FIREBASE_CMD:-npx --yes firebase-tools@15.16.0}"

echo "DEPLOY_SHA=$DEPLOY_SHA"
echo "PROJECT=$PROJECT"
echo "LIVE_URL=$LIVE_URL"

echo "HOSTING_RELEASE_MODE=FIREBASE_ATOMIC"
echo "MANUAL_CLOUD_RUN_TRAFFIC_MUTATION=DISABLED"

# Firebase owns the frameworksBackend revision pin and uploads the matching
# _next/static payload in the same Hosting release. A later gcloud traffic
# mutation can make HTML reference chunks that do not exist in that release.
$FIREBASE_CMD deploy --only hosting --project "$PROJECT" --non-interactive

# A deploy is not accepted merely because the CLI exited zero. Fetch fresh HTML,
# enumerate every referenced Next.js JS/CSS asset, and require HTTP 200 with the
# executable stylesheet/script MIME type. This catches stale SSR pinning,
# incomplete CDN releases and HTML/chunk generation mismatches immediately.
LIVE_BASE_URL="$LIVE_URL" node scripts/verify-live-next-assets.mjs "$LIVE_URL"

echo "HOSTING_DEPLOY=PASS"
echo "LIVE_NEXT_ASSET_INTEGRITY=PASS"
echo "DEPLOYED_SHA=$DEPLOY_SHA"
