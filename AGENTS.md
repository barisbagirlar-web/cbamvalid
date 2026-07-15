<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global Working Protocol (GLOBAL ÜST SEVİYE ÇALIŞMA PROTOKOLÜ)

This protocol is the default working standard for all software development, web application, SaaS, automation, calculation engine, and technical pro-active tasks.

## 1. Communication and Prompt Discipline
- Prompts and replies must be concise, binding, and token-efficient.
- Do not repeat long prompts for the same topic.
- Avoid analysis loops, redundant option listings, and repeating topics.
- Select the strongest solution; document rejected alternatives in at most one line.
- If the issue is clearly defined, proceed to implementation immediately without unnecessary questions.

## 2. End-to-End Architectural Review
Every repair and implementation must trace the entire interaction chain:
User action → Frontend → Client state → Auth/session → API → Backend/service → Database → Storage → Calculation engine → Webhook/queue → Build → Environment → Deploy → Hosting/runtime → Live user outcome.
If a component changes, verify all callers, dependencies, side effects, shared services, database writes, and auth boundaries.

## 3. Root Cause Approach
- No temporary workarounds or symptoms patching.
- Trace logs, call chains, data flow, state transitions, and dependency graphs.
- Identify the root cause using reverse engineering and cross-questioning.
- Never mark a task complete without explaining why the error occurred, which layers it affected, and why it wasn't caught earlier.

## 4. Permanent Remediation & Regression Safeguards
Every correction must include:
Root cause fix + Dependent layer validation + Regression testing + Failure-path testing + Guard verification + Live deployment validation.
The following are strictly banned:
- Temporary workarounds
- Scanner or compliance guard evasion
- Stub or placeholder data
- Try-catch blocks that swallow production failures
- Client-side security or authorization decisions
- Duplicated business rules across layers
- Hardcoded fake results

## 5. Proactive Risk Mitigation
Before executing, evaluate the following scenarios:
- Breakdown of other functional components.
- Race conditions and duplicate requests.
- Retry / idempotency problems.
- Data loss or mutation.
- Cross-user or cross-tenant exposure.
- Environment mismatches (local vs production).
- Cache and stale-state propagation.
- API contract breakage.
- Mixing of `null`, `zero`, `missing`, and `unknown` states.
- Divergence between test commit SHA and deployed SHA.
- Third-party dependency/service downtime.

## 6. Mathematical and Computational Integrity
Every calculation engine must enforce:
- Unit and dimensional consistency.
- Percentage vs decimal interpretation.
- Strict segregation of `null`, `missing`, and `zero` values (never convert missing/null to zero).
- Division-by-zero prevention.
- Handling of negative and extreme values.
- Reporting period consistency.
- Allocation reconciliation.
- Double-counting prevention.
- Deterministic reproducibility.
- Independent validation fixtures (do not generate expected values using the tested functions).

## 7. Production Readiness Verification
The following status indicators do NOT prove production readiness by themselves:
- TypeScript compilation pass
- Linter clean run
- Unit tests pass
- Build succeeded
- Local E2E tests pass
Production closing requires live verification of:
- Build-time environment validation
- Server/client bundle constraints
- Matching deployment SHA
- Live custom domain endpoint response
- Live E2E user flows
- Server runtime logs
- Cookie authentication checks
- Persistent database updates
- Third-party webhook integrations

## 8. Proof Standards
Do not state `PASS`, `fixed`, `production ready`, `sales ready`, `stable`, or `complete` without absolute evidence. If a behavior is not proven, clearly mark it as:
`NOT_PROVEN`, `NOT_IMPLEMENTED`, `FAIL`, or `EXTERNAL_BLOCKER`.

## 9. Closure Standard
Every final report must contain:
- Root cause identified
- Modified components list
- Permanent solution implemented
- Impacted user/data flows
- Tests executed
- Exit code
- Git commit SHA
- Deployment target/URL
- Live custom domain validation outcome
- Remaining genuine blockers (if any)

## 10. Scope
This protocol applies universally to all current and future projects, including:
- CBAMValid
- SectorCalc
- DrFin
- KobiFinansal
- isplani.com.tr
- BistAlarm

