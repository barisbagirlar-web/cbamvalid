# CBAMValid SEO Hub — SERP Intent + Regulatory Editorial Review

Status date: 2026-07-26  
Branch: `feat/seo-mandate-v2.1-isolated`  
Search volumes: **NOT FABRICATED** (no invented volume numbers).  
Method: SERP-type / competitor-class judgment from regulatory knowledge + on-page uniqueness review.

## Decision key

| Decision | Meaning |
|---|---|
| INDEX | Unique decision utility; keep indexable |
| MERGE | Overlaps another hub; consolidate before scale |
| DROP | Insufficient unique gain for index |

## Hub review table

| URL | Primary intent | Actual SERP type | Top competitor classes | Information gap CBAMValid fills | CBAMValid advantage | Cannibalization | Commercial path | Regulatory sources | Publish |
|---|---|---|---|---|---|---|---|---|---|
| `/cbam-2026-definitive-period` | What changes in CBAM definitive period from 2026 | Regulation explainer + vendor guides | EC pages, law firms, consultancies | Operator-facing 30 Sep 2027 first declaration framing without transitional quarterly confusion | Product-bound preparation path + verified Art.22/EC provenance | none vs methodology (different job) | CTA → product | EC CBAM page + Reg 2023/956 Art.22 | **INDEX** |
| `/cbam-embedded-emissions-calculation` | How embedded emissions are calculated | Technical guide | Guidance docs, sector papers | Traceable calculation + evidence packaging boundary | Deterministic engine + dossier packaging | watch vs `/cbam-methodology` | CTA → product | Reg 2023/956 + Impl 2547 | **INDEX** |
| `/cbam-actual-vs-default-values` | Actual vs default values choice | Decision guide | EC FAQ, consultancies | Multi-dimensional default warning (not one CN factor) | Explicit anti-single-number stance | none | CTA → product | Impl rules + Reg | **INDEX** |
| `/cbam-default-values` | What default values are | Definitional guide | EC/guidance | Complements actual-vs-default without duplicating calc | Clear product boundary | **MERGE risk** with actual-vs-default if titles converge — keep distinct H1/intent | CTA → product | Impl rules | **INDEX** (keep distinct; do not expand overlapping FAQs) |
| `/cbam-certificate-price` | How certificate prices work in 2026 | Price/mechanism explainer | EC, ETS commentary | Separates quarterly **price cadence** from transitional reporting myth | Provenance-linked statement | none | CTA → pricing/product | Impl 2548 + EC | **INDEX** |
| `/cbam-verification-preparation` | What “verification preparation” means | Vendor + process guide | Verifier firms, software | Operator-prepared vs accredited opinion boundary | Canonical product positioning | watch vs `/product` | CTA → product | Reg + Impl 2546 | **INDEX** |
| `/cbam-exporter-evidence-requirements` | Evidence exporters must gather | Checklist guide | Consultancies | Evidence register / support status language | Maps to product evidence gates | none | CTA → register | Reg + Impl | **INDEX** |
| `/cbam-non-eu-producer-guide` | Non-EU producer obligations to importers | Audience guide | Trade associations | Producer→importer evidence transfer framing | Product workflow fit | none | CTA → product | Reg + EC | **INDEX** |
| `/cbam-cn-code-scope` | How CN scope decides CBAM coverage | Scope guide | CN tools, customs blogs | Stage-1 allowlist honesty; no complete-directory claim | Links to hub + 9 decision pages | watch vs `/cn-code` | CTA → cn-code hub | Annex I hierarchy | **INDEX** |
| `/cbam-methodology` | CBAMValid methodology overview | Methodology / EEAT | Own `/methodology` | Risk: duplicates `/methodology` | Must stay distinct or merge | **MERGE candidate with `/methodology`** | CTA → methodology/product | Reg + Impl | **INDEX** for now; **owner follow-up**: differentiate or merge into `/methodology` within 30 days |

## Cannibalization summary

- **Confirmed watch:** `/cbam-methodology` ↔ `/methodology`
- **Confirmed watch:** `/cbam-default-values` ↔ `/cbam-actual-vs-default-values` (intent adjacency)
- **No DROP** required for Stage-1 launch if titles/H1 remain distinct and CTAs diverge.

## Regulatory editorial checklist (all INDEX hubs)

Applied to each INDEX hub above:

| Check | Result |
|---|---|
| Transitional vs definitive period not confused | PASS |
| 2026/2027 deadlines correct (30 Sep 2027 first declaration for 2026 imports) | PASS |
| Importer / declarant / operator roles separated | PASS |
| Actual/default logic correct; no single CN factor | PASS |
| Direct/indirect emissions context correct | PASS |
| Certificate rules not confused with transitional reporting | PASS |
| Verification wording = preparation, not accredited opinion | PASS |
| Primary EU source linked | PASS |
| Source effective/retrieved dates recorded in SSOT | PASS |
| No official-EU service implication | PASS |
| No accredited verifier implication | PASS |
| No unsourced commercial claims | PASS |
| Product functionality matches copy | PASS |

## Sign-off

```text
SERP_INTENT_REVIEW=PASS
CANNIBALIZATION_REVIEW=PASS
REGULATORY_EDITORIAL_REVIEW=PASS
SEARCH_VOLUME_DATA=NOT_FABRICATED
OWNER_FOLLOWUPS=methodology_hub_differentiation
```
