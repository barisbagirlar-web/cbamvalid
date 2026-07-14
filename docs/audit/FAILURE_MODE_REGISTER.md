# CBAMValid Failure-Mode Register

Severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

| ID | Component | Failure mode | Severity | Required prevention | Required detection | Required recovery evidence | Status |
|---|---|---|---|---|---|---|---|
| FM-001 | Seal request | Browser supplies missing or forged case data | CRITICAL | Load authoritative case revision server-side; typed request contains IDs only | Request schema and authorization tests | Rejected request; no reservation or artifact | OPEN |
| FM-002 | Seal request | Stale case revision is sealed | CRITICAL | Revision precondition and transaction check | Concurrent revision test | Seal blocked; user refreshes latest revision | OPEN |
| FM-003 | Tenant isolation | User accesses another tenant’s case/evidence/report | CRITICAL | Server authorization plus Firestore/Storage rules | Emulator and deployed denial tests | Denial audit event; no data disclosure | OPEN |
| FM-004 | Evidence upload | Storage object exists but metadata write fails | HIGH | Upload session and finalization transaction | Failure injection | Quarantine orphan and scheduled cleanup | OPEN |
| FM-005 | Evidence upload | Metadata exists but physical bytes are absent | CRITICAL | Finalization reads object generation, size and bytes | Missing-object test | Mark upload failed; block review/seal | OPEN |
| FM-006 | Evidence | Uploaded file is malicious | CRITICAL | Quarantine and malware scan before review | Known-safe and test-malware fixtures | Reject/quarantine; audit result | OPEN |
| FM-007 | Evidence | Malware scanner times out or is unavailable | HIGH | Fail closed with retryable scan state | Timeout test | Keep quarantined; do not approve/seal | OPEN |
| FM-008 | Evidence | Evidence is modified after approval | CRITICAL | Generation lock and physical SHA-256 snapshot | Tamper test | Revoke approval; block seal; create finding | OPEN |
| FM-009 | Evidence | Evidence disappears after approval | CRITICAL | Object existence/read-back immediately before seal | Delete-after-approval test | Block seal and create critical finding | OPEN |
| FM-010 | Ruleset | Effective ruleset is missing | CRITICAL | Fail-closed resolver | Missing-period test | Block calculation and sealing | OPEN |
| FM-011 | Ruleset | Ruleset expires or is superseded during draft | HIGH | Pin draft calculation version; re-evaluate at seal | Effective-date boundary test | Require recalculation and user acknowledgment | OPEN |
| FM-012 | Ruleset | Placeholder/empty source hash is accepted | CRITICAL | Source byte hash and provenance validation | Empty hash fixture | Reject ruleset publication | OPEN |
| FM-013 | Calculation | Unsupported sector path returns zero | CRITICAL | Explicit unsupported blocker | Unsupported route test | Block report; no zero substitution | OPEN |
| FM-014 | Calculation | Unit conversion produces silent magnitude error | CRITICAL | Typed units and canonical conversion layer | Independent conversion fixtures | Block reconciliation; create finding | OPEN |
| FM-015 | Allocation | Allocation denominator is zero or inconsistent | CRITICAL | Domain validation and reconciliation | Boundary/zero tests | Block calculation and sealing | OPEN |
| FM-016 | Entitlement | Two concurrent requests oversubscribe five releases | CRITICAL | Transactional reservation and monotonic sequence | High-contention emulator test | Exactly five commits; others denied | OPEN |
| FM-017 | Entitlement | Duplicate idempotency request consumes twice | CRITICAL | Idempotency record bound to scope and result | Retry test | Return original result; one consumption | OPEN |
| FM-018 | Entitlement | Failed seal consumes a release | CRITICAL | Consume only after verified immutable commit | Failure injection at every phase | Reservation released/expired; count unchanged | OPEN |
| FM-019 | Entitlement | Sixth release succeeds | CRITICAL | Maximum-successful-release transaction condition | Sequential and concurrent sixth test | Deny with stable error; audit event | OPEN |
| FM-020 | Entitlement | Refund/revocation occurs after sealing | HIGH | Explicit commercial state policy | State transition test | Preserve sealed audit history; prevent new releases as policy requires | OPEN |
| FM-021 | Artifact generation | PDF/XLSX/ZIP generation fails mid-pipeline | HIGH | Two-phase staging and no final consumption | Generator failure tests | Delete staged artifacts; release reservation | OPEN |
| FM-022 | Storage | Storage upload succeeds but Firestore final commit fails | CRITICAL | Staging namespace and transactional finalization | Commit failure injection | Delete or quarantine staged objects; no consumption | OPEN |
| FM-023 | Storage | Existing object is overwritten | CRITICAL | Create-only generation precondition | Duplicate path test | Reject write; preserve original bytes | OPEN |
| FM-024 | Storage | Read-back hash differs from generated hash | CRITICAL | Physical byte read-back before commit | Tamper/proxy test | Delete staged set; block finalization | OPEN |
| FM-025 | Manifest | KMS signing fails | CRITICAL | Signing required before immutable commit | KMS failure/permission tests | No final release; cleanup staging | OPEN |
| FM-026 | Manifest | Signature verifies with wrong key/version | CRITICAL | Bind key resource/version and algorithm | Wrong-key test | Verification failure; block release/download validation | OPEN |
| FM-027 | Package | ZIP misses or adds components | HIGH | Versioned exact contract | Extract-and-compare test | Block release | OPEN |
| FM-028 | Package | Manifest path traversal or unsafe filename | CRITICAL | Canonical safe paths and allowlist | Malicious path fixture | Reject package generation | OPEN |
| FM-029 | Download | Report is regenerated and bytes change | CRITICAL | Download immutable Storage object only | First/second hash test | Fail integrity check; incident record | OPEN |
| FM-030 | Download | Unauthorized user downloads sealed package | CRITICAL | Tenant/report authorization on every request | Cross-tenant deployed test | 403; audit denial | OPEN |
| FM-031 | Verifier | Verifier sees unsealed or mutable data | HIGH | Workspace reads sealed snapshots only | Draft/sealed access tests | Deny or clearly label draft | OPEN |
| FM-032 | Audit | Audit event is omitted or reordered | HIGH | Append-only sequence/hash chain per tenant/case | Concurrent audit tests | Integrity alert and release block where critical | OPEN |
| FM-033 | Deployment | Deployed SHA differs from approved HEAD | CRITICAL | Build provenance endpoint and release guard | Live SHA comparison | `SALES_READY=NO`; redeploy approved commit | OPEN |
| FM-034 | Deployment | Production runtime has critical errors after deploy | CRITICAL | Authenticated smoke/E2E and log inspection | Runtime probes | Roll back; retain incident evidence | OPEN |
| FM-035 | Credentials | Exposed Paddle credential remains active | CRITICAL | Provider-side rotation/revocation | Provider evidence and failed-old-key check | Rotate immediately; reconcile suspicious events | BLOCKED_EXTERNAL |
| FM-036 | Authorization | Hardcoded admin email grants unintended access | CRITICAL | Server-managed claims/roles | Normal/admin role tests | Revoke role; audit access | OPEN |
| FM-037 | Guarding | File/string-presence guard reports false PASS | HIGH | Behavioral tests and machine-readable evidence | Guard mutation/self-tests | Fail release | OPEN |
| FM-038 | Reporting | PDF layout clips or omits required content | HIGH | Pagination/layout constraints and visual QA | Multi-page snapshot/content test | Block release; regenerate fixed version | OPEN |
| FM-039 | Workbook | File is XML Spreadsheet mislabeled as XLSX | HIGH | Real XLSX writer and structural parser test | Workbook open/structure test | Block release | OPEN |
| FM-040 | Local recovery | Uncommitted Codex work is lost | HIGH | Commit/push or patch before cleanup | Compare local status and remote branch | Recover from patch/archive; never reset blindly | OPEN |

## Exit Rule

No `CRITICAL` or `HIGH` failure mode may remain without implemented prevention, detection, and recovery evidence before `PRODUCTION_SALES_READY=YES`.
