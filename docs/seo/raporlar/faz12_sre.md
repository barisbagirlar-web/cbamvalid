# Faz 12 — SEO SRE

- Five governed SLOs are implemented: field CWV, cohort indexation, discovery lag, organic value, evidence freshness.
- Missing GSC/CrUX/value data stays `SKIP_NO_DATA`; no proxy number is invented.
- All machine thresholds come from `seo.config`; literal threshold references are rejected.
- A governed breach requires a GitHub issue. Daily workflow creates or comments on the exact breach issue and uploads machine evidence.
- Repeated breaches can only produce a deploy-freeze proposal; automatic freeze/deploy/merge is forbidden and A3 remains required.
- Alarm reopen count triggers calibration at the configured threshold.
- Kill candidates are queued for portfolio decision; overdue triggered assets without a non-INVEST decision BLOCK. No automatic HARVEST/DIVEST is executed.
- Current baseline: four measurement SLOs `SKIP_NO_DATA`, evidence freshness PASS, kill queue empty, no freeze proposal.
- Runtime application behavior is unchanged; deploy is not required.
