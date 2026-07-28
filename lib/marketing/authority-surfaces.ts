/**
 * Public marketing authority surfaces — SSOT for rails and homepage map.
 * H2: labels must match published claim discipline (no invented certifications).
 */
export type AuthoritySurfaceStatus = "LIVE" | "SAMPLE" | "EMPTY_BY_DESIGN";

export interface AuthoritySurface {
  id: string;
  href: string;
  label: string;
  blurb: string;
  status: AuthoritySurfaceStatus;
  /** Show in compact header/mobile more-nav */
  inMoreNav?: boolean;
  /** Show in homepage authority map */
  inHomepageMap?: boolean;
}

export const AUTHORITY_SURFACES: readonly AuthoritySurface[] = [
  {
    id: "sample",
    href: "/sample-dossier",
    label: "Sample Dossier",
    blurb: "Gate-free 16-page pack — PDF, JSON, XLSX.",
    status: "LIVE",
    inMoreNav: false,
    inHomepageMap: true,
  },
  {
    id: "rulesets",
    href: "/rulesets",
    label: "Published Rulesets",
    blurb: "Version-pinned EU CBAM ruleset registry.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "methodology",
    href: "/methodology",
    label: "Methodology & Sources",
    blurb: "Official sources and calculation basis.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "structure",
    href: "/verifier-review",
    label: "Structure Review",
    blurb: "SAMPLE format — not a verification opinion.",
    status: "SAMPLE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "trust",
    href: "/trust",
    label: "Trust Registry",
    blurb: "Every claim pinned — gaps stay visible.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "security",
    href: "/security",
    label: "Security & DPA",
    blurb: "EU hosting facts. No fake ISO/SOC claims.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "buyer",
    href: "/buyer-link",
    label: "Buyer Share Link",
    blurb: "/d/token integrity surface for EU buyers.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "pricing",
    href: "/pricing",
    label: "Pricing & ROI",
    blurb: "Four public tiers · USD 449 · ROI calculator.",
    status: "LIVE",
    inMoreNav: false,
    inHomepageMap: true,
  },
  {
    id: "answers",
    href: "/answers",
    label: "Answer Bank",
    blurb: "Citeable answers for buyers and assistants.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "enterprise",
    href: "/enterprise",
    label: "Enterprise Exclusive",
    blurb: "SSO · SLA · Holding · from $12,000/yr.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "partners",
    href: "/partners",
    label: "Partners",
    blurb: "Channel intake live — logos only after contract.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: true,
  },
  {
    id: "demo",
    href: "/demo",
    label: "Book a Demo",
    blurb: "Annual / Enterprise walkthrough.",
    status: "LIVE",
    inMoreNav: true,
    inHomepageMap: false,
  },
  {
    id: "case-studies",
    href: "/case-studies",
    label: "Case Studies",
    blurb: "Empty by design until permissioned.",
    status: "EMPTY_BY_DESIGN",
    inMoreNav: false,
    inHomepageMap: true,
  },
  {
    id: "platform",
    href: "/platform",
    label: "Platform Architecture",
    blurb: "Door = CBAM. Room expands under Enterprise SOW.",
    status: "LIVE",
    inMoreNav: false,
    inHomepageMap: true,
  },
] as const;

export const AUTHORITY_MORE_NAV = AUTHORITY_SURFACES.filter((s) => s.inMoreNav).map((s) => ({
  href: s.href,
  label: s.label,
}));

export const AUTHORITY_HOMEPAGE_MAP = AUTHORITY_SURFACES.filter((s) => s.inHomepageMap);
