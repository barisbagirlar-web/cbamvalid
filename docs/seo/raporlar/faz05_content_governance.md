# PHASE 05 DELIVERY REPORT — Content / Entity Governance / Data Assets

Status: **COMPLETED CANDIDATE — CODE SCOPE**  
Generated at: `2026-08-09T21:47:00Z`  
Branch: `seo/faz-05-content-risk-firewall`

## 1. Decision

Phase 05 does not auto-generate or auto-publish SEO articles. The highest-value code action is a fail-closed content risk firewall around the existing commercial and regulatory content estate.

This protects revenue from four preventable failure classes: stale price/content drift, cannibalizing near-duplicates, unsupported AI publication, and accidental customer-data publication.

## 2. Managed Content Ledger

`data/seo/content_assets.json` tracks nine high-value assets:

- homepage,
- product,
- pricing,
- product classification,
- methodology,
- definitive-period guide,
- embedded-emissions guide,
- default-values guide,
- verification-preparation guide.

Each asset records origin, publication state, meaningful-change date, review date, regulatory risk, expert-review evidence state and AI-publication approval state.

No existing page is falsely labelled AI-generated. No expert reviewer identity is invented.

## 3. AI Publication Lock — INV-5.1

Automatic AI publication is explicitly disabled.

Any future `ai_assisted`, `ai_generated` or `programmatic` asset marked `published` must satisfy all three conditions:

1. human approval is required,
2. approval is explicitly true with a decision ID,
3. `docs/seo/KARAR_DEFTERI.md` contains `APPROVE_AI_CONTENT_PUBLICATION:<assetId>`.

Missing any condition is BLOCK.

## 4. Similarity / Cannibalization Gate — INV-5.2

`scripts/seo/content-governance-v6.ts` constructs deterministic documents from every indexable runtime registry page using title + H1 + description + primary intent.

All pairs are compared using phrase-aware Jaccard features: normalized unigram tokens plus adjacent-token bigrams. The maximum permitted score comes only from `sites/cbamvalid/seo.config.json` → `thresholds.similarityMax`.

The first CI run exposed a measurement-model false positive: two distinct CN intents (`/cn-code/25231000` Cement clinkers and `/cn-code/28041000` Hydrogen) scored `0.7059` under unigram-only Jaccard because their metadata shares a deliberate CN-page template. The production threshold was **not** relaxed. Adding adjacent phrase features reduced template dominance while preserving near-duplicate sensitivity; the dedicated negative fixture still exceeds the same `0.70` threshold.

A positive regression test now pins that distinct CN pair below the configured threshold so a future simplification cannot reintroduce the false positive.

No hard-coded production similarity threshold exists in the implementation.

## 5. Content Decay Debt — INV-5.3

Managed published assets are tested against:

- `thresholds.decayDays`,
- `thresholds.contentDebtWarnPct`.

A page is stale only when it is older than the configured decay window **and** there is no review after its meaningful change. Build/deploy timestamps are not used as fake editorial freshness.

Current managed set has no stale review debt on the Phase-05 evaluation date.

## 6. Expert Authority Gap — INV-5.4

Five high-regulatory-risk assets are explicitly marked as missing verified expert-review evidence.

This is a WARN, not a fabricated PASS. The software cannot manufacture a human expert identity, credential or endorsement. The code value is permanent visibility: these gaps can no longer silently disappear from governance.

## 7. Data Asset Privacy Firewall — INV-5.5

`data/seo/data_asset_plan.json` defines five data-asset classes.

Allowed public assets:

- official regulatory sources,
- official/public CN scope registry,
- synthetic public sample dossier.

Fail-closed customer data policy:

- customer-derived aggregates: public publication `false` until an approved privacy review exists,
- customer evidence files: public publication prohibited.

A negative fixture proves user-derived public data is BLOCK without approved privacy review. A second fixture proves private customer evidence cannot become public even if a review marker is present.

## 8. Significant-Change Timestamps — INV-5.6

Content dates must be valid date-only ISO values, may not be future dates, and a review may not predate the meaningful change it claims to review.

Managed paths must exist in the runtime SEO registry.

## 9. Failure Modes / Mitigation

### A — AI-generated page is programmatically published

Mitigation: publication requires explicit human approval plus matching decision-ledger marker; otherwise BLOCK.

### B — Two pages drift into the same intent/content

Mitigation: pairwise phrase-aware registry similarity uses the configured threshold and fails before merge. Template-heavy page families retain phrase/order evidence so shared boilerplate does not dominate the score.

### C — Old regulated page keeps a recent build timestamp

Mitigation: build time is irrelevant; decay uses meaningful-change and review dates only.

### D — Customer benchmarks are published from production records

Mitigation: user-derived assets default to public deny; approved privacy review is mandatory. Private evidence is never publishable as a public asset.

### E — “Expert reviewed” is claimed without proof

Mitigation: unverified identities are prohibited by the ledger policy; current expert-review gaps remain WARN instead of being filled with invented names.

## 10. Acceptance

Required exact-head evidence:

- Phase-aware preflight `faz-05`,
- strict typecheck,
- production build,
- existing security/release/SEO guards,
- `seo:conformance`,
- INV-5.1 / INV-5.2 / INV-5.5 negative fixtures,
- positive Phase-05 content-governance suite.

## 11. Deployment

**NO DEPLOY.** Phase 05 changes data, scripts, tests and SEO control documentation only. Public runtime content is unchanged.

## 12. Rollback

ROLLBACK: revert the Phase-05 PR. No production deploy rollback is required because this phase is non-runtime.
