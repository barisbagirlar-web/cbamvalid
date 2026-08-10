import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED = [
  "## Mandatory preconditions",
  "## No-go conditions",
  "## Execution sequence",
  "## Rollback triggers",
  "## Rollback procedure",
  "## Evidence required for closure",
] as const;

function validateRunbook(text: string): string[] {
  const errors: string[] = [];
  for (const heading of REQUIRED) {
    if (!text.includes(heading)) errors.push(`missing:${heading}`);
  }
  if (!/exact (current production SHA|tested candidate SHA)/i.test(text)) errors.push("missing:exact-sha-control");
  if (!/rollback SHA/i.test(text)) errors.push("missing:rollback-sha");
  if (!/merged `main`/i.test(text)) errors.push("missing:merged-main-release-boundary");
  if (!/human approval/i.test(text)) errors.push("missing:human-approval-boundary");
  return errors;
}

describe("INV-10.1 migration runbook required", () => {
  it("accepts the governed migration runbook", () => {
    const text = readFileSync(resolve(process.cwd(), "docs/seo/runbooks/migration.md"), "utf8");
    expect(validateRunbook(text)).toEqual([]);
  });

  it("fails closed when rollback/evidence sections are absent", () => {
    const unsafe = `# Migration\n## Mandatory preconditions\nexact current production SHA\nhuman approval\nmerged \`main\`\n## No-go conditions\n## Execution sequence\n`;
    const errors = validateRunbook(unsafe);
    expect(errors).toContain("missing:## Rollback triggers");
    expect(errors).toContain("missing:## Rollback procedure");
    expect(errors).toContain("missing:## Evidence required for closure");
    expect(errors).toContain("missing:rollback-sha");
  });
});