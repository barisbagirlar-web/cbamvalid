import type { TopicalNode } from "./types";
import { getAuthorityChain } from "./authority-chains";

/**
 * Topical map: hub → spoke relationships for internal linking and AI citation paths.
 * Entity + fan-out fields stay aligned with authority-chains where present.
 * Keep in sync with indexable guide/product routes in lib/seo/registry.ts.
 */
function chainExtras(path: string): Pick<TopicalNode, "entities" | "fanOutQueries"> {
  const chain = getAuthorityChain(path);
  return {
    entities: chain?.entities ?? [],
    fanOutQueries: chain?.fanOutQueries ?? [],
  };
}

export const TOPICAL_MAP: readonly TopicalNode[] = [
  {
    path: "/",
    topic: "CBAM exporter verification preparation",
    role: "hub",
    childPaths: [
      "/product",
      "/pricing",
      "/how-it-works",
      "/methodology",
      "/answers",
      "/glossary",
      "/sample-dossier",
      "/cn-code",
      "/rulesets",
      "/security",
      "/platform",
      "/cbam-2026-definitive-period",
      "/cbam-verification-preparation",
      "/cbam-non-eu-producer-guide",
      "/about",
    ],
    covers: [
      "what is CBAMValid",
      "CBAM evidence dossier for exporters",
      "verification preparation vs accredited verification",
    ],
    ...chainExtras("/"),
  },
  {
    path: "/product",
    topic: "Preparation Pack product capabilities",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/how-it-works", "/sample-dossier", "/pricing"],
    covers: [
      "deterministic CBAM calculation engine",
      "evidence register",
      "quality controls before sealing",
    ],
    ...chainExtras("/product"),
  },
  {
    path: "/pricing",
    topic: "One-time Preparation Pack pricing",
    role: "commercial",
    parentPath: "/",
    childPaths: ["/how-it-works", "/sample-dossier", "/product", "/demo"],
    covers: [
      "USD 449 pay-at-lock inclusions",
      "four published tiers",
      "when card is charged",
      "same-file corrections included",
      "new file requires new payment",
      "scope lock per installation and year",
      "ROI default-value exposure calculator",
    ],
    ...chainExtras("/pricing"),
  },
  {
    path: "/demo",
    topic: "Book a demo — Annual & Enterprise",
    role: "commercial",
    parentPath: "/pricing",
    childPaths: ["/pricing", "/sample-dossier", "/security", "/contact"],
    covers: ["human demo path", "Enterprise contact sales only"],
    ...chainExtras("/demo"),
  },
  {
    path: "/how-it-works",
    topic: "Working-file to locked-package workflow",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/pricing", "/sample-dossier", "/methodology"],
    covers: [
      "case scope setup",
      "evidence linking",
      "seal and download deliverables",
    ],
    ...chainExtras("/how-it-works"),
  },
  {
    path: "/methodology",
    topic: "Calculation methodology and legal sources",
    role: "methodology",
    parentPath: "/",
    childPaths: ["/cbam-methodology", "/cbam-embedded-emissions-calculation", "/product"],
    covers: [
      "versioned rulesets",
      "Regulation (EU) 2023/956 basis",
      "deterministic replay",
    ],
    ...chainExtras("/methodology"),
  },
  {
    path: "/sample-dossier",
    topic: "Sample sealed dossier structure",
    role: "verification",
    parentPath: "/",
    childPaths: ["/verify", "/pricing", "/product"],
    covers: [
      "what a sealed package contains",
      "interactive 16-page dossier viewer",
      "integrity manifest preview",
    ],
    ...chainExtras("/sample-dossier"),
  },
  {
    path: "/cn-code",
    topic: "CBAM CN code scope",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/cbam-cn-code-scope", "/product"],
    covers: ["is my CN code in CBAM scope"],
    ...chainExtras("/cn-code"),
  },
  {
    path: "/verify",
    topic: "Public dossier signature verification",
    role: "verification",
    parentPath: "/sample-dossier",
    childPaths: ["/sample-dossier", "/product", "/verifier-review"],
    covers: ["verify sealed dossier integrity hash"],
    ...chainExtras("/verify"),
  },
  {
    path: "/verifier-review",
    topic: "Verifier structure review surface",
    role: "verification",
    parentPath: "/",
    childPaths: ["/sample-dossier", "/verify", "/methodology"],
    covers: [
      "structure review vs verification opinion",
      "package fields for verifier workflows",
      "target structure-review letter language",
    ],
    ...chainExtras("/verifier-review"),
  },
  {
    path: "/rulesets",
    topic: "Published CBAM ruleset registry",
    role: "methodology",
    parentPath: "/methodology",
    childPaths: ["/methodology", "/sample-dossier", "/verify", "/platform"],
    covers: [
      "named ruleset versions",
      "source-registry hash pin",
      "historical seals keep ruleset",
    ],
    ...chainExtras("/rulesets"),
  },
  {
    path: "/buyer-link",
    topic: "Buyer share link /d/token",
    role: "verification",
    parentPath: "/verify",
    childPaths: ["/verify", "/sample-dossier", "/product"],
    covers: [
      "short /d/token alias",
      "buyer integrity check without login",
      "integrity is not assurance",
    ],
    ...chainExtras("/buyer-link"),
  },
  {
    path: "/security",
    topic: "Security and data protection facts",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/privacy", "/buyer-link", "/legal-notice"],
    covers: [
      "europe-west1 hosting",
      "subprocessors",
      "DPA draft without fake ISO claims",
    ],
    ...chainExtras("/security"),
  },
  {
    path: "/platform",
    topic: "Category architecture — CBAM first",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/rulesets", "/product", "/methodology"],
    covers: [
      "CBAM is the live door",
      "reusable sealed package contract",
      "second category not open yet",
    ],
    ...chainExtras("/platform"),
  },
  {
    path: "/cbam-2026-definitive-period",
    topic: "CBAM 2026 definitive period",
    role: "spoke",
    parentPath: "/",
    childPaths: [
      "/cbam-certificate-price",
      "/cbam-verification-preparation",
      "/cbam-non-eu-producer-guide",
      "/pricing",
    ],
    covers: [
      "definitive period start 2026",
      "30 September 2027 declaration deadline for 2026 imports",
      "certificate surrender timing",
    ],
    ...chainExtras("/cbam-2026-definitive-period"),
  },
  {
    path: "/cbam-embedded-emissions-calculation",
    topic: "Embedded emissions calculation guide",
    role: "methodology",
    parentPath: "/methodology",
    childPaths: ["/cbam-actual-vs-default-values", "/methodology", "/product"],
    covers: [
      "direct and indirect emissions",
      "precursor treatment",
      "evidence requirements for calculations",
    ],
    ...chainExtras("/cbam-embedded-emissions-calculation"),
  },
  {
    path: "/cbam-actual-vs-default-values",
    topic: "Actual values vs default values",
    role: "methodology",
    parentPath: "/methodology",
    childPaths: ["/cbam-default-values", "/cbam-verification-preparation", "/methodology"],
    covers: [
      "when actual values are required",
      "default value implications",
      "verification preparation impact",
    ],
    ...chainExtras("/cbam-actual-vs-default-values"),
  },
  {
    path: "/cbam-default-values",
    topic: "CBAM default values",
    role: "methodology",
    parentPath: "/cbam-actual-vs-default-values",
    childPaths: ["/cbam-actual-vs-default-values", "/cn-code", "/methodology"],
    covers: [
      "multi-dimensional default factors",
      "country route and year dimensions",
    ],
    ...chainExtras("/cbam-default-values"),
  },
  {
    path: "/cbam-certificate-price",
    topic: "CBAM certificate price cadence",
    role: "spoke",
    parentPath: "/cbam-2026-definitive-period",
    childPaths: ["/cbam-2026-definitive-period", "/pricing", "/methodology"],
    covers: [
      "2026 quarterly certificate price calculation",
      "not the same as transitional quarterly reporting",
    ],
    ...chainExtras("/cbam-certificate-price"),
  },
  {
    path: "/cbam-verification-preparation",
    topic: "Verification preparation guide",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/sample-dossier", "/methodology", "/pricing", "/cbam-exporter-evidence-requirements"],
    covers: ["how to prepare for CBAM verification"],
    ...chainExtras("/cbam-verification-preparation"),
  },
  {
    path: "/cbam-exporter-evidence-requirements",
    topic: "Exporter evidence requirements",
    role: "spoke",
    parentPath: "/cbam-verification-preparation",
    childPaths: ["/cbam-verification-preparation", "/product", "/methodology"],
    covers: [
      "evidence lineage and hashes",
      "support status before sealing",
    ],
    ...chainExtras("/cbam-exporter-evidence-requirements"),
  },
  {
    path: "/cbam-non-eu-producer-guide",
    topic: "Non-EU producer CBAM guide",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/pricing", "/how-it-works", "/cbam-exporter-evidence-requirements", "/cbam-2026-definitive-period"],
    covers: ["CBAM duties for non-EU producers and exporters"],
    ...chainExtras("/cbam-non-eu-producer-guide"),
  },
  {
    path: "/cbam-cn-code-scope",
    topic: "CN code scope decision guide",
    role: "spoke",
    parentPath: "/cn-code",
    childPaths: ["/cn-code", "/methodology", "/product"],
    covers: ["Annex I goods scope by CN code"],
    ...chainExtras("/cbam-cn-code-scope"),
  },
  {
    path: "/cbam-methodology",
    topic: "CBAM methodology overview",
    role: "methodology",
    parentPath: "/methodology",
    childPaths: ["/methodology", "/cbam-embedded-emissions-calculation", "/product"],
    covers: [
      "ruleset versioning",
      "reproducible calculation traces",
    ],
    ...chainExtras("/cbam-methodology"),
  },
  {
    path: "/about",
    topic: "Independence and expert review boundary",
    role: "spoke",
    parentPath: "/",
    childPaths: ["/contact", "/methodology", "/product", "/legal-notice"],
    covers: [
      "is CBAMValid an official EU service",
      "academic mathematical review boundary",
    ],
    ...chainExtras("/about"),
  },
  {
    path: "/contact",
    topic: "Support, billing, and legal contact",
    role: "commercial",
    parentPath: "/about",
    childPaths: ["/about", "/pricing", "/refund-policy", "/privacy"],
    covers: [
      "CBAMValid support email",
      "billing and GDPR contacts",
    ],
    ...chainExtras("/contact"),
  },
  {
    path: "/answers",
    topic: "Answer bank hub for CBAMValid",
    role: "hub",
    parentPath: "/",
    childPaths: ["/glossary", "/pricing", "/product", "/methodology", "/how-it-works"],
    covers: [
      "CBAMValid FAQ",
      "direct answers with evidence",
      "answer engine citation hub",
    ],
    entities: ["Answer bank", "Exporter Verification Preparation Pack", "independence boundary"],
    fanOutQueries: [
      "CBAMValid FAQ",
      "what does CBAMValid cost",
      "is CBAMValid an accredited verifier",
    ],
  },
  {
    path: "/glossary",
    topic: "CBAM entity glossary",
    role: "methodology",
    parentPath: "/",
    childPaths: ["/answers", "/methodology", "/cn-code", "/cbam-embedded-emissions-calculation"],
    covers: [
      "what are embedded emissions",
      "CN code meaning for CBAM",
      "actual vs default values definition",
    ],
    entities: ["embedded emissions", "CN code", "accredited verifier", "precursor"],
    fanOutQueries: [
      "CBAM glossary",
      "what is embedded emissions",
      "what is an accredited CBAM verifier",
    ],
  },
] satisfies readonly TopicalNode[];

const LABEL_BY_PATH: Record<string, string> = {
  "/": "Home",
  "/product": "Product",
  "/pricing": "Pricing",
  "/demo": "Book a demo",
  "/how-it-works": "How it works",
  "/methodology": "Methodology",
  "/sample-dossier": "Sample dossier",
  "/verify": "Verify a dossier",
  "/verifier-review": "Structure review",
  "/rulesets": "Published rulesets",
  "/buyer-link": "Buyer share link",
  "/security": "Security & DPA",
  "/platform": "Platform architecture",
  "/cn-code": "CN code scope",
  "/cbam-2026-definitive-period": "2026 definitive period",
  "/cbam-embedded-emissions-calculation": "Embedded emissions calculation",
  "/cbam-actual-vs-default-values": "Actual vs default values",
  "/cbam-default-values": "Default values",
  "/cbam-certificate-price": "Certificate price",
  "/cbam-methodology": "CBAM methodology overview",
  "/cbam-verification-preparation": "Verification preparation",
  "/cbam-non-eu-producer-guide": "Non-EU producer guide",
  "/cbam-exporter-evidence-requirements": "Exporter evidence requirements",
  "/cbam-cn-code-scope": "CN code scope guide",
  "/credits/buy": "Buy Preparation Pack",
  "/about": "About",
  "/contact": "Contact",
  "/answers": "Answer bank",
  "/glossary": "Glossary",
  "/legal-notice": "Legal notice",
  "/refund-policy": "Refund policy",
  "/privacy": "Privacy",
};

export function getTopicalNode(path: string): TopicalNode | undefined {
  return TOPICAL_MAP.find((node) => node.path === path);
}

export function listRelatedTopics(path: string): { path: string; label: string; topic: string }[] {
  const node = getTopicalNode(path);
  if (!node) return [];
  const paths = [
    ...(node.parentPath ? [node.parentPath] : []),
    ...node.childPaths,
  ].filter((candidate, index, all) => candidate !== path && all.indexOf(candidate) === index);

  return paths.map((relatedPath) => {
    const related = getTopicalNode(relatedPath);
    return {
      path: relatedPath,
      label: LABEL_BY_PATH[relatedPath] ?? relatedPath,
      topic: related?.topic ?? LABEL_BY_PATH[relatedPath] ?? relatedPath,
    };
  });
}

export function topicalLabel(path: string): string {
  return LABEL_BY_PATH[path] ?? path;
}

/** Topic → subtopic → entity → internal link edges for query fan-out audits. */
export function listFanOutEdges(path: string): {
  topic: string;
  entities: readonly string[];
  fanOutQueries: readonly string[];
  internalLinks: readonly string[];
} | null {
  const node = getTopicalNode(path);
  if (!node) return null;
  return {
    topic: node.topic,
    entities: node.entities,
    fanOutQueries: node.fanOutQueries,
    internalLinks: [
      ...(node.parentPath ? [node.parentPath] : []),
      ...node.childPaths,
    ],
  };
}
