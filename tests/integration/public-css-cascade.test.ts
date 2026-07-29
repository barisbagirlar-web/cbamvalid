import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public marketing CSS cascade", () => {
  it("keeps legacy resets below Tailwind component utilities", () => {
    const globals = readFileSync(resolve(root, "app/globals.css"), "utf8");
    const legacy = readFileSync(
      resolve(root, "public/assets/css/style.css"),
      "utf8"
    ).trim();

    expect(globals).toContain(
      "@layer theme, base, legacy-marketing, components, utilities;"
    );
    expect(globals.indexOf("@layer theme")).toBeLessThan(
      globals.indexOf('@import "tailwindcss"')
    );
    expect(legacy.startsWith("@layer legacy-marketing {")).toBe(true);
    expect(legacy.endsWith("}")).toBe(true);
    expect(legacy).toContain("*{margin:0;padding:0;box-sizing:border-box}");
    expect(legacy).toContain(".header-actions .btn-primary{display:none}");
  });

  it("retains responsive pricing containment utilities", () => {
    const pricing = readFileSync(
      resolve(root, "app/(public)/pricing/page.tsx"),
      "utf8"
    );
    const pricingLayout = readFileSync(
      resolve(root, "app/(public)/pricing/layout.tsx"),
      "utf8"
    );

    expect(pricing).toContain("max-w-5xl mx-auto");
    expect(pricing).toContain("grid-cols-1 md:grid-cols-2");
    expect(pricing).toContain("px-6 md:px-12 lg:px-24");
    expect(pricing).not.toContain("export const metadata");
    expect(pricingLayout).toContain('generateSeoMetadata("/pricing")');
  });
});
