# CBAMValid Verifier-Grade Acceptance Criteria

## Product boundary

CBAMValid generates a confidential verifier-preparation package for independent accredited verification. It does not issue a verification opinion, accreditation decision, customs decision, CBAM Registry submission or acceptance guarantee.

## Binding acceptance criteria

| Area | Required evidence | Blocking rule |
|---|---|---|
| Regulatory registry | Six verified definitive EUR-Lex sources; canonical SHA-256 fingerprint | Unknown, speculative or placeholder instrument blocks release |
| Ruleset | Definitive period active from 2026-01-01; 5% per-good materiality reference | Transitional or unverified ruleset blocks sealing |
| Sector scope | Six in-force sealable sectors; downstream complex goods proposal-only | Proposal-only sector cannot seal |
| Calculation | Decimal arithmetic, unit checks, allocation sum = 1, per-good reconciliation | NaN, Infinity, negative values, zero production or reconciliation drift block calculation |
| Evidence | Tenant/case path, file SHA-256, positive bytes, approved review, clean malware result | Missing or mismatched evidence blocks readiness |
| PDF | 11 substantive, paginated, classified verifier-preparation documents | Trivial or unparseable PDF blocks package finalization |
| XLSX | Minimum 14 sheets, formulas, filters, freeze panes, controlled lists, legal hyperlinks, verifier sign-off | Missing workbook control structure blocks report tests |
| Package | Exactly 27 top-level components, manifest schema 4.0, KMS signature, ZIP reopen/hash verification | Any count, hash, signature or read-back mismatch blocks sealing |
| Report UI | Strict validated DTO, trust-chain hashes, controlled downloads, visible verifier boundary | `any`, silent errors or unchecked download metadata block CI |
| Independent verifier | Status initially `NOT_REVIEWED`; only verifier-controlled workbook fields are editable | Application must never assert an independent opinion |
| CI | Static guard, typecheck, clean Functions build, lint, engine/report/commerce/integration tests, production build | Any failed gate blocks merge |
| Production evidence | Deployed commit, authenticated create/save/seal/download/verify smoke test | No production-readiness claim without executed evidence |

## Deterministic calculation identities

- Electricity indirect emissions = electricity consumed × grid emission factor.
- Total direct emissions = installation direct emissions + precursor direct emissions.
- Total indirect emissions = electricity indirect emissions + precursor indirect emissions.
- Total embedded emissions = total direct emissions + total indirect emissions.
- Per-good allocated emissions = total embedded emissions × documented allocation share.
- Per-good specific emissions = allocated embedded emissions ÷ good production volume.
- Allocation shares must sum to 1 within 0.000001.
- Sum of per-good allocated embedded emissions must reconcile to total embedded emissions.
- Verification materiality reference = 5% × per-good total specific embedded emissions.

## Release status vocabulary

- `SOURCE_VERIFIED`: source code and clean-runner gates passed.
- `DEPLOYED`: the verified commit is active in Firebase.
- `LIVE_SMOKE_VERIFIED`: authenticated production workflow completed with evidence.
- `SALES_READY`: all commercial, secret, package and live-evidence gates passed.

No lower status may be described using a higher-status label.
