# Paddle Secret Rotation Required

## Status

`EXTERNAL_BLOCKER`

Paddle credential-shaped values were previously present in repository configuration history. Removing them from the current source does not invalidate credentials that may already have been exposed.

## Required external actions

1. Revoke the previously used Paddle sandbox API key.
2. Revoke and replace the previously used Paddle client-side token if it was an API credential rather than a restricted client-side token.
3. Rotate the Paddle webhook endpoint secret.
4. Create or update managed secrets named:
   - `PADDLE_API_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_CLIENT_TOKEN`
5. Bind private secrets only to the backend functions that need them.
6. Confirm that the browser bundle contains only the restricted Paddle client token and no private API key.
7. Run a controlled sandbox transaction and webhook replay test after rotation.
8. Repeat with Paddle Live before declaring revenue readiness.

## Acceptance evidence

- rotation timestamps;
- secret version identifiers, not secret values;
- deployed backend revision;
- browser bundle scan;
- controlled transaction ID;
- webhook event ID;
- duplicate replay delta of zero.

Do not paste secret values into issues, pull requests, logs, screenshots or release reports.
