# Valuation Method

The executable valuation method is a range, never a single-point claim. It uses the configured revenue multiples only after measured financial history meets `thresholds.valuationMinHistoryMonths` and integer minor-unit trailing revenue exists.

Cashflow valuation is separately eligible only after `thresholds.valuationCashflowMinHistoryMonths` and measured trailing cashflow exist.

Current state: `SKIP_NO_DATA`. Monthly SEO P&L history is 0 months and trailing revenue/cashflow are null, so no monetary valuation range is produced.

Calibration requires a current timestamp, minimum configured sample size and configured minimum rank correlation. Until observations exist, calibration remains `SKIP_NO_DATA`.
