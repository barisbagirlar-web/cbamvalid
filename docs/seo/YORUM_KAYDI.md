# YORUM KAYDI — cbamvalid SEO V6

## 2026-08-09T12:29:00Z

- Rule: AIP-03 vs source phase outputs.
- Ambiguity: source global manifest omits files/runtime surfaces required by later phase bodies.
- Restrictive interpretation: global manifest is a superset only; active `PHASE_CONTRACTS.json` is the narrower enforceable write boundary.
- Result: later phases cannot write merely because a path appears in the global manifest.

## 2026-08-09T12:29:00Z

- Rule: AIP-11 date format.
- Ambiguity: regulatory factual dates are calendar dates, not events/timestamps.
- Restrictive interpretation: event/audit timestamps require UTC ISO-8601; factual calendar dates remain ISO `YYYY-MM-DD`.
