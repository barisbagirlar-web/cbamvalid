/**
 * G-15 — RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Canonical serialisation of hash input. Every hash entering the sealed
 * package is produced through this module so the same logical content yields
 * the identical byte sequence in every runtime (Node.js, Python, Go).
 *
 * RFC 8785 rules applied here:
 *  - Object keys ordered by Unicode code point (not UTF-16 code unit).
 *  - Strings serialised with JSON escaping plus \u2028/\u2029 escapes.
 *  - Numbers serialised per ECMAScript Number (shortest round-trip), which
 *    equals JSON.stringify for finite values.
 *  - No whitespace between tokens.
 *
 * Package-specific exception (G-16): monetary, emissions and ratio values are
 * carried as string-encoded fixed-point decimals and therefore never reach
 * this module as IEEE 754 numbers. undefined is serialised as the literal
 * null, matching the historical package rule (HASH_CANONICAL_RULE 1.0).
 */
import crypto from "node:crypto";

export type JcsValue = null | boolean | number | string | JcsValue[] | { [key: string]: JcsValue };

export const JCS_RULE_ID = "RFC8785:JCS:1.0";

function escapeJsonString(value: string): string {
  let out = JSON.stringify(value);
  if (out.includes("\u2028")) out = out.replaceAll("\u2028", "\\u2028");
  if (out.includes("\u2029")) out = out.replaceAll("\u2029", "\\u2029");
  return out;
}

function compareUnicodeCodePoints(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const leftPoint = left.codePointAt(index);
    const rightPoint = right.codePointAt(index);
    if (leftPoint === undefined || rightPoint === undefined) break;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    if (leftPoint > 0xffff) index += 1;
  }
  return left.length - right.length;
}

export function canonicalJcs(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return escapeJsonString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJcs(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort(compareUnicodeCodePoints);
  return `{${keys.map((key) => `${escapeJsonString(key)}:${canonicalJcs(record[key])}`).join(",")}}`;
}

export function reproduceJcsHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(canonicalJcs(value), "utf8")
    .digest("hex");
}

/**
 * G-16 — runtime guard. Walks a hash-bound structure and refuses any IEEE 754
 * number in a field whose name carries a monetary/emissions/rate meaning.
 * Non-monetary metadata fields (indices, counts, sizes) are allowed to remain
 * numbers; the ESLint rule (scripts/lint/no-float-in-hashed-fields.mjs) blocks
 * number literals at the call site.
 */
const FLOAT_BEARING_FIELD =
  /(?:emission|embedded|direct|indirect|grid|electricity|amount|price|cost|value|total|rate|factor|share|ratio|conversion|quantity|volume)/i;

export function assertNoFloatFieldsInHash(value: unknown, path = "$"): void {
  if (value === null || value === undefined) return;
  if (typeof value === "number" && Number.isFinite(value)) {
    throw new Error(`FLOAT_IN_HASH_FIELD:${path}`);
  }
  if (typeof value === "boolean" || typeof value === "string") return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoFloatFieldsInHash(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "number") {
        if (FLOAT_BEARING_FIELD.test(key)) {
          throw new Error(`FLOAT_IN_HASH_FIELD:${path}.${key}`);
        }
        continue;
      }
      assertNoFloatFieldsInHash(child, `${path}.${key}`);
    }
  }
}
