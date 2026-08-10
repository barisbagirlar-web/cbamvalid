# Phase 19 — Valuation, Calibration and Due Diligence

- Valuation methodology is range-only and uses `economics.valuationMultiples.low/high` after measured history reaches `thresholds.valuationMinHistoryMonths`.
- Current monthly SEO P&L history is **0 months** and trailing revenue/cashflow are null; valuation is therefore `SKIP_NO_DATA` with no monetary range emitted.
- Cashflow valuation requires the separate, longer `thresholds.valuationCashflowMinHistoryMonths` gate; current eligibility is false.
- Calibration is config-driven by maximum evidence age, minimum sample and minimum rho. No sample exists, so calibration remains `SKIP_NO_DATA`.
- Board-report parity checks status and low/high minor-unit values; current null state is internally consistent.
- DD package contains measurement boundary, governance/control inventory, risks/limitations and valuation methodology.
- Required BLOCK negative fixtures cover range methodology, DD completeness and calibration freshness.
- No runtime file changed. **NO DEPLOY**.

ROLLBACK: revert the exact Phase-19 merge. Runtime output is unchanged, so no production release rollback is required.
