import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("private report download integrity gate", () => {
  it("requires a matching object SHA-256 before issuing a signed URL", () => {
    const source = readFileSync(
      resolve(process.cwd(), "functions/src/handlers/reports.ts"),
      "utf8"
    );
    const downloadHandler = source.slice(source.indexOf("export const getReportDownloadUrl"));

    expect(downloadHandler).toContain('!/^[a-f0-9]{64}$/.test(storedHash)');
    expect(downloadHandler).toContain("storedHash !== entry.sha256.toLowerCase()");
    expect(downloadHandler).not.toContain("(storedHash && storedHash !== entry.sha256.toLowerCase())");
  });
});
