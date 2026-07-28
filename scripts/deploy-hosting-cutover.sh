#!/usr/bin/env bash
# Deploy Firebase Hosting (frameworksBackend) and force Cloud Run traffic
# onto the newly created ssrcbamdesk revision.
#
# Firebase Frameworks often creates a new revision but leaves the hosting
# pin tag (fh-*) on an older revision. Without this cutover, cbamvalid.com
# keeps serving stale SSR HTML even after "Deploy complete".
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-cbam-desk}"
REGION="${FIREBASE_REGION:-europe-west1}"
SERVICE="${SSR_SERVICE:-ssrcbamdesk}"

echo "DEPLOY_SHA=$(git rev-parse HEAD)"
echo "PROJECT=$PROJECT REGION=$REGION SERVICE=$SERVICE"

firebase deploy --only hosting --project "$PROJECT" --non-interactive

LATEST="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format='value(status.latestCreatedRevisionName)')"

if [[ -z "$LATEST" ]]; then
  echo "ERROR: could not resolve latestCreatedRevisionName" >&2
  exit 1
fi

TAG="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format='value(status.traffic[0].tag)')"

echo "LATEST_REVISION=$LATEST"
echo "HOSTING_PIN_TAG=${TAG:-none}"

if [[ -n "$TAG" ]]; then
  gcloud run services update-traffic "$SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --to-revisions="${LATEST}=100" \
    --update-tags="${TAG}=${LATEST}"
else
  gcloud run services update-traffic "$SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --to-revisions="${LATEST}=100"
fi

echo "CUTOVER_COMPLETE revision=$LATEST tag=${TAG:-none}"
