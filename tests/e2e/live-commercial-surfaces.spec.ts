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

  test("sitemap is hostable and canonical", async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const xml = await res.text();
    // Single-registry sitemap: 47 URLs render as a flat <urlset> (sitemapindex
    // splitting only kicks in above the per-file cap). Assert the canonical URL
    // set is present and points at the custom domain.
    expect(xml).toContain("<urlset");
    expect(xml).toContain("https://cbamvalid.com/");
    expect(xml).toMatch(/<loc>https:\/\/cbamvalid\.com\/pricing<\/loc>/);
  });

  test("terms commercial-terms anchor exists", async ({ request }) => {
    const res = await request.get(`${BASE}/terms`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/id=["']commercial-terms["']/);
  });
});
