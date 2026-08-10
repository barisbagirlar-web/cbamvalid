import type { GapRecord } from "./schema";

export interface GapResolution {
  step: number;
  action: string;
  evidence: string;
}

/**
 * Maps an open quality-control gap to the workflow step that resolves it,
 * plus a plain-language remediation action and the accepted evidence class.
 * Single source of truth — consumed by the case wizard (step 8 remediation
 * plan) and the persistent QC inspector rail.
 */
export function gapResolution(gap: GapRecord): GapResolution {
  const code = String(gap.requiredEvidence || "");
  const requirement = gap.requirement.toLowerCase();
  if (code.includes("SCENARIO")) return { step: 1, action: "Remove the illustrative scenario and enter the real operator and reporting scope.", evidence: "Case-specific records must replace every demonstration value." };
  if (code.includes("EORI") || requirement.includes("eori")) return { step: 1, action: "Enter the active declarant EORI, then upload and link the registration evidence.", evidence: "EORI registration record or importer-issued evidence." };
  if (code.includes("IDENTITY")) return { step: 3, action: "Complete the importer, exporter, installation, country, route and explicit system boundary.", evidence: "Company records, operating permit, monitoring plan and process map." };
  if (code.includes("CN_") || code.includes("PRODUCTION") || code.includes("ALLOCATION") || requirement.includes("good")) return { step: 2, action: "Correct the goods row and reconcile all allocation shares to exactly 1 before linking source records.", evidence: "Customs classification, production ledger and allocation workbook." };
  if (requirement.includes("directemissions") || code.includes("QC_06")) return { step: 4, action: "Enter period-total direct emissions and link the approved monitoring calculation.", evidence: "Fuel/activity ledger, meter/lab records and emissions workbook." };
  if (requirement.includes("electricity") || requirement.includes("gridemissionfactor") || code.includes("QC_07") || code.includes("QC_08")) return { step: 5, action: "Enter electricity and a correctly scaled grid factor, then link each value to approved evidence.", evidence: "Meter/invoice records and the official or supplier-specific factor source with period/version." };
  if (requirement.includes("precursor") || code.includes("PRECURSOR")) return { step: 6, action: "Complete each precursor quantity and emissions field, or document an evidenced no-precursor decision.", evidence: "Bill of materials, mass balance and supplier/operator emissions communication." };
  if (requirement.includes("carbon") || code.includes("CARBON_PRICE")) return { step: 7, action: "Link the carbon-price record to approved proof of assessment and payment, or remove an unsupported deduction.", evidence: "Official assessment, receipt, applicable-emissions reconciliation and rebate documentation." };
  return { step: 7, action: "Upload the source document, link it to the exact input and complete malware and support review.", evidence: "Original source file with issuer, issue date, reporting period and SHA-256 integrity record." };
}
