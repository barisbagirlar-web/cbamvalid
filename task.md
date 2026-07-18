# CBAMValid Mandate v3.0 — Task List

## Component 1: Schema Updates
- [x] `lib/seo/schema.ts` — add `generateEnterpriseGraphSchema(currentPath: string)`
- [x] `app/(public)/page.tsx` — inject `@graph` schema
- [x] `app/(public)/methodology/page.tsx` — inject `@graph` schema + `Article` schema

## Component 2: Programmatic SEO & Calculator UI
- [x] `app/(public)/cn-codes/[code]/[sector]/page.tsx` — inject `@graph` schema & interactive calculator widget
- [x] `app/(public)/sectors/[sector]/page.tsx` — inject `@graph` schema & verify eur-lex outbound links

## Component 3: LLM Discoverability (AEO)
- [x] `public/llms-full.txt` — expand to 500+ words with IIT Bombay methodologies and sector rules
- [x] `public/llms.txt` — include Academic Oversight references

## Component 4: CI/CD Release Gates
- [x] `scripts/ci-seo-gate.ts` — create automated validation script
- [x] `package.json` — add `"ci:seo-gate"` script and add it to build/release gates

## Verification
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run ci:seo-gate`
- [x] `npm run build`
- [x] `npx firebase deploy`
