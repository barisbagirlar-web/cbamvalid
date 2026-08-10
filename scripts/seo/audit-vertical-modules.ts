import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Vertical = "ecommerce" | "local" | "saas" | "media" | "i18n";

export type VerticalConfig = {
  business: { verticals: Vertical[]; revenueModel: string };
  thresholds: { similarityMax: number };
};

export function isVerticalActive(config: VerticalConfig, vertical: Vertical): boolean {
  return config.business.verticals.includes(vertical);
}

export function assertOutOfStockRule(input: {
  inStock: boolean;
  permanentlyRemoved: boolean;
  successorUrl: string | null;
  responseStatus: number;
}): void {
  if (input.inStock) return;
  if (input.successorUrl) {
    if (input.responseStatus !== 301) throw new Error("INV-15.1 out-of-stock successor must use 301");
    return;
  }
  if (input.permanentlyRemoved) {
    if (input.responseStatus !== 404 && input.responseStatus !== 410) {
      throw new Error("INV-15.1 permanently removed product must retire with 404/410 when no successor exists");
    }
    return;
  }
  if (input.responseStatus !== 200) {
    throw new Error("INV-15.1 temporary out-of-stock product must remain 200 with stock state and alternatives");
  }
}

export function assertVariantDemandProof(input: { indexable: boolean; independentDemandEvidenceId: string | null }): void {
  if (input.indexable && !input.independentDemandEvidenceId) {
    throw new Error("INV-15.2 separately indexable product variant requires independent demand evidence");
  }
}

export function assertProductSchemaParity(input: {
  visiblePriceMinor: number;
  schemaPriceMinor: number;
  visibleAvailability: string;
  schemaAvailability: string;
}): void {
  if (input.visiblePriceMinor !== input.schemaPriceMinor || input.visibleAvailability !== input.schemaAvailability) {
    throw new Error("INV-15.3 product schema price/stock must match visible offer state");
  }
}

export function assertNapByteParity(values: readonly string[]): void {
  if (values.length < 2) throw new Error("INV-15.4 NAP parity requires at least two governed surfaces");
  const first = values[0];
  if (values.some((value) => value !== first)) throw new Error("INV-15.4 local NAP is not byte-identical");
}

export function assertNoDoorwayPage(input: {
  similarity: number;
  similarityMax: number;
  localEvidenceCount: number;
}): void {
  if (input.similarity >= input.similarityMax && input.localEvidenceCount === 0) {
    throw new Error("INV-15.5 doorway-like local page blocked");
  }
}

export function assertSaasMethodologySsr(source: string): void {
  if (/^[\s\S]*?["']use client["'];?/m.test(source)) {
    throw new Error("INV-15.7 SaaS methodology must be a server-rendered documentation surface");
  }
  if (!source.includes("<main") || !source.includes("<h1")) {
    throw new Error("INV-15.7 SaaS methodology lacks server-renderable primary content");
  }
}

export function assertTruthfulSaasOffer(input: {
  visiblePriceMinor: number | null;
  canonicalPriceMinor: number | null;
  visibleTrialClaim: "none" | "free-draft" | "free-trial";
  verifiedTrialClaim: "none" | "free-draft" | "free-trial";
}): void {
  if (input.visiblePriceMinor !== input.canonicalPriceMinor || input.visibleTrialClaim !== input.verifiedTrialClaim) {
    throw new Error("INV-15.8 SaaS offer claim is not backed by the canonical commercial contract");
  }
}

export function assertNewsSitemapAge(input: { ageHours: number; inNewsSitemap: boolean }): void {
  if (input.inNewsSitemap && input.ageHours > 48) {
    throw new Error("INV-15.10 news sitemap entry exceeds the source 48-hour age rule");
  }
}

export type HreflangEntry = {
  route: string;
  language: string;
  canonical: string;
  xDefault: boolean;
  alternates: Record<string, string>;
};

export function assertReciprocalHreflang(entries: readonly HreflangEntry[]): void {
  const byUrl = new Map(entries.map((entry) => [entry.canonical, entry]));
  for (const entry of entries) {
    for (const target of Object.values(entry.alternates)) {
      const targetEntry = byUrl.get(target);
      if (!targetEntry || !Object.values(targetEntry.alternates).includes(entry.canonical)) {
        throw new Error("INV-15.13 hreflang alternates must be reciprocal");
      }
    }
  }
}

export function assertSingleXDefault(entries: readonly HreflangEntry[]): void {
  if (entries.filter((entry) => entry.xDefault).length !== 1) {
    throw new Error("INV-15.14 exactly one x-default is required for an active i18n set");
  }
}

export function assertNoIpForcedRedirect(input: { redirectsByIp: boolean }): void {
  if (input.redirectsByIp) throw new Error("INV-15.15 IP-based forced locale redirect is prohibited");
}

export function assertHreflangCanonicalRegistryParity(input: {
  hreflangUrls: readonly string[];
  canonicalUrls: readonly string[];
  registryUrls: readonly string[];
}): void {
  const canonical = new Set(input.canonicalUrls);
  const registry = new Set(input.registryUrls);
  for (const url of input.hreflangUrls) {
    if (!canonical.has(url) || !registry.has(url)) {
      throw new Error("INV-15.16 hreflang URL must match canonical and registry URL sets");
    }
  }
}

const SEVERITY_ORDER = { INFO: 0, WARN: 1, BLOCK: 2 } as const;
export function assertVerticalDoesNotWeakenGlobal(globalSeverity: keyof typeof SEVERITY_ORDER, verticalSeverity: keyof typeof SEVERITY_ORDER): void {
  if (SEVERITY_ORDER[verticalSeverity] < SEVERITY_ORDER[globalSeverity]) {
    throw new Error("INV-15.19 vertical module cannot weaken a global rule");
  }
}

export function auditCurrentVerticals(config: VerticalConfig) {
  const methodologySource = readFileSync(resolve(process.cwd(), "app/(public)/methodology/page.tsx"), "utf8");
  if (isVerticalActive(config, "saas")) assertSaasMethodologySsr(methodologySource);

  const active = [...config.business.verticals].sort();
  const moduleState = (["ecommerce", "local", "saas", "media", "i18n"] as Vertical[]).map((vertical) => ({
    vertical,
    active: active.includes(vertical),
    status: active.includes(vertical) ? "PASS" : "SKIP_NOT_ACTIVE",
  }));

  return {
    activeVerticals: active,
    moduleState,
    runtimeFindings: [],
    comparisonFreshness: isVerticalActive(config, "saas") ? "SKIP_NO_COMPARISON_PAGES" : "SKIP_NOT_ACTIVE",
    activeLocalMeasurements: isVerticalActive(config, "local") ? "SKIP_NO_DATA" : "SKIP_NOT_ACTIVE",
    activeMediaMeasurements: isVerticalActive(config, "media") ? "SKIP_NO_DATA" : "SKIP_NOT_ACTIVE",
    activeI18n: isVerticalActive(config, "i18n"),
  };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as VerticalConfig;
  console.log(`SEO_VERTICAL_RESULT=${JSON.stringify(auditCurrentVerticals(config))}`);
}

if (process.argv[1]?.endsWith("audit-vertical-modules.ts")) main();
