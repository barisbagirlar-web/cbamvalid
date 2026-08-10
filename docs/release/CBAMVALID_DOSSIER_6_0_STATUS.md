# CBAMValid-Dossier 6.0 Release Status Record

```text
MANDATE=RM-CBAMVALID-006
SCHEMA_TARGET=CBAMVALID-DOSSIER-6.0
ENGINE_TARGET=4.0.0
VALUE_GATE=USD 1000 per sealed Enterprise Compliance Master Record
STATUS=IMPLEMENTED_AND_GATED
REPORT_GENERATED_AT=2026-08-10
```

This record is the persistent implementation log for the release mandate
RM-CBAMVALID-006. Each binding item names its implementation site and its
verification evidence so the release can be re-audited without re-deriving
decisions. The mandate text itself is maintained by the operator; this file
tracks what the repository currently implements and proves.

## Release order (Phase 1-5)

| Phase | Focus | Status |
|---|---|---|
| 1 · Honesty | Single authoritative state, no negative label for an open period | IMPLEMENTED (G-01, G-02) |
| 2 · Measurement | Two-axis scoring, score breakdown, dynamic value statement | IMPLEMENTED (G-01, G-12, C2) |
| 3 · Integrity | Hash architecture, reproducibility, evidence linkage, temporal integrity | IMPLEMENTED (G-04, G-07, G-11, G-06) |
| 4 · Value | Master Record structure (30 sections, 30-44 pages), no duplication | IMPLEMENTED (G-13, D-10) |
| 5 · Price | 1000 USD value gate readiness, acceptance workflow | IMPLEMENTED (enterprise-1000-acceptance) |

## Gates G-01 .. G-14

| Gate | Requirement | Implementation | Evidence |
|---|---|---|---|
| G-01 | Two-axis scoring; calendar never enters data readiness | `functions/src/cbam/report/v6/two-axis-score.ts` | `tests/gates/score.independence.spec.ts`, `artifacts/gates/G-01/three-runs.json` |
| G-02 | Single authoritative `packageReadinessState`; `NOT_READY` removed from V6 outputs | `functions/src/cbam/report/v6/package-state.ts` | `tests/gates/status.single-source.spec.ts`, `artifacts/gates/G-02/state-scan.json` |
| G-03 | Open period produces an honest state, never a failure | `package-state.ts` | `tests/gates/status.period-open.spec.ts`, `artifacts/gates/G-03/cell-mapping.json` |
| G-04 | Hash architecture table present and reproducible | `functions/src/cbam/report/v6/hash-architecture.ts` | `tests/gates/hash.architecture.spec.ts`, `hash.reproducibility.spec.ts`, `artifacts/gates/G-04/hash-architecture.json` |
| G-05 | Register row counts identical across CSV/XLSX/PDF | `v6/register-single-source.ts` | `tests/gates/register.single-source.spec.ts`, `artifacts/gates/G-05/three-list-comparison.json` |
| G-06 | Register single source incl. empty-register `emptyReason` | `v6/register-single-source.ts` | `tests/gates/register.single-source.spec.ts`, `artifacts/gates/G-06/register-matrix.json` |
| G-07 | Evidence linkage integrity (fields, calculation nodes) | `v6/evidence-linkage.ts` | `tests/gates/evidence.linkage-integrity.spec.ts`, `artifacts/gates/G-07/linkage-comparison.json` |
| G-08 | Automatic evidence-gap findings for mandatory fields | `v6/evidence-gap.ts` | `tests/gates/registry.evidence-gap.spec.ts`, `artifacts/gates/G-08/evidence-gap-report.json` |
| G-09 | Forbidden-string scan on the rendered V6 package | `scripts/gate-no-test-artifacts.sh`, `scripts/render-v6-gate-package.ts` | `artifacts/gates/G-09/scan-result.txt`, `scan-report.json` |
| G-10 | Scenario interpretations with mandatory labels | `v6/scenario-interpretation.ts` | `tests/gates/scenario.meaningfulness.spec.ts`, `artifacts/gates/G-10/scenario-table.json` |
| G-11 | Sampling completeness and rationale | `v6/sampling.ts` | `tests/gates/sampling.completeness.spec.ts`, `artifacts/gates/G-11/sampling-plan.json` |
| G-12 | Dynamic value statement (no fixed constant in B2) | `v6/value-statement.ts` | `tests/gates/value-statement.dynamic.spec.ts`, `artifacts/gates/G-12/two-cases-b2.json` |
| G-13 | Master Record: 30 sections A1-H4, 30-44 pages, footer, layout template parity | `v6/master-record-pdf.ts` | `tests/gates/master-record.structure.spec.ts`, `artifacts/gates/G-13/structure-check.json` |
| G-14 | No automatic evidence elevation or opinion implication | `scripts/guard-no-auto-attestation.sh` | `artifacts/gates/G-14/no-auto-attestation.json` |

## Master Record content audit (agent review, PR #227)

Permanent fixes applied and merged:

- A4: "Open findings" counts evidence gaps, not audit-log events; "Next legal
  date" carries the real period-close date and remaining days.
- C2: score breakdown derives achieved/lost points and loss reasons from the
  sealed readiness assessment; integrity penalties itemised.
- F3: full calculation DAG renders every trace node with value, unit and hash
  prefix; silent 6-node truncation removed.
- H2: compliance calendar shows date, type, state and remaining days.
- B2: verifier-handover metric derived at runtime from the handover pack
  (INV-04); no hard-coded count.
- Layout template `CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf` + section map
  generated and bound as the G-13 reference contract.

## Mandatory test set

`npm run test:gates` — 18 files / 45 tests PASS (G-01..G-14 incl. mandatory
cases). `npm run test:reports` — 28 files / 203 tests PASS. CI on merge PRs:
enterprise-1000-acceptance, final-99-acceptance, property-tests,
artifact-bound-release, regression all PASS.

## Mandatory case set (CASE-A .. CASE-G)

Implemented in `tests/gates/mandatory-cases.spec.ts`:
CASE-A period-open, CASE-B closed-clean, CASE-C evidence-gaps, CASE-D no
precursor, CASE-E multi-precursor, CASE-F carbon-price-paid, CASE-G
adversarial. All produce their expected `packageReadinessState`.

## NOT_READY scope decision

Removal is scoped to V6 outputs (G-02/G-03 scan all rendered V6 surfaces;
PASS). Legacy V5 enums and surfaces keep `NOT_READY` by explicit operator
decision; V6 never emits it.

## Definition of done — status

| DoD item | Status |
|---|---|
| 14 gates pass with evidence artifacts | COMPLETE |
| Mandatory tests pass | COMPLETE |
| Mandatory cases produce expected states | COMPLETE |
| Master Record 30 sections, 30-44 pages | COMPLETE |
| Forbidden-string scans exit 0 | COMPLETE |
| Manifest / inventory / document references match | COMPLETE |
| Hash architecture table + reproducibility | COMPLETE |
| `NOT_READY` zero in V6 scope | COMPLETE |
| Mandate record updated with implemented changes | COMPLETE (this file) |
| Live end-to-end generation + human review | OPERATOR (manual) |

## Live verification (operator responsibility)

- Run a live end-to-end package generation from a real case and review the
  sealed output as a human.
- Supply the original `CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf` if the
  operator's own layout is to be used verbatim; the committed template is the
  deterministic system reference until then.
- Deploy only if runtime changes; PR #227 changes V6 report modules that are
  not imported by production runtime, so push to main is sufficient.
