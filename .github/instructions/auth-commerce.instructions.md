---
applyTo: "app/api/auth/**/*.ts,app/api/checkout/**/*.ts,app/api/webhooks/**/*.ts,lib/auth/**/*.ts,lib/firebase/**/*.ts,lib/commerce/**/*.ts,functions/src/commerce/**/*.ts,firestore.rules"
---

Treat authentication, authorization, payment, ledger and entitlement code as release-critical.

- Keep privileged logic server-side and preserve strict user and tenant ownership checks.
- Verify session creation, expiry, revocation and logout behavior through the canonical server-session flow.
- Payment fulfilment requires verified event authenticity, environment, amount, currency, product mapping and user mapping.
- Webhook and seal requests must be idempotent. Replays must produce zero additional credit or use delta.
- Use atomic transactions for ledger, credit and entitlement mutations.
- A failed or blocked seal consumes zero uses; re-download consumes zero uses.
- Do not log credentials, tokens, full payment payloads or customer evidence.
- Changes require targeted auth/commerce tests, unauthorized-access tests and explicit failure-recovery coverage.
