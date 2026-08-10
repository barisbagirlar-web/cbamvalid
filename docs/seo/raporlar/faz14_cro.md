# Faz 14 — Intent / CRO / Consent

- `/product` source-evidence intent rubric: **44/49**, config gate **35**.
- Consent Mode v2 is default-denied before public hydration with `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` signals.
- Public users can allow/decline analytics and reopen privacy settings; ad storage/user-data/personalization remain denied.
- No acquisition session storage, analytics `dataLayer` event, first-party `/api/seo/track` request or GA4 event is produced before explicit analytics consent.
- When consent is granted, the current page is measured from that point forward; denied/unset states are covered by negative delivery tests.
- Consent change is recorded as a measurement structural-break candidate; effective time stays null until deployment.
- Experiment contract requires primary metric, guardrails, sample size, MDE, decision rule, config minimum duration, lock timestamp and A3 approval.
- Peeking is blocked. Experiment variants must be noindex/out of sitemap/canonical-to-control/bot-equivalent.
- No A3 approval exists, so **no experiment is started** and no conversion winner/lift is fabricated.
- Runtime public layout/analytics changes require exact merged-SHA production deployment after merge.
