# CBAMValid Enterprise 1,000 USD Acceptance Contract

Status: **RELEASE BLOCKING**

This contract converts the approved product-development mandate into machine-testable release gates. It applies to the V5 premium verifier-preparation package. A release is not accepted merely because the package builds, signs, or passes the historical 499 USD contract.

## 1. Single readiness truth

Allowed customer-facing readiness values are exactly:

- `READY_FOR_VERIFICATION`
- `CONDITIONAL`
- `NOT_READY`

A future or otherwise non-definitive annual reporting period cannot be `READY_FOR_VERIFICATION`.

The preparation score is a preparation metric, not a verification opinion. If a blocker exists, the score must be reduced. The enterprise score formula is:

`min(canonical automated score, real calendar-period closure if the period is still open, blocker cap 69, conditional cap 89)`.

Controlled synthetic assessment clocks may validate synthetic evidence chronology, but they must never make the customer-facing generated-at truth claim that a future reporting period is already complete.

## 2. Human-review document architecture

The sealed V5 package retains 26 top-level components for compatibility, but only 11 foregrounded human-review PDFs are allowed. Each must have a distinct decision/workpaper purpose and unique content hash.

The former duplicate compilation is replaced in content by a dedicated **Verifier First Meeting & Handover Pack**. The historical `Complete Dossier Compilation.pdf` path may remain only as an API/download compatibility identifier; its rendered title and content must be the handover pack, not a duplicated report compilation.

Every human-review PDF must contain a generated **Unique document role** statement.

## 3. Evidence quality and independent verifiability

A-E evidence quality and independent verifiability are separate axes.

Every evidence row must expose:

- A-E/PENDING quality grade,
- grade basis,
- independent-verifiability state,
- verifiability basis,
- SHA-256/byte metadata integrity result,
- structured authority trace,
- official/accreditation reference when available,
- automatic weak-evidence warning.

Uploading a hash-valid file without sufficient authority provenance must immediately produce a visible weak-evidence warning. The system must never invent or imply an external signature, stamp, accreditation, or third-party validation that was not recorded.

## 4. Findings and corrective-action closure

Every generated finding must have all of the following populated before signing:

- Action,
- Priority,
- Responsible role,
- State,
- Closure condition.

Target date and closure evidence may legitimately be pending, but must be represented explicitly as `NOT_YET_SET` / `NONE_LINKED_YET` rather than blank cells.

## 5. Premium verifier-preparation layer

The package must contain all of the following:

1. deterministic sensitivity/scenario analysis with at least three scenarios;
2. per-good 5% planning-materiality threshold and scenario-proximity simulation;
3. a dedicated first-meeting pack containing a one-page brief, open questions and closure conditions;
4. seven prepared verifier-handover drafts:
   - Scope & criteria draft,
   - Site visit invitation draft,
   - Evidence request agenda,
   - Calculation reperformance plan,
   - Materiality discussion note,
   - Open findings agenda,
   - Sign-off & closure checklist.

All materiality outputs are operator-prepared planning simulations. They do not override independent-verifier expert judgement.

## 6. Integrity and non-regression

The enterprise transformation must run **before** manifest hashing and KMS signing. Therefore a mandate failure cannot produce a signed package.

The following existing controls remain mandatory:

- Calculation Trace / Calculation Graph / Verifier Workspace reconciliation,
- deterministic graph hashes and graph root,
- SHA-256 manifest integrity,
- detached signature verification,
- evidence-to-input-to-calculation lineage,
- zero HIGH/CRITICAL production dependency gate,
- English-only customer-facing product guard,
- production build and regression gates.

## 7. Release acceptance

A candidate is eligible for the 1,000 USD value claim only when CI proves all of the following on the exact candidate SHA:

- `ENTERPRISE_1000_STATUS_CONTRACT=PASS`
- `ENTERPRISE_1000_UNIQUE_DOCUMENTS=11`
- `ENTERPRISE_1000_EVIDENCE_VERIFIABILITY=PASS`
- `ENTERPRISE_1000_CORRECTIVE_CLOSURE=PASS`
- `ENTERPRISE_1000_SCENARIO_LAYER>=3`
- `ENTERPRISE_1000_MATERIALITY_SIMULATION` equals the number of declared goods
- `ENTERPRISE_1000_HANDOVER_DRAFTS=7`
- `ENTERPRISE_1000_RELEASE_READY=YES`

No manual waiver may replace these gates. Deployment is merge-gated and must target only the runtime surfaces changed by the accepted candidate.
