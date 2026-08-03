Run from the approved release SHA:

FIREBASE_PROJECT=cbam-desk LIVE_BASE_URL=https://cbamvalid.com bash scripts/release-teb232-checkout-fix.sh

Do not accept the release unless the script prints:
LIVE_CHECKOUT_RELEASE_CSP=PASS
TEB232_OBSOLETE_ISKENDERUN_CLEANUP=PASS
TEB232_CHECKOUT_RELEASE=PASS
