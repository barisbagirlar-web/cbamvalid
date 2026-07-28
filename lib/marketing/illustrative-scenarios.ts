/**
 * Anonymized illustrative sector scenarios for /case-studies.
 * Not named customers. Not testimonials. Not measurable customer ROI claims.
 * Framed as typical working-file paths a buyer can recognize — without inventing logos.
 */
export type IllustrativeScenario = {
  readonly id: string;
  readonly sectorLabel: string;
  readonly alias: string;
  readonly pressure: string;
  readonly pathTaken: readonly string[];
  readonly outcomeShape: string;
  readonly commercialUnit: string;
  readonly independenceNote: string;
};

export const ILLUSTRATIVE_SCENARIOS: readonly IllustrativeScenario[] = [
  {
    id: "steel-one-mill",
    sectorLabel: "Iron & steel",
    alias: "Exporter A — one blast-furnace mill",
    pressure:
      "An EU buyer asked for actual embedded-emissions evidence for 2026 goods before the next shipment window.",
    pathTaken: [
      "Opened one working file for one installation and one reporting year",
      "Entered CN groups, production quantity, and fuel/electricity inputs with units",
      "Linked invoices and meter extracts to calculation nodes",
      "Cleared fail-closed QC blockers, paid once to lock, sealed the package",
    ],
    outcomeShape:
      "Buyer received a sealed PDF/JSON/O3CI package with ruleset pin and SHA-256 integrity — not a spreadsheet thread.",
    commercialUnit: "Single Pack · USD 449 · one operator · one installation · one year",
    independenceNote:
      "Preparation package only — not an accredited verification opinion or EU approval.",
  },
  {
    id: "aluminium-multi-line",
    sectorLabel: "Aluminium",
    alias: "Exporter B — one smelter, two product lines",
    pressure:
      "Procurement wanted one defendable package for two CN families from the same plant without mixing scopes.",
    pathTaken: [
      "Kept one installation scope; linked both goods groups inside the same working file",
      "Recorded methodology decisions for allocation and electricity factor",
      "Resolved warnings with plain-language guidance before seal",
      "Shared a buyer link after lock — prior seals stayed immutable",
    ],
    outcomeShape:
      "One paid file covered corrections after buyer questions; a second plant would need a new payment.",
    commercialUnit: "Single Pack · same-file corrections included",
    independenceNote:
      "Evidence-linked operator dossier for independent review — not a verifier certificate.",
  },
  {
    id: "holding-group",
    sectorLabel: "Holding / multi-entity",
    alias: "Group C — parent holding, three operator entities",
    pressure:
      "Group compliance needed SSO for preparers plus separate seal scopes per plant — without silent entitlement sharing.",
    pathTaken: [
      "Scoped Enterprise Exclusive (SSO · SLA · Holding) via sales inquiry",
      "Mapped holding admin vs operator preparer roles",
      "Each sealed file still bound one operator, one installation, one year",
      "IdP federation planned under contracted cutover (Entra / Okta / Google)",
    ],
    outcomeShape:
      "Holding contract for access and coordination; seal math stayed installation-scoped.",
    commercialUnit: "Enterprise Exclusive · from USD 12,000 / year · contact sales",
    independenceNote:
      "SSO does not replace case ownership checks. No accredited verification claim.",
  },
  {
    id: "cement-first-year",
    sectorLabel: "Cement",
    alias: "Exporter D — first CBAM reporting year",
    pressure:
      "Team had production data but no evidence lineage — buyer rejected an ad-hoc Excel pack.",
    pathTaken: [
      "Used readiness checklist and pre-flight workbook before opening the case",
      "Built evidence register with hash + support status on each material input",
      "Pinned calculations to a published ruleset version",
      "Verified seal hash on the public verify surface before handover",
    ],
    outcomeShape:
      "Handover package was inspectable: calculation trace, evidence coverage, integrity manifest.",
    commercialUnit: "Draft free → pay at lock when ready to seal",
    independenceNote:
      "CBAMValid prepares the package; an accredited verifier issues assurance where required.",
  },
] as const;

export const ILLUSTRATIVE_SCENARIOS_PUBLIC = {
  path: "/case-studies",
  eyebrow: "Illustrative scenarios · anonymized",
  headline: "How preparation looks in the field — without inventing customers",
  lede:
    "These are anonymized sector scenarios that mirror real buyer pressure. They are not named case studies, logos, or testimonials. When a real exporter grants written permission, a named reference can replace a scenario slot.",
  boundary:
    "No company names. No invented quotes. No guaranteed acceptance. Preparation ≠ accredited verification.",
} as const;
