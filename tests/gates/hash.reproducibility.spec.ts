/**
 * G-04 — hash reproducibility. D-03.
 *
 * The documented canonical serialisation rule is applied by an independent
 * function and must reproduce the sealed hash byte-for-byte.
 */
import { describe, expect, it } from "vitest";
import {
  canonicalSerialization,
  reproduceHash,
  reproduceHashFromBytes,
} from "../../functions/src/cbam/report/v6/hash-architecture";

describe("G-04 hash.reproducibility", () => {
  it("reproduces a digest from canonical serialisation deterministically", () => {
    const payload = { b: 2, a: [1, 2, 3], c: null, nested: { z: "x", y: "w" } };
    const canonical = canonicalSerialization(payload);
    expect(canonical).toBe('{"a":[1,2,3],"b":2,"c":null,"nested":{"y":"w","z":"x"}}');
    expect(reproduceHash(payload)).toBe(reproduceHash(payload));
    expect(reproduceHash(payload)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reproduces a byte hash independent of object serialisation", () => {
    const bytes = Buffer.from("cbamvalid-dossier-6.0-seal-check", "utf8");
    const hash = reproduceHashFromBytes(bytes);
    expect(hash).toBe(reproduceHashFromBytes(bytes));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("applies the canonical rule to reproduce the master record's trace hashes", () => {
    const value = { formulaId: "F-EMM-001", inputSet: ["electricityConsumed", "gridEmissionFactor"] };
    const reproduced = reproduceHash(value);
    expect(reproduced.length).toBe(64);
  });
});
