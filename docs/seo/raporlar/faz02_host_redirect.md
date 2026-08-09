# PHASE 02 DELIVERY REPORT — Host / Canonical / Redirect

Status: **COMPLETED CANDIDATE — CODE SCOPE**  
Generated at: `2026-08-09T19:38:00Z`  
Branch: `seo/faz-02-host-canonical-ledger`

## 1. Gate-In

- [Kesin] Phase 01 is merged and marked completed.
- [Kesin] Phase-02 write contract now authorizes the actual runtime owner `next.config.js` and the four mandatory negative fixtures under `tests/conformance/**` after E-36/E-37 control-plane repair.
- [Kesin] Canonical origin SSOT is `sites/cbamvalid/seo.config.json` → `https://cbamvalid.com`.
- [Kesin] Firebase Framework-Aware Hosting is the deployment target.
- [Kesin] Repository code does not own DNS/custom-domain attachment or Firebase's pre-application HTTP→HTTPS edge upgrade. Per the current owner instruction, those non-code controls are explicitly excluded rather than represented as code debt.

## 2. Runtime Corrections

### 2.1 Canonical-origin single source

`next.config.js` now derives the canonical origin and hostname from `sites/cbamvalid/seo.config.json` instead of duplicating `cbamvalid.com` string literals across redirect rules.

Build fails closed if the configured canonical root is not an origin-only HTTPS URL.

### 2.2 Redirect-chain elimination

The existing legacy redirects were relative:

- `/credits` → `/credits/buy`
- `/cbam-methodology` → `/methodology`

On a `www` request, a relative legacy redirect can preserve the non-canonical host and then require a second host-normalization redirect.

They now target the absolute canonical origin:

- `/credits` → `https://cbamvalid.com/credits/buy`
- `/cbam-methodology` → `https://cbamvalid.com/methodology`

The generic `www` rule also derives its host and destination from the canonical config.

### 2.3 HSTS irreversible-action correction

[Kesin] Previous runtime header: `max-age=63072000; includeSubDomains; preload`.

[Kesin] No explicit irreversible HSTS-preload approval exists in `docs/seo/KARAR_DEFTERI.md`.

Corrected runtime header: `max-age=63072000; includeSubDomains`.

The validator rejects any future reintroduction of `preload` unless a specifically formatted explicit approval record exists.

## 3. Machine Controls Added

### `data/seo/redirects.json`

- canonical origin/host
- all three application-owned redirect rules
- permanent 308 semantics
- review decisions and rationale
- HSTS expected state
- redirect-capacity accounting
- explicit non-code edge controls

### `scripts/seo/redirect-audit-v6.ts`

Checks:

- ledger ↔ runtime parity
- single-hop representative host/path combinations
- redirect chain/loop detection
- HSTS preload approval state
- configured redirect-capacity threshold
- route-review completeness
- optional `--live` HTTP + browser/Googlebot probe output
- `--dry-run` support

### `scripts/seo/redirect-variant-audit-v6.ts`

Checks:

- lowercase canonical route inventory
- no case-fold duplicate public routes
- no trailing-slash canonical records except `/`
- Next trailing-slash normalization not disabled

### Negative fixtures

- `tests/conformance/inv-2-1.test.ts`
- `tests/conformance/inv-2-2.test.ts`
- `tests/conformance/inv-2-3.test.ts`
- `tests/conformance/inv-2-5.test.ts`

Positive suite: `tests/conformance/phase02-redirects.test.ts`.

## 4. Invariant State

| Invariant | Severity | Result | Evidence |
|---|---|---|---|
| INV-2.1 | BLOCK | PASS candidate | runtime/ledger parity + representative canonical variants exactly one application hop + negative fixture |
| INV-2.2 | BLOCK | PASS candidate | chain/loop tracing + relative-target negative fixture |
| INV-2.3 | BLOCK | PASS candidate | preload removed; approval detector fail-closed; negative fixture |
| INV-2.4 | WARN | PASS | all application redirects reviewed with KEEP rationale; historical creation age is not fabricated |
| INV-2.5 | BLOCK | PASS candidate | case-fold/slash inventory guard + duplicate-2xx negative fixture |
| INV-2.6 | INFO | PASS | 3 / 2000 application rules = 15 basis points; below config warning threshold |

Machine result: `data/seo/invariant-results/faz-02.json`.

## 5. External Controls Explicitly Excluded from Code Scope

These are not left as implementation TODOs because they cannot be changed by repository code:

1. Firebase custom-domain HTTP→HTTPS upgrade before Next.js receives the request.
2. DNS/Firebase custom-domain attachment for `www.cbamvalid.com`.

Repository mitigation is complete: every application-owned redirect uses the canonical HTTPS origin, so any request that reaches Next.js cannot incur an avoidable path-then-host chain.

## 6. Red-Team / Failure Modes

### Failure mode A — relative legacy target is reintroduced

Effect: `www + legacy path` can require path redirect followed by host redirect.

Mitigation: runtime/ledger parity plus INV-2.1 and INV-2.2 fixtures; absolute canonical targets are required by the positive contract.

### Failure mode B — HSTS `preload` is reintroduced without explicit approval

Effect: irreversible browser preload-list commitment can be initiated outside the approved risk boundary.

Mitigation: INV-2.3 validator and negative fixture BLOCK the change.

### Failure mode C — mixed-case or slash duplicate route is introduced

Effect: multiple successful URL variants can dilute canonical consolidation and crawl efficiency.

Mitigation: registry case-fold uniqueness + slash-policy audit + INV-2.5 fixture.

### Failure mode D — redirect table grows silently

Effect: operational capacity/rule management deteriorates.

Mitigation: rule count is compared with `deployment.redirectLimit` and `thresholds.redirectCapacityWarnPct` from config; no hard-coded business threshold.

## 7. Acceptance Commands

Required PR gates:

- phase-aware V6 preflight (`faz-02`)
- strict typecheck
- production build
- repository release/security/regression guards
- `npm run seo:conformance`

Phase-specific deterministic checks are exercised by `tests/conformance/phase02-redirects.test.ts` and the four exact BLOCK negative fixtures.

Optional live probe after merged runtime deployment:

`npx tsx scripts/seo/redirect-audit-v6.ts --live`

The live probe does not mutate repository or production state.

## 8. Deployment Decision

**DEPLOY REQUIRED AFTER MERGE** because `next.config.js` changes runtime response headers and redirect targets. Deployment must use the exact merged `main` SHA and the repository-approved Firebase production path. No deploy before merge.

## 9. Rollback

ROLLBACK: revert the Phase-02 PR and redeploy the resulting exact merged rollback SHA if a runtime emergency requires rollback. Note that reverting also restores the prohibited preload token and relative redirect targets, so a rollback reopens INV-2.1/2.2/2.3 and must not be treated as a compliant steady state.
