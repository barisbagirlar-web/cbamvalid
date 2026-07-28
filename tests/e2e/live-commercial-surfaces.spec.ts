/**
 * Live public commercial messaging smoke (no auth / no card).
 * Proves pay-at-lock copy + sitemap/llm surfaces after deploy.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.LIVE_BASE_URL || "https://cbamvalid.com";

test.describe("live pay-at-lock commercial surfaces", () => {
  test("pricing speaks pay-at-lock, not five seals", async ({ request }) => {
    const res = await request.get(`${BASE}/pricing`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("pay once");
    expect(html.toLowerCase()).not.toMatch(/five seals|exactly 5 sealed|5 successful seals/);
    expect(html).toContain("449");
  });

  test("homepage step 4 is pay-at-lock", async ({ request }) => {
    const res = await request.get(`${BASE}/`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).not.toContain("five seals");
  });

  test("llm.txt matches pay-at-lock SSOT", async ({ request }) => {
    const res = await request.get(`${BASE}/llm.txt`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toMatch(/pay once|pay-at-lock|lock this/);
    expect(text.toLowerCase()).not.toMatch(/exactly 5 sealed releases/);
  });

  test("sitemap index is hostable", async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toMatch(/sitemap\/0\.xml/);
  });

  test("terms commercial-terms anchor exists", async ({ request }) => {
    const res = await request.get(`${BASE}/terms`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/id=["']commercial-terms["']/);
  });
});
