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
export CBAM_RELEASE_SHA="${CBAM_RELEASE_SHA:-$(git rev-parse HEAD)}"
: "${SUPER_ADMIN_UID:?SUPER_ADMIN_UID is required for canonical owner authorization}"

if [[ ! "${CBAM_RELEASE_SHA}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "ERROR: CBAM_RELEASE_SHA must be a full 40-character commit SHA" >&2
  exit 1
fi

echo "DEPLOY_SHA=${CBAM_RELEASE_SHA}"
echo "PROJECT=$PROJECT REGION=$REGION SERVICE=$SERVICE"

firebase deploy --only hosting --project "$PROJECT" --non-interactive

# Firebase framework deployments can inherit stale plaintext environment values
# from an older Cloud Run revision. Re-assert the non-secret owner identity and
# remove the retired third-party key before selecting the release revision.
gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-env-vars="SUPER_ADMIN_UID=${SUPER_ADMIN_UID}" \
  --remove-env-vars="ANTHROPIC_API_KEY" \
  --quiet

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

LIVE_SHA="$(curl -fsS "https://cbamvalid.com/api/release" | node -e '
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const parsed = JSON.parse(body);
    if (parsed.status !== "PASS" || !/^[a-f0-9]{40}$/.test(parsed.commitSha || "")) {
      process.exit(1);
    }
    process.stdout.write(parsed.commitSha);
  });
')"
if [[ "${LIVE_SHA}" != "${CBAM_RELEASE_SHA}" ]]; then
  echo "ERROR: live SHA ${LIVE_SHA} does not match deployed SHA ${CBAM_RELEASE_SHA}" >&2
  exit 1
fi

echo "LIVE_SHA=${LIVE_SHA}"
echo "CUTOVER_COMPLETE revision=$LATEST tag=${TAG:-none}"
