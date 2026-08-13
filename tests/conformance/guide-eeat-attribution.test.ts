import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_EDITORIAL } from "../../lib/seo/editorial-attribution";
import { generateGuideAttributionNodes, generateTechArticleSchema } from "../../lib/seo/schema";

describe("Guide E-E-A-T attribution", () => {
  it("emits TechArticle author and reviewedBy desks distinct from publisher org", () => {
    const article = generateTechArticleSchema({
      path: "/cbam-default-values",
      headline: "Default values",
      description: "Guide",
      dateModified: "2026-08-12",
      citations: ["https://eur-lex.europa.eu/example"],
    });
    const nodes = generateGuideAttributionNodes();
    const authorId = (article.author as { "@id": string })["@id"];
    const reviewerId = (article.reviewedBy as { "@id": string })["@id"];
    expect(authorId).toContain("#editorial-desk");
    expect(reviewerId).toContain("#regulatory-source-desk");
    expect(authorId).not.toBe("https://cbamvalid.com/#organization");
    expect(nodes.map((node) => node["@id"])).toEqual([authorId, reviewerId]);
    expect(nodes[0]?.name).toBe(GUIDE_EDITORIAL.author.name);
    expect(nodes[1]?.name).toBe(GUIDE_EDITORIAL.reviewer.name);
  });

  it("keeps visible guide byline copy in parity with the editorial SSOT", () => {
    const source = readFileSync(resolve(process.cwd(), "components/seo/RegulatoryGuidePage.tsx"), "utf8");
    expect(source).toContain("GUIDE_EDITORIAL");
    expect(source).toContain("Written by:");
    expect(source).toContain("Reviewed by:");
    expect(source).toContain("Expertise basis");
    expect(GUIDE_EDITORIAL.boundaryLines.join(" ")).toMatch(/Not legal/);
    expect(GUIDE_EDITORIAL.boundaryLines.join(" ")).toMatch(/accredited CBAM verification/);
  });

  it("wires attribution nodes into JsonLdForRoute for guide TechArticle graphs", () => {
    const source = readFileSync(resolve(process.cwd(), "components/seo/JsonLdForRoute.tsx"), "utf8");
    expect(source).toContain("generateGuideAttributionNodes");
    expect(source).toContain("...generateGuideAttributionNodes()");
  });
});
