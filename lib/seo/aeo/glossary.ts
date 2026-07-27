/**
 * Enterprise entity glossary — DefinedTerm SSOT for AEO / Knowledge Graph.
 * Definitions are operational/product-safe. No invented legal conclusions.
 */

export type GlossaryTerm = {
  readonly slug: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly definition: string;
  readonly relatedPaths: readonly string[];
  readonly regulatorySourceIds?: readonly string[];
};

export const CBAM_GLOSSARY: readonly GlossaryTerm[] = [
  {
    slug: "cbam",
    name: "Carbon Border Adjustment Mechanism (CBAM)",
    aliases: ["CBAM", "EU CBAM"],
    definition:
      "EU framework that prices selected embedded greenhouse-gas emissions in goods imported into the customs territory of the Union. CBAMValid helps exporters prepare evidence for that regime; it does not replace an accredited verifier or the CBAM Registry.",
    relatedPaths: ["/cbam-2026-definitive-period", "/methodology", "/product"],
    regulatorySourceIds: ["REG_2023_956", "REG_2025_2083"],
  },
  {
    slug: "embedded-emissions",
    name: "Embedded emissions",
    aliases: ["specific embedded emissions", "SEE"],
    definition:
      "Greenhouse-gas emissions attributed to goods under CBAM rules, typically expressed per tonne of product and separated into direct and indirect components where required. CBAMValid calculates and traces these values server-side from operator inputs and evidence links.",
    relatedPaths: ["/cbam-embedded-emissions-calculation", "/methodology", "/how-it-works"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "direct-emissions",
    name: "Direct emissions",
    aliases: ["installation direct emissions"],
    definition:
      "Emissions from sources owned or controlled within the installation boundary used for the goods in scope — for example combustion and process emissions — as distinct from electricity-related indirect emissions.",
    relatedPaths: ["/cbam-embedded-emissions-calculation", "/methodology"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "indirect-emissions",
    name: "Indirect emissions",
    aliases: ["electricity emissions"],
    definition:
      "Emissions associated with electricity consumed in production of the goods, treated under CBAM methods separately from direct emissions when the ruleset requires that split.",
    relatedPaths: ["/cbam-embedded-emissions-calculation", "/cbam-actual-vs-default-values"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "cn-code",
    name: "CN code",
    aliases: ["Combined Nomenclature", "CN"],
    definition:
      "Combined Nomenclature classification that determines whether goods fall into CBAM Annex I scope. Wrong CN classification is a material preparation failure; CBAMValid pages document scope reasoning, not customs binding rulings.",
    relatedPaths: ["/cn-code", "/cbam-cn-code-scope", "/product"],
    regulatorySourceIds: ["REG_2023_956"],
  },
  {
    slug: "actual-values",
    name: "Actual values",
    aliases: ["actual embedded emissions"],
    definition:
      "Embedded-emissions figures derived from installation monitoring, activity data, and approved methods — preferred when evidence quality supports them — as opposed to Commission default values.",
    relatedPaths: ["/cbam-actual-vs-default-values", "/cbam-default-values", "/methodology"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "default-values",
    name: "Default values",
    aliases: ["CBAM default values"],
    definition:
      "Commission-published fallback emission values used when actual values are not available or not permitted for the declaration path. Using defaults can raise commercial cost; CBAMValid surfaces the choice with methodology decision records.",
    relatedPaths: ["/cbam-default-values", "/cbam-actual-vs-default-values"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "accredited-verifier",
    name: "Accredited verifier",
    aliases: ["independent accredited verification", "CBAM verifier"],
    definition:
      "An independent body that may issue an accredited verification opinion under EU accreditation rules. CBAMValid prepares the operator dossier; it never issues that opinion or claims EU approval.",
    relatedPaths: ["/cbam-verification-preparation", "/about", "/methodology"],
    regulatorySourceIds: ["REG_2023_956"],
  },
  {
    slug: "definitive-period",
    name: "CBAM definitive period",
    aliases: ["definitive phase", "2026 CBAM"],
    definition:
      "The period starting 1 January 2026 when CBAM financial obligations apply under definitive-period rules, distinct from the earlier transitional reporting phase.",
    relatedPaths: ["/cbam-2026-definitive-period", "/cbam-certificate-price"],
    regulatorySourceIds: ["REG_2023_956", "REG_2025_2083"],
  },
  {
    slug: "cbam-certificate",
    name: "CBAM certificate",
    aliases: ["certificate surrender"],
    definition:
      "Certificate instrument used in the definitive period so authorised CBAM declarants can surrender certificates corresponding to embedded emissions of imported goods. Pricing cadence and purchase rules are set by implementing acts — not by CBAMValid.",
    relatedPaths: ["/cbam-certificate-price", "/cbam-2026-definitive-period"],
    regulatorySourceIds: ["IMPL_2025_2548"],
  },
  {
    slug: "precursor",
    name: "Precursor",
    aliases: ["CBAM precursor", "complex goods precursor"],
    definition:
      "Input material or intermediate good whose embedded emissions must be included when calculating emissions for complex goods under CBAM precursor rules. Missing precursor decisions block a fail-closed seal in CBAMValid.",
    relatedPaths: ["/cbam-embedded-emissions-calculation", "/methodology", "/product"],
    regulatorySourceIds: ["IMPL_2025_2546"],
  },
  {
    slug: "system-boundary",
    name: "System boundary",
    aliases: ["installation boundary"],
    definition:
      "Documented limit of processes, fuels, materials, and electricity included in the installation emissions inventory for a reporting year. CBAMValid requires an explicit boundary before sealing.",
    relatedPaths: ["/methodology", "/how-it-works", "/product"],
  },
  {
    slug: "evidence-register",
    name: "Evidence register",
    aliases: ["supporting evidence folder", "SHA-256 evidence"],
    definition:
      "Structured register of source documents with hash, size, review status, and field links. Sealing in CBAMValid requires approved, supported evidence whose bytes match registered integrity values.",
    relatedPaths: ["/sample-dossier", "/product", "/cbam-exporter-evidence-requirements"],
  },
  {
    slug: "calculation-trace",
    name: "Calculation trace",
    aliases: ["calculation root hash", "deterministic trace"],
    definition:
      "Versioned, hash-linked record of formulas, inputs, units, intermediate steps, and outputs so the same case snapshot can be replayed. Authoritative traces in CBAMValid are generated server-side.",
    relatedPaths: ["/methodology", "/how-it-works", "/sample-dossier"],
  },
  {
    slug: "preparation-pack",
    name: "Exporter Verification Preparation Pack",
    aliases: ["Preparation Pack", "CBAMValid pack"],
    definition:
      "CBAMValid commercial unit: one legal operator, one installation, one reporting year, unlock for one working file with drafts free and five successful sealed releases after pay-at-lock — prepared for independent accredited verification, not an accredited opinion.",
    relatedPaths: ["/pricing", "/product", "/how-it-works"],
  },
  {
    slug: "o3ci-export",
    name: "O3CI field-mapped structured data export",
    aliases: ["O3CI", "field mapping export"],
    definition:
      "Structured data export mapped to O3CI-oriented fields to help importers and declarants. It is not an official CBAM Registry XML submission and must not be described as one.",
    relatedPaths: ["/sample-dossier", "/product", "/methodology"],
  },
  {
    slug: "authorised-cbam-declarant",
    name: "Authorised CBAM declarant",
    aliases: ["CBAM declarant", "EU importer declarant"],
    definition:
      "The EU-side party responsible for CBAM declarations and certificate surrender for imported goods. Non-EU producers typically supply evidence to declarants; CBAMValid packages that operator-side evidence.",
    relatedPaths: ["/cbam-non-eu-producer-guide", "/cbam-exporter-evidence-requirements"],
    regulatorySourceIds: ["REG_2023_956"],
  },
  {
    slug: "installation",
    name: "Installation",
    aliases: ["production installation"],
    definition:
      "A stationary technical unit where production processes for CBAM goods occur. Each CBAMValid working file locks to one installation for one reporting year.",
    relatedPaths: ["/product", "/how-it-works", "/pricing"],
  },
  {
    slug: "fail-closed-qc",
    name: "Fail-closed quality control",
    aliases: ["QC gate", "seal blocker"],
    definition:
      "Rule that blocks sealing when material identity, evidence, allocation, calculation, or finding conditions are incomplete or unsupported. Blocked seals consume zero release entitlement in CBAMValid.",
    relatedPaths: ["/how-it-works", "/product", "/cbam-verification-preparation"],
  },
  {
    slug: "ruleset-version",
    name: "Ruleset version",
    aliases: ["engine version", "methodology version"],
    definition:
      "Pinned regulatory/ruleset and calculation-engine versions recorded in a sealed release so historical packages do not silently change when methods are updated later.",
    relatedPaths: ["/methodology", "/sample-dossier"],
  },
] as const;

export function listGlossaryTerms(): readonly GlossaryTerm[] {
  return CBAM_GLOSSARY;
}

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return CBAM_GLOSSARY.find((term) => term.slug === slug);
}

export function findGlossaryTermByName(name: string): GlossaryTerm | undefined {
  const needle = name.trim().toLowerCase();
  return CBAM_GLOSSARY.find(
    (term) =>
      term.name.toLowerCase() === needle ||
      term.aliases.some((alias) => alias.toLowerCase() === needle) ||
      term.slug === needle.replace(/\s+/g, "-"),
  );
}

export function glossaryPath(slug: string): string {
  return `/glossary#${slug}`;
}

/** Match free-text entities from authority chains to glossary anchors. */
export function resolveEntityToGlossary(entity: string): { href: string; name: string } | null {
  const term = findGlossaryTermByName(entity);
  if (!term) {
    // Fuzzy: entity contains glossary name or alias
    const lower = entity.toLowerCase();
    const hit = CBAM_GLOSSARY.find(
      (candidate) =>
        lower.includes(candidate.name.toLowerCase()) ||
        candidate.aliases.some((alias) => lower.includes(alias.toLowerCase())),
    );
    if (!hit) return null;
    return { href: glossaryPath(hit.slug), name: hit.name };
  }
  return { href: glossaryPath(term.slug), name: term.name };
}
