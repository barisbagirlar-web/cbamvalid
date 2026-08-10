# Phase 17 — Portfolio Economics

- Required P&L history is config-driven; current monthly history is **0**, so portfolio decision execution is `SKIP_NO_DATA`.
- Phase-11 KAC recommendations are all null and the Phase-12 kill queue is empty. No INVEST/HOLD/HARVEST/DIVEST result is fabricated.
- Concentration above the configured threshold cannot pass without a diversification plan.
- DIVEST is never automatic and requires the full four-step execution chain.
- Any executed budget split differing from `economics.budgetSplit` requires an A3 approval record.
- Portfolio decisions require P&L history + KAC recommendation + kill-queue evaluation + A3 approval.
- Payback calibration remains `SKIP_NO_DATA` until projected/actual observations exist and the configured observation age is met.
- HARVEST is maintenance-only; new investment requests are rejected.
- Cross-site portfolio concentration is `SKIP_NO_DATA` because only this repository's site data is connected.
- No runtime files changed. **NO DEPLOY**.
