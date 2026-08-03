#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="${FIREBASE_PROJECT:-cbam-desk}"
LIVE_URL="${LIVE_BASE_URL:-https://cbamvalid.com}"

echo "PROJECT=$PROJECT"
echo "LIVE_URL=$LIVE_URL"
echo "DEPLOY_SHA=$(git rev-parse HEAD)"

FIREBASE_PROJECT="$PROJECT" LIVE_BASE_URL="$LIVE_URL" \
  bash scripts/deploy-hosting-cutover.sh

LIVE_BASE_URL="$LIVE_URL" node scripts/verify-live-checkout-release.mjs

GCLOUD_PROJECT="$PROJECT" npx tsx scripts/cleanup-teb232-obsolete-iskenderun-case.ts
EXECUTE=1 GCLOUD_PROJECT="$PROJECT" npx tsx scripts/cleanup-teb232-obsolete-iskenderun-case.ts

echo "TEB232_CHECKOUT_RELEASE=PASS"
echo "DEPLOYED_SHA=$(git rev-parse HEAD)"
