import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "app/(workspace)/credits/buy/page.tsx"),
  "utf8"
);

describe("checkout query hydration", () => {
  it("keeps the first server and browser render identical", () => {
    expect(page).toContain('const [caseId, setCaseId] = useState("")');
    expect(page).toContain("window.setTimeout(() => setCaseId(nextCaseId), 0)");
    expect(page).not.toContain('if (typeof window === "undefined") return ""');
    expect(page).not.toContain("const caseId = useMemo");
  });

  it("retains the correct working-files destination", () => {
    expect(page).toContain('href="/cases"');
    expect(page).not.toContain('href="/cbam"');
  });
});
