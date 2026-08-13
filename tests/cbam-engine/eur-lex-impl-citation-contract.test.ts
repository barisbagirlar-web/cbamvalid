import { describe, expect, it } from "vitest";
import { OFFICIAL_SOURCES } from "../../lib/cbam/registry/legal-sources";

/**
 * EUR-Lex OJ HTML verified 2026-08-13 (registry verifiedAt pinned to 2026-08-10 for G-21 asOf)
 * for CELEX 32025R2546 / 32025R2547 / 32025R2548.
 * Wrong article headings in Answer Authority surfaces are a trust-collapse defect.
 */
describe("EUR-Lex implementing-act citation contract (2546/2547/2548)", () => {
  it("pins CELEX, OJ dates, and full EUR-Lex titles", () => {
    const a = OFFICIAL_SOURCES.IMPL_2025_2546;
    const b = OFFICIAL_SOURCES.IMPL_2025_2547;
    const c = OFFICIAL_SOURCES.IMPL_2025_2548;

    expect(a.celexId).toBe("32025R2546");
    expect(b.celexId).toBe("32025R2547");
    expect(c.celexId).toBe("32025R2548");

    for (const source of [a, b, c]) {
      expect(source.adoptedDate).toBe("2025-12-10");
      expect(source.publishedDate).toBe("2025-12-22");
      expect(source.appliesFrom).toBe("2026-01-01");
      expect(source.eliUri).toMatch(/^https:\/\/eur-lex\.europa\.eu\/eli\/reg_impl\/2025\/254[678]\/oj\/eng$/);
      expect(source.verifiedAt).toBe("2026-08-10");
    }

    expect(a.title).toContain("principles for verification of declared embedded emissions");
    expect(a.title).toContain("of the European Parliament and of the Council");
    expect(b.title).toContain("methods for the calculation of emissions embedded in goods");
    expect(b.title).toContain("of the European Parliament and the Council");
    expect(c.title).toContain("calculation and publication of the price of CBAM certificates");
    expect(c.title).toContain("of the European Parliament and of the Council");
  });

  it("maps 2546 articles to EUR-Lex headings (not the pre-audit inverted map)", () => {
    const provisions = OFFICIAL_SOURCES.IMPL_2025_2546.keyProvisions.join("\n");
    expect(provisions).toContain("Article 2 — Physical site visits");
    expect(provisions).toContain("Article 5 — Materiality levels");
    expect(provisions).toContain("Article 6 — Format of the verification report");
    expect(provisions).toContain("Article 7 — Entry into force");
    expect(OFFICIAL_SOURCES.IMPL_2025_2546.annexes).toEqual(["Annex"]);
    expect(provisions).not.toContain("Article 6 — Site-visit");
    expect(provisions).not.toContain("Annex II — Attribution");
  });

  it("maps 2547 to Articles 1–16 and Annexes I–V", () => {
    const source = OFFICIAL_SOURCES.IMPL_2025_2547;
    expect(source.articles).toHaveLength(16);
    expect(source.annexes).toEqual(["Annex I", "Annex II", "Annex III", "Annex IV", "Annex V"]);
    const provisions = source.keyProvisions.join("\n");
    expect(provisions).toContain("Article 4 — Production processes and functional unit");
    expect(provisions).toContain("Article 5 — Monitoring methodology");
    expect(provisions).not.toContain("Article 2 — Functional units and production processes");
  });

  it("maps 2548 quarterly-2026 / weekly-2027 articles (not a 3-article weekly stub)", () => {
    const source = OFFICIAL_SOURCES.IMPL_2025_2548;
    expect(source.articles).toHaveLength(9);
    const provisions = source.keyProvisions.join("\n");
    expect(provisions).toContain("Article 1 — Methodology for calculating the price of CBAM certificates in 2026 (quarterly)");
    expect(provisions).toContain("Article 5 — Methodology for calculating the price of CBAM certificates from 2027 (weekly)");
    expect(provisions).not.toContain("Article 2 — Weekly average certificate price calculation");
  });
});
