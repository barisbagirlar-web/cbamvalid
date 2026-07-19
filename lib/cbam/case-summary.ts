import type { AuditReadyCase, InputDatum } from "@/lib/cbam/schema";

function displayValue(input: InputDatum | undefined): string {
  const value = input?.value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value.trim();
  return "";
}


/**
 * Returns a human-readable installation name for case display.
 *
 * @euRef "CBAMValid internal display — no regulatory basis"
 */
export function getCaseDisplayName(caseData: AuditReadyCase): string {
  return displayValue(caseData.installation.name) || "Unnamed Installation";
}

/**
 * Returns the primary CN code for display purposes.
 *
 * @euRef "CBAMValid internal — CN code display per Regulation (EU) 2023/956 Art. 2"
 */
export function getPrimaryCnCode(caseData: AuditReadyCase): string {
  return displayValue(caseData.goods[0]?.cnCode) || "Pending";
}

/**
 * Formats a CBAM case update timestamp for display.
 *
 * @euRef "CBAMValid internal display formatting"
 */
export function formatCaseUpdatedDate(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
