# Phase 18 — Programmatic Factory

- Registered template: `cn-code-detail-v1`; status remains **candidate**.
- Existing CN detail pages are preserved; Phase 18 publishes no new batch.
- Gate-in requires Phase-17 `INVEST`, Phase-16 `programmatic_longtail`, structured refreshable data, unique per-page intent, config-bounded pilot, completed observation window, full pilot indexation and positive impressions.
- Current portfolio has no qualifying `INVEST` decision, therefore publication is **BLOCKED_NO_INVEST_PROGRAMMATIC_CLUSTER**.
- No invariant exemptions are permitted.
- Batch review size, pilot size, observation window, index threshold and similarity threshold come from config.
- Under-indexing can only propose noindex and A3 escalation; it cannot auto-delete or silently deindex pages.
- Rollback requires exact batch route inventory, revert-commit proof, noindex fallback and proof that the pre-batch route set is restored.
- Median batch similarity must remain strictly below `thresholds.similarityMax`.
- No runtime page was added or changed. **NO DEPLOY**.

ROLLBACK: revert the Phase-18 merge. Because this phase does not publish runtime pages, no production release rollback is required.
