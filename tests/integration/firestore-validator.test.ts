import { describe, it, expect, vi } from "vitest";
import { validateIdentifier, InvalidIdentifierError } from "../../lib/firebase/firestore-validator";
import { getCase } from "../../lib/cbam/storage/case-repository";

// Mock firebase admin DB
vi.mock("server-only", () => ({}));
vi.mock("../../lib/firebase/admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({ exists: false })),
      })),
    })),
  },
}));

describe("Firestore Input Validation Boundary", () => {
  describe("validateIdentifier", () => {
    it("Allows valid identifiers", () => {
      expect(validateIdentifier("uid", "user_12345")).toBe("user_12345");
      expect(validateIdentifier("caseId", "case_abc-123_xyz")).toBe("case_abc-123_xyz");
      expect(validateIdentifier("reportId", "report_abc_123")).toBe("report_abc_123");
      expect(validateIdentifier("transactionId", "tx_999888")).toBe("tx_999888");
      expect(validateIdentifier("entitlementId", "ent_12345")).toBe("ent_12345");
      expect(validateIdentifier("cnCode", "72010000")).toBe("72010000");
    });

    it("Throws InvalidIdentifierError for null or undefined", () => {
      expect(() => validateIdentifier("uid", null)).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier("uid", undefined)).toThrow(InvalidIdentifierError);
    });

    it("Throws InvalidIdentifierError for empty strings", () => {
      expect(() => validateIdentifier("caseId", "")).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier("caseId", "   ")).toThrow(InvalidIdentifierError);
    });

    it("Throws InvalidIdentifierError for non-string types", () => {
      expect(() => validateIdentifier("reportId", 123)).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier("reportId", {})).toThrow(InvalidIdentifierError);
    });

    it("Throws InvalidIdentifierError for malformed patterns", () => {
      expect(() => validateIdentifier("caseId", "case_abc; DROP TABLE users;")).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier("reportId", "report/123/xyz")).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier("cnCode", "7201000")).toThrow(InvalidIdentifierError); // 7 digits
      expect(() => validateIdentifier("cnCode", "7201000A")).toThrow(InvalidIdentifierError); // non-numeric
    });
  });

  describe("Repository Integration Checks", () => {
    it("Prevents Firestore query and throws on invalid caseId", async () => {
      // Trying to load case with undefined or malformed caseId throws validation error
      await expect(getCase("")).rejects.toThrow(InvalidIdentifierError);
      await expect(getCase("case_abc; select *")).rejects.toThrow(InvalidIdentifierError);
    });
  });
});
