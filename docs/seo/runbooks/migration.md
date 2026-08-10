# SEO Migration Runbook

Status: controlled procedure — no migration is authorized by this document alone.

## Scope
Use this runbook for domain, host, canonical-origin, routing, rendering-platform, sitemap architecture, or other changes that can materially alter indexation or URL identity.

## Mandatory preconditions
A migration cannot start unless all of the following are recorded:

1. exact current production SHA and exact candidate SHA;
2. explicit human approval for the migration scope;
3. complete old-URL → destination mapping for every affected indexable URL;
4. tested rollback SHA and rollback owner;
5. current robots, sitemap, canonical, hreflang and redirect evidence captured before the change;
6. build, SEO conformance, regression/E2E, security and release gates green on the exact candidate;
7. DNS/TLS/hosting ownership verified by a human operator when those controls are involved;
8. production release is from merged `main`, never an unmerged PR head.

## No-go conditions
Stop before execution if any mandatory precondition is missing, the candidate has failing/skipped required checks, the rollback target is unknown, or the change would require an irreversible control without a separately recorded human decision.

The runbook never authorizes destructive project/domain deletion, force-pushing protected history, automatic PR merge, mass removal of canonical pages, blanket public-site blocking, or any production release from an unverified SHA.

## Execution sequence
1. Freeze unrelated SEO/runtime changes for the migration window.
2. Reconfirm `main` and candidate SHAs immediately before release.
3. Validate redirect mapping for single-hop canonical destinations and capacity.
4. Validate rendered title, description, H1, canonical and hreflang on representative route classes.
5. Validate robots and sitemap parity against the governed registry.
6. Release only the exact merged and tested SHA through the approved production dispatcher.
7. Record release identifier, timestamp, deployed SHA and rollback target.
8. Run post-release HTTP/render checks before lifting the change freeze.

## Rollback triggers
Rollback is mandatory when a release causes any of the following and cannot be safely corrected in-place inside the approved window:

- canonical origin or canonical destination drift;
- public routes unexpectedly returning 4xx/5xx;
- indexable routes becoming blocked/noindex;
- redirect loops, chains, or wrong destinations;
- robots/sitemap conflict;
- critical rendered metadata loss;
- authentication, checkout, report or core-product regression attributable to the migration.

## Rollback procedure
1. Freeze further releases.
2. Capture failing production evidence and current deployed SHA.
3. Revert to the pre-recorded rollback SHA only through the approved production release path.
4. Re-run HTTP, rendered SEO, robots, sitemap and critical-flow verification.
5. Keep the migration closed until root cause and a new exact candidate are independently re-tested.

## Evidence required for closure
- exact tested candidate SHA;
- exact merged SHA;
- exact deployed SHA when a production release occurred;
- redirect/canonical/robots/sitemap verification output;
- required CI results;
- rollback SHA;
- human approval record for any irreversible/external control;
- UTC execution and verification timestamps.

Missing external/private measurement does not permit fabricated ranking, traffic, conversion or revenue claims.