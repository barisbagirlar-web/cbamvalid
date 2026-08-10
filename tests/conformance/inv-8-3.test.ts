import { describe, expect, it } from "vitest";
import { verifyObservedBot } from "../../scripts/seo/bot-identity";

describe("INV-8.3 verified bot identity", () => {
  it("BLOCK-equivalent rejects a spoofed Googlebot user-agent with hostile DNS", () => {
    const result = verifyObservedBot({
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      sourceIp: "203.0.113.10",
      reverseHostnames: ["crawl-203-0-113-10.attacker.example"],
      forwardResolvedIps: ["203.0.113.10"],
    });
    expect(result.family).toBe("googlebot");
    expect(result.status).toBe("UNVERIFIED");
    expect(result.reason).toMatch(/outside the provider-owned suffix/i);
  });

  it("requires reverse and forward confirmation for Googlebot", () => {
    const result = verifyObservedBot({
      userAgent: "Googlebot/2.1",
      sourceIp: "66.249.66.1",
      reverseHostnames: ["crawl-66-249-66-1.googlebot.com"],
      forwardResolvedIps: ["66.249.66.1"],
    });
    expect(result.status).toBe("VERIFIED");
    expect(result.evidenceMethod).toBe("reverse-forward-dns");
  });

  it("requires both governed source identity and CIDR membership for OAI-SearchBot", () => {
    const result = verifyObservedBot({
      userAgent: "Mozilla/5.0; compatible; OAI-SearchBot/1.0",
      sourceIp: "192.0.2.42",
      providerManifestSource: "https://openai.com/searchbot.json",
      providerManifest: { prefixes: [{ ipv4Prefix: "192.0.2.0/24" }] },
    });
    expect(result.status).toBe("VERIFIED");
    expect(result.evidenceMethod).toBe("published-ip-manifest");
  });

  it("never trusts GPTBot user-agent alone when no provider proof method is configured", () => {
    const result = verifyObservedBot({
      userAgent: "Mozilla/5.0; compatible; GPTBot/1.0",
      sourceIp: "192.0.2.42",
    });
    expect(result.family).toBe("gptbot");
    expect(result.status).toBe("UNVERIFIED");
  });
});
