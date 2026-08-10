# Annual SEO Crisis Drill

## Purpose
Exercise detection, containment, rollback and evidence capture without touching production.

## Drill scenarios
At minimum simulate one canonical-origin failure, one robots/sitemap conflict and one redirect failure against fixtures or a non-production environment.

## Required evidence
- drill date in UTC;
- participants/owner;
- scenario inputs;
- detection and containment timestamps;
- selected rollback target;
- verification output;
- gaps and corrective actions.

## Production safety
The drill must not modify production DNS, hosting, robots, redirects, canonical output, indexing state or deployment refs. It must not create a real public incident merely to prove the runbook.

## Current completion state
No independently evidenced annual drill completion record is available in the connected repository/data sources as of 2026-08-10. Phase evidence therefore records INV-10.3 as `SKIP_NO_DATA`; this document defines the executable procedure but does not fabricate a completed drill.