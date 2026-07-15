#!/bin/bash
set -e

DOMAINS=("https://cbamvalid.com" "https://cbamvalid-prod--cbam-desk.europe-west4.hosted.app")

for DOMAIN in "${DOMAINS[@]}"; do
  echo "======================================"
  echo "TESTING DOMAIN: $DOMAIN"
  echo "======================================"

  echo "[1] GET /api/auth/csrf"
  curl -s -w "\nHTTP_STATUS: %{http_code}\nCONTENT_TYPE: %{content_type}\n\n" "$DOMAIN/api/auth/csrf"
  
  echo "[2] GET /api/auth/session without cookie"
  curl -s -w "\nHTTP_STATUS: %{http_code}\nCONTENT_TYPE: %{content_type}\n\n" "$DOMAIN/api/auth/session"
  
  echo "[3] POST /api/auth/session without CSRF"
  curl -X POST -s -w "\nHTTP_STATUS: %{http_code}\nCONTENT_TYPE: %{content_type}\n\n" "$DOMAIN/api/auth/session"
  
  echo "[4] POST /api/auth/session with valid CSRF and fake token"
  CSRF_RES=$(curl -s "$DOMAIN/api/auth/csrf")
  CSRF_TOKEN=$(echo $CSRF_RES | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)
  echo "Fetched CSRF: $CSRF_TOKEN"
  curl -X POST -s -w "\nHTTP_STATUS: %{http_code}\nCONTENT_TYPE: %{content_type}\n\n" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"idToken":"fake-jwt-token"}' \
    "$DOMAIN/api/auth/session"
done
