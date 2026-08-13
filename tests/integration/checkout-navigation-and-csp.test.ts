import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("checkout navigation and Paddle Retain CSP", () => {
  it("sends working-file actions to the Cases workspace", () => {
    const page = read("app/(workspace)/credits/buy/page.tsx");
    expect(page).toContain('href="/cases"');
    expect(page).toContain('"/cases?purchase=success"');
    expect(page).not.toContain('href="/cbam"');
  });

  it("permits Paddle Retain/ProfitWell without broadening the entire CSP", async () => {
    const { buildContentSecurityPolicy } = await import("../../lib/security/csp");
    const proxy = read("proxy.ts");
    const config = read("next.config.js");
    const csp = buildContentSecurityPolicy({
      nonce: "contract-nonce",
      isDevelopment: false,
      allowFirebaseEmulator: false,
      paddleSandbox: false,
    });

    expect(csp).toContain("https://public.profitwell.com");
    expect(csp).toContain("https://*.profitwell.com");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).not.toContain("sandbox-cdn.paddle.com");
    expect(csp).not.toContain("127.0.0.1:5001");
    expect(proxy).toContain("buildContentSecurityPolicy");
    expect(proxy).toContain("X-Robots-Tag");
    expect(proxy).toContain('headers.delete("x-powered-by")');
    expect(config).toContain("poweredByHeader: false");
    expect(config).not.toMatch(/key:\s*['"]Content-Security-Policy['"]/);
  });
});
