# Pre-deploy thin hub decisions (post PR #69 merge)

Status date: 2026-07-26  
Branch: `fix/predeploy-lcp-thin-hubs`  
Method: SERP intent + regulatory depth + information gain + product linkage (not word count).

## Decision key

| Decision | Meaning |
|---|---|
| INDEX | Sufficient unique decision utility after review/enrichment |
| ENRICH | Valuable intent; content was insufficient — expanded then kept indexable |
| NOINDEX | Does not deserve a standalone indexable URL at this stage |

## Five-hub board

| URL | SERP intent | Information gain vs alternatives | Product link | Decision | Outcome |
|---|---|---|---|---|---|
| `/cbam-default-values` | Multi-dimensional defaults (anti single-CN factor) | Distinct from actual-vs-default; fills invented-factor gap | Methodology + engine ruleset binding | **ENRICH → INDEX** | Full section stack shipped |
| `/cbam-non-eu-producer-guide` | Non-EU producer → EU buyer evidence transfer | Audience-specific; not a duplicate of product page | Register / dossier workflow | **ENRICH → INDEX** | Full section stack shipped |
| `/cbam-verification-preparation` | Operator prep vs accredited opinion boundary | Core positioning intent; checklist depth required | Product + sample dossier | **ENRICH → INDEX** | Full section stack shipped |
| `/cbam-actual-vs-default-values` | Pathway choice decision | High commercial/regulatory utility | Default-values + methodology | **ENRICH → INDEX** | Full section stack shipped |
| `/cbam-certificate-price` | Quarterly price cadence ≠ transitional reporting | Unique confusion-killer | 2026 timetable + product price disclaimer | **ENRICH → INDEX** | Full section stack shipped |

```text
NOINDEX_COUNT=0
ENRICH_THEN_INDEX_COUNT=5
NO_UNREVIEWED_INDEXABLE_HUBS=PASS
THIN_HUB_DECISIONS=PASS
```

## LCP note (2026 page)

Root cause for elevated lab LCP on `/cbam-2026-definitive-period`: public header CTAs prefetched `/login` and `/register`, pulling `(auth)/layout` + Firebase auth iframe on anonymous marketing navigations. Mitigation: `prefetch={false}` on auth CTAs; guide H1 switched to preloaded sans font (Lora deferred).

## Sign-off

```text
THIN_HUB_DECISIONS=PASS
NO_UNREVIEWED_INDEXABLE_HUBS=PASS
PREDEPLOY_CONTENT_BOARD=PASS
```
