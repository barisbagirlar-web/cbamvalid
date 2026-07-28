import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  fieldHelpData,
  requiredFieldHelpKeys,
} from "../../lib/cbam/field-help";

describe("case wizard field-help coverage", () => {
  it("provides source, evidence and format guidance for every declared field", () => {
    expect(requiredFieldHelpKeys.length).toBeGreaterThanOrEqual(35);

    for (const key of requiredFieldHelpKeys) {
      const help = fieldHelpData[key];
      expect(help.source.trim().length, `${key}.source`).toBeGreaterThan(20);
      expect(help.evidence.trim().length, `${key}.evidence`).toBeGreaterThan(20);
      expect(help.format.trim().length, `${key}.format`).toBeGreaterThan(20);
    }
  });

  it("binds every declared help key into the case wizard", () => {
    const wizardPath = path.join(
      process.cwd(),
      "app/(workspace)/cases/[caseId]/CaseWizardClient.tsx"
    );
    const wizardSource = fs.readFileSync(wizardPath, "utf8");

    for (const key of requiredFieldHelpKeys) {
      expect(wizardSource, `missing wizard help binding: ${key}`).toContain(key);
    }
  });
});
