# FAZ 09 — SEO warehouse / P&L integrity

Status: CODE SCOPE COMPLETE / PRIVATE MONEY DATA PARTIAL

## Financial truth controls

All monetary values entering the SEO P&L are integer minor units. Fractional currency values are rejected before calculation. ROI is represented in basis points only when a real revenue numerator and non-zero cost denominator exist.

Current site configuration has `defaultValuePerConversionMinor = 0`, while private conversion attribution and production-cost feeds are unavailable. Therefore revenue, profit and ROI remain `null`/unknown. No proxy traffic metric is converted into money.

## Structural break

The warehouse contract treats 2025-09-11 (`num100-removal`) as a hard cohort boundary. One cohort id cannot silently join observations from both sides. Explicit pre/post split cohort ids are required.

## Incrementality

Incrementality evidence must include a named method and bounded confidence interval. A point estimate without interval evidence is rejected.

## Generative AI isolation

Generative-AI clicks may be stored for observation, but are excluded from P&L formulas. Tests prove changing the AI click count cannot change revenue, profit or ROI output.

## Invariants

- INV-9.1 PASS — integer minor-unit money; negative fixture PASS.
- INV-9.2 PASS — structural-break join isolation; negative fixture PASS.
- INV-9.3 PASS — confidence interval mandatory; negative fixture PASS.
- INV-9.4 PASS as control — zero conversion value produces an explicit unknown-money warning.
- INV-9.5 PASS — Generative AI metric isolated from the P&L formula.

## Deployment

**NO DEPLOY** — scripts, tests, warehouse/P&L data and documentation only.

ROLLBACK: revert the Phase-09 merge; live application behavior is unchanged.
