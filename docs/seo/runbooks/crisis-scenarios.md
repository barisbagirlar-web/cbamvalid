# SEO Crisis Scenario Cards

These cards define response logic. They do not claim that a crisis has occurred or that private measurements are available.

## Scenario A — Organic visibility decline

### Detection signal
A material decline is confirmed only from available first-party search-performance data against the governed comparison window. If GSC/search-performance data is unavailable, this scenario remains `SKIP_NO_DATA`; no traffic-loss percentage is inferred.

### First four hours
1. Freeze unrelated SEO/runtime releases.
2. Check Search Console availability, manual actions and security notices.
3. Compare affected route/cluster cohorts without crossing structural breaks.
4. Verify robots, sitemap, canonical, redirects, rendered metadata and HTTP status.
5. Separate technical fault from search-demand/algorithm change before proposing a fix.

### Decision tree
Technical regression found → contain/rollback through the Phase-10 migration runbook.  
No technical regression + measured search decline → preserve evidence and open analysis; do not mass-rewrite or mass-noindex.  
No measurement access → `SKIP_NO_DATA`; no loss claim.

### Communication template
State measured scope, affected cohorts, evidence window, technical findings, current containment state and missing data. Do not promise recovery dates or rankings.

## Scenario B — Manual action / search-policy notice

### Detection signal
Only a directly observed Search Console/manual-action or equivalent primary-source notice qualifies. Third-party speculation does not.

### First four hours
1. Freeze unrelated SEO publication/release work.
2. Capture the exact notice, affected scope and UTC timestamp.
3. Preserve current page/link evidence before remediation.
4. Map the cited issue to the relevant V6 invariant and owner.
5. Prepare a reversible remediation PR; do not use blanket deletion/disavow shortcuts.

### Decision tree
Verified manual action → remediate only the evidenced violation and document approval/evidence.  
Suspected negative SEO without qualifying evidence → audit only; no disavow execution.  
No primary notice → do not label the event a manual action.

### Communication template
Report the exact primary notice, scope, evidence preserved, proposed reversible correction and approval required. Do not characterize reconsideration outcome as guaranteed.

## Scenario C — Technical discovery/indexing disaster

### Detection signal
Examples: unexpected public noindex, robots blocking, canonical-origin drift, redirect loop, widespread public 4xx/5xx, sitemap conflict or critical rendered SEO loss.

### First four hours
1. Freeze releases and capture deployed SHA.
2. Preserve failing raw/rendered HTTP evidence.
3. Compare deployed SHA with last known-good tested SHA.
4. Check robots, sitemap, canonical, redirects and representative route classes.
5. Prefer exact known-good rollback when the regression is release-caused.

### Decision tree
Known release regression + known-good rollback → rollback exact SHA through approved dispatcher.  
External DNS/hosting cause → escalate to authorized human operator; do not improvise destructive infrastructure actions.  
Root cause uncertain → contain and gather evidence before further changes.

### Communication template
State affected surfaces, deployed SHA, evidence, containment/rollback status and next verification gate. Never report ranking or revenue impact without measured data.

## Scenario D — Organic value / conversion crisis

### Detection signal
A material value decline is recognized only from governed P&L/conversion evidence. Stable clicks with lower value is an economics/conversion problem, not automatically an SEO visibility problem. If conversion attribution/value feeds are unavailable, status is `SKIP_NO_DATA`.

### First four hours
1. Preserve current P&L and conversion evidence window.
2. Verify that click/search demand did not materially change before blaming acquisition.
3. Validate checkout/commerce and conversion instrumentation health.
4. Route economic allocation decisions to Phase 17 and conversion/intent diagnosis to Phase 14.
5. Do not change indexation, canonical structure or content at scale merely to react to unverified revenue loss.

### Decision tree
Traffic stable + measured value down → Phase 14 conversion/intent diagnosis + Phase 17 economics.  
Traffic and value both down → separate the acquisition and conversion components before action.  
Value data unavailable → `SKIP_NO_DATA`; no revenue-loss claim.

### Communication template
State what is measured, what is not measured, acquisition state, conversion/economic state and the responsible phase. Do not substitute SEO activity for a conversion/economics diagnosis.
