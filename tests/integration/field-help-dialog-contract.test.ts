import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("field-help dialog viewport contract", () => {
  it("renders guidance inside a closable viewport-bounded modal", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "components/cbam/FieldHelp.tsx"),
      "utf8"
    );

    expect(source).toContain('className="fixed inset-0 z-[100]');
    expect(source).toContain('max-h-[calc(100dvh-2rem)]');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("event.key === \"Escape\"");
    expect(source).toContain("setOpen(false)");
    expect(source).toContain("Close data-source help");
    expect(source).toContain("overflow-y-auto");
  });
});
