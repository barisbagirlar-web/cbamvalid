# CBAMValid Final Revenue Acceptance

This document is a release evidence contract, not a declaration of readiness.

## Source acceptance

- [ ] Typecheck exit code 0
- [ ] Lint exit code 0
- [ ] Auth tests exit code 0
- [ ] Commerce tests exit code 0
- [ ] Calculation tests exit code 0
- [ ] Report/package tests exit code 0
- [ ] Production build exit code 0
- [ ] Trivy high/critical gate pass
- [ ] Production dependency audit pass
- [ ] Release truth guard pass

## Runtime acceptance

- [ ] Paddle environment explicitly identified
- [ ] Controlled real transaction ID recorded
- [ ] Verified `transaction.completed` event ID recorded
- [ ] Existing server order matched by UID, case, product, currency, amount and price ID
- [ ] Five case-bound entitlement IDs recorded
- [ ] Duplicate webhook replay changes entitlement count by 0
- [ ] One successful seal changes available versions from 5 to 4
- [ ] Blocked/failed seal changes available versions by 0
- [ ] Re-download changes available versions by 0
- [ ] Production release ID recorded
- [ ] ZIP has 23 required top-level components
- [ ] Every manifest-listed file SHA-256 and byte size verified
- [ ] Source SHA, deployment SHA and live build SHA match
- [ ] Browser E2E trace/video retained
- [ ] Production log query shows zero unhandled errors in the acceptance window

## Formal status rules

Use only `PASS`, `FAIL`, `NOT_PROVEN`, `NOT_IMPLEMENTED` or `EXTERNAL_BLOCKER`.

Identifiers containing `test`, `sandbox`, `fixture`, `mock` or `example` cannot prove a real production payment.

A source/build PASS is not a production revenue PASS. `REVENUE_RELEASE_READY=YES` is permitted only after every runtime acceptance item above is evidenced.
