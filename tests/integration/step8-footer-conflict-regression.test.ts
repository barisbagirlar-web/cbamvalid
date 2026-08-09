import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Step 8 footer CSS conflict regression", () => {
  const css = read("app/step8-footer-hotfix.css");
  const layout = read("app/layout.tsx");

  it("loads the legacy-conflict override after the premium Step 8 stylesheet", () => {
    expect(layout.indexOf('import "./step8-premium-actions.css";')).toBeGreaterThan(-1);
    expect(layout.indexOf('import "./step8-footer-hotfix.css";')).toBeGreaterThan(
      layout.indexOf('import "./step8-premium-actions.css";')
    );
  });

  it("hard-resets the wrapper that the legacy selector incorrectly painted orange", () => {
    expect(css).toContain("step8-footer-legacy-reset");
    expect(css).toContain('main:has(section[aria-label="Final review status"]):has([data-testid="step8-primary-action"]) > div.fixed.bottom-0 > div > div');
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("border: 0 !important");
    expect(css).toContain("box-shadow: none !important");
  });

  it("forces a stable three-column desktop hierarchy", () => {
    expect(css).toContain("grid-template-columns: minmax(150px, 190px) minmax(190px, 240px) minmax(380px, 1fr) !important");
    expect(css).toContain("grid-column: 1 !important");
    expect(css).toContain("grid-column: 2 !important");
    expect(css).toContain("grid-column: 3 !important");
  });

  it("keeps ready-to-lock green while payment and blocked states stay distinct", () => {
    expect(css).toContain("#2d6a4f !important");
    expect(css).toContain("#d4a017 !important");
    expect(css).toContain("#9b2226 !important");
  });
});
