# External Blockers

1. Rotate previously exposed Paddle credential versions.
2. Create the required Secret Manager entries and bind them to the actual Firebase Functions runtime used in production.
3. Configure real Paddle sandbox price and webhook endpoint values, then prove a controlled sandbox transaction.
4. Switch to Paddle Live only after sandbox payment, replay and seal-package chains pass.
5. Deploy the accepted source SHA to `cbam-desk` and record the deployed/live SHA.
6. Complete the production browser E2E and runtime-log review.

These actions require external account or production-runtime access and cannot be inferred from repository source.
