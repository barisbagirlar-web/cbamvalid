# CBAMValid Recovery Baseline

## Identity

- Repository: `barisbagirlar-web/cbamvalid`
- Recovery branch: `fix/cbam-mandate-recovery-20260714`
- Starting remote HEAD: `802fc37300a669ab833eb192af4c86e9bc49819d`
- Baseline date: `2026-07-14`
- Default branch: `main`
- Prior deployed authentication SHA: `a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e`

## Scope Decision

Authentication evidence is retained only for the authentication scope. It is not accepted as proof that the CBAM product is production-ready or sales-ready.

Current decision:

```text
AUTH_SCOPE_READY=YES
CBAM_PRODUCT_SCOPE_READY=NO
PRODUCTION_SALES_READY=NO
RELEASE_CLOSE_ALLOWED=NO
```

## Verified Remote State

1. The remote repository HEAD is newer than the previously reported deployed authentication SHA.
2. The latest remote commit only restores a deterministic Firebase Admin alias dependency for compiler compatibility.
3. The previous release report declared `PRODUCTION_SALES_READY=YES` without product-scope evidence.
4. No GitHub-hosted evidence proves the local dirty working tree described by the audit. Uncommitted local changes are outside this baseline until committed and pushed.

## Binding Audit Defects

| ID | Defect | Baseline status |
|---|---|---|
| DEF-001 | Missing execution baseline and traceability evidence | OPEN |
| DEF-002 | Sealing runtime receives undefined authoritative case input | OPEN |
| DEF-003 | Asymmetric manifest signing placeholder | OPEN |
| DEF-004 | Immutable Storage commit and byte read-back absent | OPEN |
| DEF-005 | Dossier ZIP does not satisfy the 27-component contract | OPEN |
| DEF-006 | Production evidence lifecycle absent | OPEN |
| DEF-007 | Five-successful-release entitlement absent | OPEN |
| DEF-008 | Six independent sector engines absent | OPEN |
| DEF-009 | Unsafe core-domain `any` usage | OPEN |
| DEF-010 | Customer-controlled `isVerified` behavior | OPEN |
| DEF-011 | Regulatory ruleset fallback is not fail-closed | OPEN |
| DEF-012 | Shallow file/string-presence release guards | OPEN |
| DEF-013 | Firestore and Storage emulator tenant tests absent | OPEN |
| DEF-014 | Full browser dossier E2E absent | OPEN |
| DEF-015 | Final deployed SHA and runtime proof absent | OPEN |
| DEF-016 | Unsupported sales-ready claim | CLOSED by recovery commit; guard still required |

## Existing Test Evidence Classification

The following passing commands are necessary but insufficient:

- typecheck
- lint
- build
- existing unit tests
- existing integration tests
- authentication Playwright tests
- current `ci:gate` or commercial release scripts

They do not prove:

- physical evidence byte integrity,
- malware and approval lifecycle,
- tenant isolation,
- five-release concurrency,
- immutable sealed-byte replay,
- manifest signing,
- the 27-component package,
- six independent calculation engines,
- verifier workspace behavior,
- deployed full-dossier E2E.

## Change-Control Rules

1. No direct implementation on `main`.
2. Schema and entitlement changes must be backward compatible or accompanied by an explicit migration and rollback procedure.
3. Failed sealing must consume no commercial release.
4. Sealed artifacts must never be regenerated on download.
5. A customer must never control verification, approval, entitlement, or official-compliance state.
6. Missing rulesets, evidence, ownership, QC, signing, or byte-integrity proof must block sealing.
7. `SALES_READY=YES` is prohibited until all machine-readable final evidence gates are true.

## Local-State Limitation

GitHub cannot expose uncommitted files from `/Users/macair1/projects/cbam-paddle-app`. To preserve any unfinished Codex work from that directory, it must be committed and pushed to a branch or supplied as a patch/archive. Until then, recovery continues from the remote starting SHA above.
