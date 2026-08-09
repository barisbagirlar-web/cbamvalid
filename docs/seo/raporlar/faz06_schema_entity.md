# PHASE 06 DELIVERY REPORT — Structured Data / Entity Claim Parity

Status: **COMPLETED CANDIDATE — CODE SCOPE**  
Generated at: `2026-08-09T22:03:00Z`  
Branch: `seo/faz-06-schema-entity-claim-parity`

## 1. Decision

Structured data must not be a second marketing copy system. Phase 06 collapses visible product claims, metadata claims, entity identity and breadcrumb hierarchy onto existing verified SSOTs.

## 2. Product Schema Claim Parity — INV-6.1

Previous Product JSON-LD described a “professional dossier and evidence package prepared for independent verification”, which no longer matched the self-service software product classification.

Correction:

- Product name, description, price and currency derive from verified `PRICE_CLAIM` → `CANONICAL_PRICING`.
- `PRICE_CLAIM` now carries the pricing SSOT description in addition to price/currency/name.
- `/product-classification` visibly renders `CANONICAL_PRICING.description` and `CANONICAL_PRICING.priceFormatted`.
- `lib/seo/schema-validation.ts` rejects schema Product name/description/price/currency drift from the verified claim.
- Negative fixture changes the Product description to managed-consulting language and proves BLOCK.

## 3. Single Organization Entity — INV-6.2

Previously entity dedupe occurred only inside `JsonLdForRoute`, so another schema call site could construct duplicate Organization entities.

Correction:

- `buildPageGraph()` now owns graph identity dedupe.
- identical `@id` nodes collapse centrally,
- conflicting nodes with the same `@id` throw instead of silently depending on insertion order,
- Organization `https://cbamvalid.com/#organization` is therefore singular at the graph layer.

Negative fixture proves conflicting Organization nodes are rejected.

## 4. Breadcrumb Parity — INV-6.3

Previously visible breadcrumbs used title-cased paths while BreadcrumbList JSON-LD used route H1/override values.

Correction: `lib/seo/breadcrumbs.ts` is the only breadcrumb hierarchy. Both `SeoBreadcrumbs` and `JsonLdForRoute` call `buildSeoBreadcrumbItems(route)`.

The helper preserves semantic parents for CN detail and CBAM resource pages while guaranteeing visible/schema order and labels cannot drift independently.

## 5. Remove Schema Copy Overrides

`JsonLdForRoute` previously held a separate `PUBLIC_ROUTE_OVERRIDES` copy table for `/`, `/product` and `/sample-dossier`.

This table was removed. JSON-LD now consumes runtime registry title/description/H1 plus shared verified commercial claims. Phase 04 already aligned critical registry content with the visible pages, so a second schema-only copy layer is unnecessary and dangerous.

## 6. FAQ Measurement Independence — INV-6.4

`generateFAQSchema()` is deterministic from the provided FAQ data and has no traffic/ranking/GSC dependency. Conformance mutates an unrelated measurement environment variable and proves the JSON-LD output remains identical.

## 7. Red-Team / Failure Modes

### A — Public pricing changes while Product JSON-LD keeps the old amount

Mitigation: schema price/currency and visible price use the same verified pricing SSOT; parity validator BLOCKs drift.

### B — Schema claims managed services while visible page says self-service software

Mitigation: Product description derives from the same pricing description visibly rendered on `/product-classification`; tampered description fixture BLOCKs.

### C — Duplicate Organization nodes conflict silently

Mitigation: graph-layer `@id` conflict throws before JSON-LD emission.

### D — Breadcrumb UI and schema label different parent paths

Mitigation: both consumers call one breadcrumb helper.

### E — FAQ schema is changed because a page has no traffic data

Mitigation: FAQ generation is traffic-independent by contract; measurement cannot alter schema presence/content.

## 8. Acceptance

Required exact-head evidence:

- Phase-aware preflight `faz-06`,
- strict typecheck,
- production build,
- existing security/release/SEO guards,
- INV-6.1 and INV-6.2 negative fixtures,
- positive Phase-06 schema/entity suite,
- repository regression/E2E workflows.

## 9. Deployment

**DEPLOY AFTER MERGE / EXTERNAL RELEASE EXECUTION.** Product classification visible content and emitted JSON-LD/breadcrumb behavior change. Current connected tools still expose no safe exact-SHA production dispatcher.

## 10. Rollback

ROLLBACK: revert the Phase-06 PR and deploy that exact rollback SHA only for emergency schema/runtime regression. Steady-state rollback would restore schema-copy drift and is not compliant.
