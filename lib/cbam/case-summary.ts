import type { AuditReadyCase, InputDatum } from "@/lib/cbam/schema";

function displayValue(input: InputDatum | undefined): string {
  const value = input?.value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value.trim();
  return "";
}

export function getCaseDisplayName(caseData: AuditReadyCase): string {
  return displayValue(caseData.installation.name) || "Unnamed Installation";
}

export function getPrimaryCnCode(caseData: AuditReadyCase): string {
  return displayValue(caseData.goods[0]?.cnCode) || "Pending";
}

export function formatCaseUpdatedDate(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
