import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  isPaddleSandboxEnvironment,
} from "../../lib/security/csp";

describe("production CSP contract", () => {
  it("keeps production scripts nonce-based while inline styles remain browser-effective", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: false,
      allowFirebaseEmulator: false,
      paddleSandbox: false,
    });

    expect(csp).toContain("'nonce-test-nonce'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/style-src[^;]*'nonce-test-nonce'/);
    expect(csp).not.toContain("style-src-attr");
    expect(csp).not.toContain("127.0.0.1");
    expect(csp).not.toContain("localhost");
    expect(csp).not.toContain("sandbox-cdn.paddle.com");
    expect(csp).toContain("https://cdn.paddle.com");
    expect(csp).toContain("https://public.profitwell.com");
    expect(csp).toContain("https://*.profitwell.com");
  });

  it("allows emulator and sandbox hosts only when gated on", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      isDevelopment: true,
      allowFirebaseEmulator: true,
      paddleSandbox: true,
    });

    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toContain("http://127.0.0.1:5001");
    expect(csp).toContain("http://localhost:5001");
    expect(csp).toContain("sandbox-cdn.paddle.com");
  });

  it("classifies paddle sandbox from either env flag", () => {
    expect(isPaddleSandboxEnvironment("sandbox", "production")).toBe(true);
    expect(isPaddleSandboxEnvironment("production", "sandbox")).toBe(true);
    expect(isPaddleSandboxEnvironment("production", "production")).toBe(false);
  });
});
