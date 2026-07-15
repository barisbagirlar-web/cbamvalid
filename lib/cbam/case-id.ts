import { z } from "zod";

// Firestore identifiers are capped at 128 characters by the server validator.
// The fixed `case_` prefix consumes five characters, leaving 123 for the suffix.
export const CASE_ID_PATTERN = /^case_[A-Za-z0-9_-]{1,123}$/;
export const CaseIdSchema = z.string().regex(CASE_ID_PATTERN, "Invalid CBAM case identifier");

export function isCaseId(value: unknown): value is string {
  return typeof value === "string" && CASE_ID_PATTERN.test(value);
}
