#!/usr/bin/env npx tsx
import { submitIndexNow } from "../../lib/seo/submit-indexnow";

async function main() {
  const result = await submitIndexNow();
  console.log(`IndexNow submitted ${result.submitted} URLs`);
  for (const row of result.results) {
    const mark = row.ok ? "PASS" : "FAIL";
    console.log(`${mark} ${row.endpoint} status=${row.status ?? "n/a"} ${row.detail}`);
  }
  // Fail-open for CI/deploy: IndexNow is additive discovery, not a release gate.
  process.exit(0);
}

main().catch((error) => {
  console.error("IndexNow submit failed open:", error);
  process.exit(0);
});
