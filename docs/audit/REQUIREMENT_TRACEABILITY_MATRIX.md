# CBAMValid Requirement Traceability Matrix

Status values: `OPEN`, `IN_PROGRESS`, `BLOCKED_EXTERNAL`, `VERIFIED`.

A row may become `VERIFIED` only when implementation, real runtime wiring, positive and negative tests, and retained evidence all exist.

| ID | Requirement | Status | Implementation evidence | Test evidence | Runtime evidence | Migration / rollback |
|---|---|---|---|---|---|---|
| R-000 | Revoke unsupported product sales-ready claim | VERIFIED | `release_report.md` | Manual content review | N/A | Reversible documentation correction |
| R-001 | Fail-closed machine-readable sales-readiness guard | OPEN | Pending | Pending | Pending | Reversible |
| R-002 | Record baseline, architecture, blockers, starting/deployed SHA | IN_PROGRESS | `docs/audit/BASELINE.md` | Pending consistency guard | GitHub remote only | Reversible |
| R-003 | Maintain complete requirement traceability | IN_PROGRESS | This file | Pending matrix guard | N/A | Reversible |
| R-004 | Maintain failure-mode register | OPEN | Pending | Pending | N/A | Reversible |
| R-005 | Maintain migration plans | OPEN | `docs/migrations/` pending | Pending | Pending | Mandatory before schema writes |
| R-006 | Maintain rollback plans | OPEN | `docs/rollback/` pending | Pending | Pending | Mandatory before schema writes |
| R-101 | Server loads authoritative case revision for sealing | OPEN | Pending | Positive, stale revision, missing case, cross-tenant | Pending deployed callable | Backward-compatible request migration |
| R-102 | Typed Zod domain boundary for case/report/calculation/evidence/seal | OPEN | Pending | Schema rejection tests | Pending | Legacy record migration required |
| R-103 | Remove unsafe core-domain `any` | OPEN | Pending | Type/AST guard | Pending | Reversible code change |
| R-104 | Fail closed on missing case/evidence/QC/ruleset/entitlement/blockers | OPEN | Pending | Negative sealing matrix | Pending | Reversible |
| R-201 | Remove customer-controlled `isVerified` | OPEN | Pending | Legacy payload rejection | Pending | Existing record migration required |
| R-202 | Server-owned verification and evidence-review states | OPEN | Pending | Authorization/state tests | Pending | Data migration required |
| R-301 | Tenant-bound resumable evidence upload | OPEN | Pending | Upload/auth tests | Pending Storage | Storage migration required |
| R-302 | Quarantine, MIME/extension/size validation | OPEN | Pending | Invalid file tests | Pending | Reversible |
| R-303 | Malware scanning lifecycle | OPEN | Pending | Success/failure/timeout tests | Pending scanner integration | External scanner/KMS config may block |
| R-304 | Physical Storage-byte SHA-256 verification | OPEN | Pending | Tamper/hash mismatch tests | Pending | Reversible |
| R-305 | Evidence approval/rejection/revision/linkage | OPEN | Pending | State transition and authorization tests | Pending | Data migration required |
| R-306 | Immutable evidence snapshot at sealing | OPEN | Pending | Snapshot consistency tests | Pending | Data migration required |
| R-307 | Firestore and Storage cross-tenant isolation | OPEN | Pending rules | Emulator denial tests | Pending deployed rules | Rules rollout/rollback required |
| R-401 | Five-successful-release entitlement state machine | OPEN | Pending | Release 1–5 and release 6 denial | Pending | Entitlement migration required |
| R-402 | Scope locking and correction reasons | OPEN | Pending | Scope mismatch/correction tests | Pending | Entitlement migration required |
| R-403 | Atomic reservation, expiry, recovery and idempotency | OPEN | Pending | Concurrency/retry tests | Pending | Entitlement migration required |
| R-404 | Failed sealing consumes zero releases | OPEN | Pending | Failure injection tests | Pending | Reversible |
| R-501 | Versioned effective regulatory rulesets | OPEN | Pending | Effective-date and supersession tests | Pending | Dataset migration required |
| R-502 | Missing/expired/unproven ruleset blocks sealing | OPEN | Pending | Fail-closed tests | Pending | Reversible |
| R-503 | Real source provenance and non-placeholder hashes | OPEN | Pending | Provenance/hash tests | Pending official sources | Official source acquisition may be external |
| R-601 | Six independent sector engines | OPEN | Pending | Independent goldens | Pending | Reversible modular implementation |
| R-602 | Sector-specific routes, boundaries, precursors and allocation | OPEN | Pending | Positive/negative/boundary tests | Pending | Reversible |
| R-603 | Unit conversion and reconciliation | OPEN | Pending | Independent unit tests | Pending | Reversible |
| R-701 | Generate artifact bytes once | OPEN | Pending | Determinism tests | Pending | Reversible |
| R-702 | Create-only immutable Storage upload | OPEN | Pending | Generation-precondition tests | Pending | Storage layout migration required |
| R-703 | Storage byte read-back and hash comparison | OPEN | Pending | Hash mismatch tests | Pending | Reversible |
| R-704 | Transactional final commit and orphan cleanup | OPEN | Pending | Failure-injection tests | Pending | Cleanup/rollback required |
| R-705 | Downloads return original sealed bytes | OPEN | Pending | Re-download hash tests | Pending | Legacy report compatibility required |
| R-801 | Real asymmetric manifest signing | OPEN | Pending | Sign/verify/key-version tests | Pending KMS | KMS configuration external |
| R-802 | Verifier-side signature verification | OPEN | Pending | Tamper tests | Pending | Reversible |
| R-901 | Versioned 27-component package contract | OPEN | Pending | Exact component contract tests | Pending | Reversible |
| R-902 | No empty placeholders; case-specific or valid N/A content | OPEN | Pending | Semantic content tests | Pending | Reversible |
| R-903 | Manifest validates all package bytes, sizes, MIME and paths | OPEN | Pending | Extraction/integrity tests | Pending | Reversible |
| R-1001 | Professional multi-page verifier-ready PDF | OPEN | Pending | Visual/pagination/content tests | Pending | Reversible |
| R-1002 | Real `.xlsx` workbook | OPEN | Pending | Structural/reconciliation tests | Pending | Reversible |
| R-1101 | Tenant-authorized verifier workspace | OPEN | Pending | Authorization, compare, verify tests | Pending | Data migration may be required |
| R-1201 | Replace shallow guards with behavioral tests | OPEN | Pending | Guard self-tests | CI pending | Reversible |
| R-1301 | Full browser dossier E2E | OPEN | Pending | Real deployed environment | Pending | Reversible test assets |
| R-1401 | Rotate exposed Paddle credentials | BLOCKED_EXTERNAL | Provider action required | Rotation evidence | Production verification | Irreversible credential revocation |
| R-1402 | Remove hardcoded super-admin authorization | OPEN | Pending | Role/claim tests | Pending | Admin migration required |
| R-1403 | Secret scanning and dependency audit gates | OPEN | Pending | CI tests | CI pending | Reversible |
| R-1404 | Rate limiting, idempotency and abuse controls | OPEN | Pending | Abuse/retry tests | Pending | Reversible |
| R-1501 | Final evidence bundle contains zero open requirements | OPEN | `docs/release/FINAL_EVIDENCE.md` pending | All mandatory suites | Production | N/A |
| R-1502 | Final clean HEAD equals deployed SHA | OPEN | Pending | Provenance guard | Production deployment | Deployment rollback required |
| R-1503 | Production runtime logs show zero release-critical errors | OPEN | Pending | Log evidence | Production | N/A |

## Current Totals

```text
VERIFIED=1
IN_PROGRESS=2
BLOCKED_EXTERNAL=1
OPEN=50
PRODUCTION_SALES_READY=NO
```

These totals must be updated mechanically before final release. Hand-edited totals are not acceptable final evidence.
