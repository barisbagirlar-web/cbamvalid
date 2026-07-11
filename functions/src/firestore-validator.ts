import { resolveCNCodeScope } from "@/cbam/regulatory/cn-scope-dataset";

export class InvalidIdentifierError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "InvalidIdentifierError";
  }
}

/**
 * Validates identifiers before passing them to Firestore.
 * Throws InvalidIdentifierError if validation fails.
 */
export function validateIdentifier(name: string, value: unknown): string {
  if (value === undefined || value === null) {
    throw new InvalidIdentifierError(name, `Identifier ${name} is null or undefined`);
  }
  if (typeof value !== "string") {
    throw new InvalidIdentifierError(name, `Identifier ${name} must be a string`);
  }
  const clean = value.trim();
  if (clean === "") {
    throw new InvalidIdentifierError(name, `Identifier ${name} cannot be empty`);
  }

  // Specific identifier validation rules
  if (name === "uid") {
    if (clean.length < 1 || clean.length > 256) {
      throw new InvalidIdentifierError(name, `Invalid uid length: ${clean.length}`);
    }
  } else if (name === "reportId") {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
      throw new InvalidIdentifierError(name, `Invalid reportId format: ${clean}`);
    }
  } else if (name === "caseId") {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
      throw new InvalidIdentifierError(name, `Invalid caseId format: ${clean}`);
    }
  } else if (name === "transactionId" || name === "paddleTransactionId") {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
      throw new InvalidIdentifierError(name, `Invalid transactionId format: ${clean}`);
    }
  } else if (name === "entitlementId") {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
      throw new InvalidIdentifierError(name, `Invalid entitlementId format: ${clean}`);
    }
  } else if (name === "cnCode") {
    const res = resolveCNCodeScope(clean);
    if (res.reason === "MALFORMED") {
      throw new InvalidIdentifierError(name, `Invalid or malformed CN code: ${clean}`);
    }
  }

  return clean;
}
