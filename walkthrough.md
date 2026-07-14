# Sealing & Entitlement Correctness Walkthrough (Phases 1-5, 7)

This walkthrough documents the design, implementation, and verification of the CBAM Sealing Runtime, Evidence Validation, and 5-Release Commercial Entitlement workflows.

## Overview of Completed Work

### 1. Sealing Runtime Correctness (Phase 1)
- **Authoritative Case Loading**: Modified the Firebase Cloud Function callable `sealCbamReport` in [reports.ts](file:///Users/macair1/projects/cbam-paddle-app/functions/src/handlers/reports.ts) to resolve and load the case snapshot from the server-side database (`cbam_cases`) using `auth.uid` ownership checks, rather than relying on browser-asserted data.
- **Strict Schema Validation**: Integrated `AuditReadyCaseSchema` safely inside the sealing handler [seal-service.ts](file:///Users/macair1/projects/cbam-paddle-app/functions/src/cbam/report/seal-service.ts) to parse incoming database records and prevent dynamic `any` type poisoning.

### 2. Elimination of User-Controlled Verification (Phase 2)
- **Client Sanitization**: Implemented server-side data sanitization inside [case-repository.ts](file:///Users/macair1/projects/cbam-paddle-app/functions/src/cbam/storage/case-repository.ts) during all case creations or updates.
- **Review Status Protection**: Forces any newly uploaded or user-modified evidence record statuses back to `PENDING`, preventing customers from declaring their own documents as `APPROVED` or `SUPPORTED`.
- **Deduction Controls**: Overrides user-submitted certificate reductions back to `0` unless backed by an evidence record that has been approved and supported by a verified system reviewer.

### 3. Production Evidence Lifecycle (Phase 3)
- **Status Validation Rules**: Configured sealing engine checks ensuring all attached documents are explicitly `APPROVED` (review status) and `SUPPORTED` (support status), aborting immediately if any document is missing or not validated.
- **Malware Scanner Integration**: Rejects sealing requests if any evidence record has a `malwareScanStatus` set to `INFECTED`.

### 4. 5-Release Commercial Entitlement (Phase 4)
- **State Machine Integration**: Refactored [entitlement-service.ts](file:///Users/macair1/projects/cbam-paddle-app/functions/src/commerce/entitlement-service.ts) to replace the one-use consumption with a state machine allowing up to exactly 5 successful sealed releases per purchase.
- **Scope Locking**: Automatically binds the purchased entitlement to the user's `caseId` upon the first release. Any subsequent releases using this entitlement are restricted to the same case.
- **Correction Reasons**: Enforces a non-empty `correctionReason` parameter for sequence numbers 2 through 5.
- **Fail-Closed Protection**: Entitlement reservation is performed atomically inside Firestore transactions, and released back to `AVAILABLE` on sealing failures, avoiding package oversubscription.

### 5. Ruleset Fail-Closed Behavior (Phase 5)
- **Strict Resolution**: Removed silent fallback rules from the ruleset resolver [rulesets.ts](file:///Users/macair1/projects/cbam-paddle-app/lib/cbam/registry/rulesets.ts) and [rulesets.ts](file:///Users/macair1/projects/cbam-paddle-app/functions/src/cbam/registry/rulesets.ts), causing calculations and sealing to abort if no ruleset matches the active date range or jurisdiction.

### 6. Immutable Two-Phase GCS Commit (Phase 7)
- **Storage Read-Back Verification**: The sealing pipeline saves all report artifacts (PDF, JSON, XML, CSV, ZIP) to GCS, downloads them back over the network, computes their SHA-256 hashes, and compares them with the original in-memory buffers to guarantee GCS byte integrity before transactionally committing the Firestore document.

---

## Verification & Testing Results

### 1. Entitlement State Machine & Concurrency Tests
We added a dedicated unit test suite [entitlements-and-sealing.test.ts](file:///Users/macair1/projects/cbam-paddle-app/tests/commerce/entitlements-and-sealing.test.ts) verifying the entitlement behavior:
- **Initialization**: Verifies default 0 release count and `AVAILABLE` status.
- **Double Spend**: Proves double spend protection blocks concurrent reservation attempts.
- **Scope Lock**: Proves attempting a release on a different case fails validation.
- **Correction Reasons & Limit**: Validates that correction reasons are required for versions 2–5, and that attempting a 6th release throws a strict bounds error.

All tests passed successfully:
```text
 ✓ tests/commerce/entitlements-and-sealing.test.ts (4 tests) 6ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 2. Full Release Gate (ci:gate)
All unified codebase checks, linter rules, type checking, functions compilation, and Vitest runs passed cleanly:
- **Typecheck**: `PASS`
- **Functions Build**: `PASS`
- **CBAM Engine Tests**: `PASS`
- **Reports/Builders Tests**: `PASS`
- **Sales-Ready Mandate Guard**: `PASS` (fails closed, `PRODUCTION_SALES_READY=NO` confirmed)
- **Next.js Production Compilation**: `PASS`
