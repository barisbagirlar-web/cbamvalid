export type ProgrammaticTemplateStatus = "candidate" | "active" | "retired";

export type ProgrammaticTemplate = {
  templateId: string;
  status: ProgrammaticTemplateStatus;
  slots: readonly string[];
  dataBinding: string;
  uniquenessStrategy: string;
  rollbackStrategy: string;
};

export const PROGRAMMATIC_TEMPLATES: readonly ProgrammaticTemplate[] = [
  {
    templateId: "cn-code-detail-v1",
    status: "candidate",
    slots: [
      "cnCode",
      "sector",
      "description",
      "effectiveFrom",
      "productionRoutes",
      "requiredProducerData",
      "evidenceConsiderations",
      "factualLastModified",
    ],
    dataBinding: "lib/seo/cn-public-registry.ts",
    uniquenessStrategy: "Verified CN-specific scope, sector, route, producer-data and evidence fields; no generic city/keyword substitution.",
    rollbackStrategy: "Batch PR revert plus noindex fallback; publication remains disabled until Phase-18 eligibility and A3 approval.",
  },
];

export function getProgrammaticTemplate(templateId: string): ProgrammaticTemplate | null {
  return PROGRAMMATIC_TEMPLATES.find((template) => template.templateId === templateId) ?? null;
}

export function assertRegisteredTemplate(templateId: string): ProgrammaticTemplate {
  const template = getProgrammaticTemplate(templateId);
  if (!template) throw new Error(`INV-18.1 unregistered programmatic template: ${templateId}`);
  return template;
}
