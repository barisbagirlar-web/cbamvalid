# Faz 11 — KAC + Portföy

- Exact registry dry-run: **36 primary cluster / 36 unique owner**; cannibalization owner conflict found: 0.
- GSC position/CTR and GA4/CVR inputs are unavailable, so 36/36 clusters are `partial:true`; priority score, 9-state assignment and INVEST recommendation are not fabricated.
- Industry CTR fallback is prohibited. Future striking-distance rows must explicitly classify `POSITION` vs `CTR` gap.
- Priority formula is transparent: `expectedExtraClicks × cvr × conversionValueMinor × confidenceMultiplier ÷ effort`.
- V6 confidence policy is explicit: high `1.0`, medium `0.7`, low `0.4`; current evidence state is low-confidence and no multiplier is applied to a score because required measurements are missing.
- INVEST additionally requires measured payback `productionCostMinor ÷ monthlyExpectedValueMinor <= economics.paybackMaxMonths`; the threshold is read from site config.
- Concurrent action capacity is read from `site.maxConcurrentKacActions`; current queue is empty rather than guessed.
- Portfolio registry writes remain read-only in Phase 11: an actual decision requires `KARAR_DEFTERI` evidence and the Phase-01 single writer.
- Runtime application behavior is unchanged; deploy is not required.
