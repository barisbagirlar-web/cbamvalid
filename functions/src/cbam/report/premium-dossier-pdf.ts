import { REQUIRED_TOP_LEVEL_COMPONENTS_V5 } from "./package-components";

/**
 * Source-visible regulatory and package contract for the premium dossier.
 * The implementation lives in a separate renderer module so this boundary
 * remains small, auditable and resistant to accidental legal-source drift.
 */
export const PREMIUM_DOSSIER_REGULATORY_CONTRACT = {
  calculationRegulationId: "IMPL_2025_2547",
  requiredTopLevelComponents: REQUIRED_TOP_LEVEL_COMPONENTS_V5,
  presentationContract: "PREMIUM_ASSURANCE_101",
} as const;

export { buildPremiumDossierPdf } from "./premium-dossier-pdf-impl";
