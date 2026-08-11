/**
 * Zero-Dark Policy — Enterprise Compliance Master Record renderer must never
 * emit dark navy / white-on-dark table headers (gold-standard mandate).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildV6Package, masterRecordPdfText } from "./gate-helpers";

const RENDERER = join(process.cwd(), "functions/src/cbam/report/v6/master-record-pdf.ts");

describe("G-13 master-record zero-dark policy", () => {
  it("forbids dark navy table-header fills in the renderer source", () => {
    const source = readFileSync(RENDERER, "utf8");
    expect(source).not.toMatch(/setFillColor\(\s*20\s*,\s*42\s*,\s*74\s*\)/);
    expect(source).not.toMatch(/setTextColor\(\s*255\s*,\s*255\s*,\s*255\s*\)/);
    expect(source).toMatch(/Zero-Dark/);
    expect(source).toMatch(/SURFACE_SOFT/);
  });

  it("renders a light surface master record with the single-line page footer", async () => {
    const built = await buildV6Package("STEEL_IN");
    const { text, pages, bytes } = await masterRecordPdfText(built.masterRecordModel);
    expect(pages).toBeGreaterThanOrEqual(30);
    expect(pages).toBeLessThanOrEqual(44);
    expect(text).toContain("Enterprise Compliance Master Record");
    expect(text).toMatch(/Page\s+1\s*\/\s*\d+/);
    expect(text).toContain("Operator record. No independent verification opinion is implied.");
    // Dark navy (20,42,74) encoded as ~0.078 0.165 0.290 must not appear as a fill.
    const ascii = Buffer.from(bytes).toString("latin1");
    expect(ascii).not.toMatch(/0\.07\d+\s+0\.16\d+\s+0\.29\d+\s+rg/);
  }, 60_000);
});
