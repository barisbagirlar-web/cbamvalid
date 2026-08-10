# FAZ 08 — Crawl economy / verified bot identity

Status: CODE SCOPE COMPLETE / PRODUCTION LOG MEASUREMENT PARTIAL

## 1. Crawl waste

No production crawler request log is connected to the execution environment. The Phase-08 evaluator therefore returns `SKIP_NO_DATA` instead of estimating crawl waste from robots.txt, sitemap size or synthetic requests.

When logs are supplied, the evaluator uses `thresholds.crawlWasteWarnPct` from the site config and classifies observed crawler requests to private/blocked sections, HTTP error responses and query variants. Synthetic coverage proves an above-threshold measured sample produces WARN.

## 2. Verified bot identity

User-Agent is classification input only; it is never identity proof.

Implemented proof strategies:
- Googlebot: reverse DNS must end in a governed Google crawler hostname suffix and a forward lookup must resolve back to the original source IP. Primary source: https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests
- OAI-SearchBot: source IP must match the supplied current official manifest identified as https://openai.com/searchbot.json
- OAI-AdsBot: source IP must match the supplied current official manifest identified as https://openai.com/adsbot.json
- PerplexityBot: source IP must match the supplied current official manifest identified as https://www.perplexity.com/perplexitybot.json
- Perplexity-User: source IP must match the supplied current official manifest identified as https://www.perplexity.com/perplexity-user.json
- GPTBot / ClaudeBot: no independently governed provider proof mechanism is configured in this phase; matching UA traffic therefore remains `UNVERIFIED` rather than being trusted.

The code does not cache current provider IP ranges in the repository. Provider ranges can change; the exact manifest used for a verification decision must be supplied with the observation.

## 3. Spoof protection

`tests/conformance/inv-8-3.test.ts` proves that a request claiming Googlebot while resolving to an attacker-owned hostname is rejected. Separate positive fixtures prove reverse+forward Google verification and governed published-manifest CIDR matching. IPv4 and IPv6 CIDR matching are both covered.

## 4. Discovery lag

No production crawl timestamps and no GSC discovery/index timestamps are connected. Result: `SKIP_NO_DATA` under E-35. No discovery-lag number is inferred.

## 5. Runtime policy

Existing robots behavior was not changed. Public wildcard and named search crawlers already preserve the private-section disallow boundary established in Phase 03. Phase 08 therefore adds verification/economy controls without an unnecessary production robots deployment.

## 6. Invariants

- INV-8.1 — `SKIP_NO_DATA`: no production request-log sample; synthetic WARN behavior tested.
- INV-8.2 — `SKIP_NO_DATA`: no paired discovery timestamps.
- INV-8.3 — PASS: fail-closed verified-bot identity gate; spoof negative fixture PASS.

## 7. Deployment

**NO DEPLOY** — Phase-08 changes are scripts, tests, measurement artifacts and documentation only. Public runtime/robots behavior is unchanged.

ROLLBACK: revert the Phase-08 merge; this removes verification/economy controls but does not alter live application behavior.
