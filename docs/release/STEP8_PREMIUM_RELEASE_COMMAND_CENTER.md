# Step 8 Premium Release Command Center

## Objective

Make the final working-file release action explicit, observable, retryable and server-authoritative without weakening any readiness, entitlement, payment, idempotency or package-integrity gate.

## Root causes corrected

1. Cached case data could mount the actionable wizard before the authoritative server case and entitlement response arrived.
2. A cached entitlement row without a usable server identifier could advertise a release-ready state.
3. Package creation feedback was rendered below the fold, making a valid click appear inert.
4. A failed seal attempt was treated like an unresolved-readiness state instead of a retryable operation failure.
5. Optional empty Step 7 data could leave an otherwise complete workflow marked in progress.
6. Independent verification was visually presented as a pending package-creation gate although it is a post-release activity.

## Release-state contract

- `BLOCKED`: show the exact remediation action; do not consume payment or release capacity.
- `PAYMENT_REQUIRED`: route to the case-bound authorization flow.
- `READY_TO_LOCK`: show one prominent `Create sealed package` action.
- `LOCKING`: show immediate validate/create/open progress and prevent duplicate clicks.
- `LOCK_FAILED`: retain the draft, expose the technical reason and provide an idempotent retry.
- `LOCKED`: open the immutable release and download surface.

## Safety boundaries

- Server readiness remains authoritative.
- Server entitlement identity is required before advertising release readiness.
- Existing request identifiers remain the duplicate-action boundary.
- No client-only success state can create or consume a release.
- No schema, payment, ledger or database migration is introduced.

## Validation

Required before merge:

- targeted Step 8 regression contracts
- typecheck and lint
- Cloud Functions build
- authentication, integration, commerce, CBAM-engine and report suites
- production Next.js build
- PR security, workflow-integrity and regression checks

## Rollback

Revert the Step 8 implementation commit. No persisted data transformation or irreversible external operation is part of this change.
