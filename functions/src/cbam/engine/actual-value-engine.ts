export type EmissionPathway =
  | "ACTUAL_VERIFIED"
  | "ACTUAL_UNVERIFIED"
  | "DEFAULT_OFFICIAL"
  | "DEFAULT_REGION_ADAPTED_PENDING_EVIDENCE"
  | "MISSING";

export interface PathwayValidation {
  pathway: EmissionPathway;
  isDeclarationReady: boolean;
  requiresVerificationWarning: boolean;
  sealingBlocked: boolean;
  remediationMessage?: string;
}

export function validateEmissionPathway(params: {
  hasActualData: boolean;
  isVerified: boolean;
  hasOfficialDefaults: boolean;
}): PathwayValidation {
  if (params.hasActualData) {
    if (params.isVerified) {
      return {
        pathway: "ACTUAL_VERIFIED",
        isDeclarationReady: true,
        requiresVerificationWarning: false,
        sealingBlocked: false,
      };
    } else {
      return {
        pathway: "ACTUAL_UNVERIFIED",
        isDeclarationReady: false, // unverified cannot be declaration ready
        requiresVerificationWarning: true,
        sealingBlocked: false,
        remediationMessage: "VERIFICATION REQUIRED: Actual emissions data was provided but is unverified by an accredited verifier.",
      };
    }
  }

  if (params.hasOfficialDefaults) {
    return {
      pathway: "DEFAULT_OFFICIAL",
      isDeclarationReady: true, // official defaults are permitted in default pathway declarations
      requiresVerificationWarning: false,
      sealingBlocked: false,
    };
  }

  // If no actual data and no default data is available, it is missing
  return {
    pathway: "MISSING",
    isDeclarationReady: false,
    requiresVerificationWarning: false,
    sealingBlocked: true,
    remediationMessage: "BLOCKER: Emissions data is missing and no official default value mapping was found.",
  };
}
