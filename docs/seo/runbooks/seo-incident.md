# SEO Incident Containment Runbook

## Trigger conditions
Use this procedure for material canonical drift, robots/sitemap conflict, widespread 4xx/5xx, unexpected noindex/blocking, redirect failure, rendered critical-content loss, or a release that materially breaks public discovery paths.

## First 15 minutes
1. Freeze unrelated production releases.
2. Record UTC detection time, reporter, current `main` SHA and deployed SHA if known.
3. Capture failing URLs and raw/rendered evidence before changing anything.
4. Classify whether the fault is application, redirect, robots/sitemap, DNS/TLS/hosting, or external measurement only.
5. Do not infer ranking/revenue loss from symptoms without measured data.

## Containment
- Prefer rollback to a known-good exact SHA over broad emergency rewrites.
- Do not delete projects/domains, force-push history, auto-merge, blanket-block the public site, or perform irreversible external actions as an incident shortcut.
- Do not deploy an unmerged or untested PR head.
- External DNS/hosting controls require the authorized human operator.

## Verification after containment
Check representative public routes for status, canonical, robots directives, sitemap membership, title, description, H1 and critical application flows. Record exact evidence and the rollback/corrective SHA.

## Closure
An incident closes only after root cause is documented, corrective/rollback evidence is captured, required checks are green, and any remaining private-data gaps are explicitly marked unavailable rather than estimated.