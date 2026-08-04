import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AEO_ANSWER_BANK } from "../../lib/seo/aeo/answer-bank";
import { AUTHORITY_CHAINS } from "../../lib/seo/aeo/authority-chains";
import {
  FORBIDDEN_PUBLIC_COMMERCIAL_PHRASES,
  assertPublicCommercialClassification,
  toPublicAnswerRecord,
  toPublicAuthorityChain,
} from "../../lib/seo/aeo/public-answer-sanitizer";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PUBLIC_MACHINE_FILES = [
  "public/answers.json",
  "public/answers.feed.json",
  "public/answers.rss",
  "public/llm.txt",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/.well-known/ai.txt",
  "public/ai-policy.txt",
] as const;

describe("Paddle public machine-readable classification", () => {
  it("publishes the software product, price and automated delivery", () => {
    const dataset = JSON.parse(read("public/answers.json")) as {
      product?: Record<string, unknown>;
      commercialBoundary?: Record<string, unknown>;
    };

    expect(dataset.product?.name).toBe("CBAMValid Working File Software Unlock");
    expect(dataset.product?.productType).toBe("Self-service B2B software");
    expect(dataset.product?.price).toBe("$449");
    expect(dataset.product?.delivery).toBe("Automated PDF, JSON and XLSX files");
    expect(dataset.commercialBoundary?.customerControlsData).toBe(true);
    expect(dataset.commercialBoundary?.automatedDigitalDelivery).toBe(true);
    expect(dataset.commercialBoundary?.humanServicesBundled).toBe(false);
  });

  it("contains no obsolete commercial classification in any public feed", () => {
    for (const relativePath of PUBLIC_MACHINE_FILES) {
      const content = read(relativePath).toLowerCase();
      for (const phrase of FORBIDDEN_PUBLIC_COMMERCIAL_PHRASES) {
        expect(content, `${relativePath} contains ${phrase}`).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it("sanitizes every answer-bank record before public rendering", () => {
    const publicAnswers = AEO_ANSWER_BANK.map(toPublicAnswerRecord);
    expect(() => assertPublicCommercialClassification(publicAnswers, "answers")).not.toThrow();
    expect(publicAnswers.find((answer) => answer.id === "what-is-cbamvalid")?.directAnswer).toContain(
      "self-service emissions data software",
    );
  });

  it("sanitizes every authority chain before machine-feed serialization", () => {
    const publicChains = AUTHORITY_CHAINS.map(toPublicAuthorityChain);
    expect(() => assertPublicCommercialClassification(publicChains, "authority chains")).not.toThrow();
  });

  it("keeps both dynamic and static public feed paths protected", () => {
    const route = read("app/answers.json/route.ts");
    const page = read("app/(public)/answers/page.tsx");
    const generator = read("scripts/seo/regenerate-answer-feeds.ts");

    for (const source of [route, page, generator]) {
      expect(source).toContain("toPublicAnswerRecord");
    }
    expect(route).toContain("toPublicAuthorityChain");
    expect(generator).toContain("assertPublicCommercialClassification");
  });
});
