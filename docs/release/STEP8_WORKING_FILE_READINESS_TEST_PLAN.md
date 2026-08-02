# Step 8 Verification Commands

Run in this order:

```bash
npm run typecheck
npm run build:functions
npm run lint
npx vitest run tests/cbam-engine/working-file-readiness.test.ts
npm run test:integration
npm run test:cbam-engine
npm run test:reports
npm run ci:gate
```

Required result: every command exits with code 0. A failing command blocks merge.
