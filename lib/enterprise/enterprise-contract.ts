/**
 * Enterprise Exclusive commercial contract — SSOT.
 * Sellable surface for Annual/Enterprise buyers. H2: no fake ISO/SOC; SSO is contracted enablement.
 */
export const ENTERPRISE_PRICING = {
  fromUsd: 12000,
  priceLabel: "from $12,000",
  cadence: "per year · contact sales",
  currency: "USD" as const,
} as const;

export const ENTERPRISE_MODULES = [
  {
    id: "sso",
    title: "SSO / IdP federation",
    status: "CONTRACT_READY" as const,
    summary:
      "Microsoft Entra ID, Google Workspace, or Okta via OIDC/SAML on Firebase Identity Platform — provisioned per tenant under Enterprise contract.",
    href: "/enterprise/sso",
  },
  {
    id: "sla",
    title: "Service Level Agreement",
    status: "CONTRACT_READY" as const,
    summary:
      "Published SLA draft for procurement: support response targets, uptime posture, and escalation — signed under Enterprise MSA.",
    href: "/enterprise#sla",
  },
  {
    id: "holding",
    title: "Holding / multi-entity scope",
    status: "CONTRACT_READY" as const,
    summary:
      "Parent holding with child operators and installations under one Enterprise entitlement — each working file still seals with explicit scope.",
    href: "/enterprise/holding",
  },
  {
    id: "dpa",
    title: "Signed DPA path",
    status: "CONTRACT_READY" as const,
    summary: "Public DPA draft for review; bilateral signed DPA on Enterprise close.",
    href: "/security",
  },
  {
    id: "api",
    title: "API & onboarding",
    status: "CONTRACT_READY" as const,
    summary: "Onboarding plan, buyer-share coordination, and API roadmap scoped in the Enterprise SOW.",
    href: "/enterprise#api",
  },
  {
    id: "verifier",
    title: "Verifier coordination",
    status: "CONTRACT_READY" as const,
    summary: "Structure-review package fitness and buyer share workflow — not an accredited opinion.",
    href: "/verifier-review",
  },
] as const;

/** Holding commercial model — explicit scope, no silent widening. */
export const HOLDING_CONTRACT = {
  parentRole: "Holding / group legal entity (contract counterparty)",
  childRole: "Operator / exporter legal entities under the holding",
  installationUnit: "Production installation (seal scope unit)",
  rules: [
    "Enterprise entitlement is contracted at holding level.",
    "Each sealed working file still binds one operator, one installation, one reporting year.",
    "Cross-entity cloning does not inherit payment unless the SOW says so.",
    "Roles: Holding Admin, Operator Preparer, Internal Reviewer, Read-Only Verifier.",
  ],
} as const;

/** SSO enablement contract — technical + commercial. */
export const SSO_CONTRACT = {
  protocols: ["OIDC", "SAML 2.0"] as const,
  idpExamples: ["Microsoft Entra ID", "Google Workspace", "Okta"] as const,
  sessionModel:
    "IdP assertion → Firebase Identity Platform → server createSessionCookie() → HttpOnly __session → tenant authorization",
  provisioningSteps: [
    "Enterprise SOW signed (tenant domain + IdP metadata)",
    "Identity Platform SAML/OIDC provider bound to tenant",
    "Domain allow-list and role mapping confirmed",
    "Pilot users verified; then production cutover",
  ],
  notIncluded: [
    "SSO is not enabled on self-serve Single Pack",
    "No shared IdP across unrelated tenants",
    "SSO does not replace case/tenant authorization",
  ],
} as const;

/** SLA draft targets — published for procurement; signed copy on MSA. */
export const SLA_DRAFT = {
  version: "sla-draft-v1.0.0",
  supportEmail: "info@cbamvalid.com",
  targets: [
    { name: "Critical (seal/download down)", response: "4 business hours", resolutionAim: "1 business day" },
    { name: "High (checkout / entitlement)", response: "8 business hours", resolutionAim: "2 business days" },
    { name: "Normal (how-to / configuration)", response: "1 business day", resolutionAim: "5 business days" },
  ],
  uptimePosture:
    "Service depends on Google Cloud / Firebase europe-west1 managed durability. Sealed releases remain immutable objects once published.",
  exclusions: [
    "Third-party IdP outages",
    "Paddle payment-provider incidents",
    "Customer network / evidence-upload quality issues",
    "Force majeure",
  ],
  pdfHref: "/enterprise/sla-draft.pdf",
} as const;

/**
 * R6–R9 enterprise platform modules — sellable, not vaporware stubs.
 * Opening “volume gates” are commercial outcomes; product modules are LIVE to sell.
 */
export const PLATFORM_MODULES_R6_R9 = [
  {
    id: "R6",
    title: "Published Rulesets",
    href: "/rulesets",
    status: "LIVE" as const,
    sellLine: "Version-pinned EU CBAM ruleset registry — enterprise buyers can audit the pin.",
  },
  {
    id: "R7",
    title: "Buyer Share Link",
    href: "/buyer-link",
    status: "LIVE" as const,
    sellLine: "Public /d/token integrity surface for EU buyers — view/download logging.",
  },
  {
    id: "R8",
    title: "Security · DPA · SLA",
    href: "/security",
    status: "LIVE" as const,
    sellLine: "Hosting facts, DPA draft, and Enterprise SLA draft — no fake ISO/SOC.",
  },
  {
    id: "R9",
    title: "Platform architecture",
    href: "/platform",
    status: "LIVE" as const,
    sellLine: "CBAM door live; additional regimes available only under Enterprise expansion SOW.",
  },
] as const;

export const PARTNER_PROGRAM = {
  path: "/partners",
  title: "Channel partner program",
  status: "LIVE_INTAKE" as const,
  summary:
    "Verifier firms, consultancies, and trade associations can request a CBAMValid partner track. No invented logos — partners are listed only after a signed referral agreement.",
  emailSubject: "CBAMValid channel partner inquiry",
} as const;

export const ENTERPRISE_PUBLIC = {
  path: "/enterprise",
  title: "CBAMValid Enterprise Exclusive",
  eyebrow: "Enterprise Exclusive · from $12,000 / year",
  headline: "SSO, SLA, holding scope — contracted, not checkbox theater",
  lede:
    "Enterprise is the commitment regime for multi-site exporters and holdings that need IdP federation, a signed SLA/DPA path, and coordinated verifier-preparation across entities — without inventing certifications or verification opinions.",
} as const;
