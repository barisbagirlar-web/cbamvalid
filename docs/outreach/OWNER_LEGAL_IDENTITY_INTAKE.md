# Owner — Legal Identity Intake (T1.3)

**Status:** PUBLISHED 2026-07-28 · owner-verified values in `lib/legal-identity.ts`  
**Public surfaces:** footer · `/legal-notice` · `/contact` · `/privacy` · `/trust`

## Published values

```bash
LEGAL_CRO=315881
LEGAL_VAT=IE1857162AB
LEGAL_REGISTERED_ADDRESS=4th Floor, One Burlington Plaza, Burlington Road, Dublin 4, Ireland
LEGAL_SUPPORT_PHONE=+353 (0)1 676 2671
LEGAL_DPO=Siobhan O'Connor, Data Protection Officer <info@cbamvalid.com>
LEGAL_COUNTRY=Ireland
```

Env overrides still win if set in Firebase / `.env.local` for emergency correction.

## Still open (commercial)

1. Paddle **live** catalog = USD 449 (sandbox already proven)
2. `npm run prove:paddle-amount` with live API key → `PROVE_PADDLE_LIVE=PASS`
