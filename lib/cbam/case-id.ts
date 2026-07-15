import { z } from "zod";

export const CASE_ID_PATTERN = /^case_[A-Za-z0-9_-]{1,128}$/;
export const CaseIdSchema = z.string().regex(CASE_ID_PATTERN, "Invalid CBAM case identifier");

export function isCaseId(value: unknown): value is string {
  return typeof value === "string" && CASE_ID_PATTERN.test(value);
}
