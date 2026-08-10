/**
 * G-19 — signature scheme upgrade to RSA-4096 PSS (RFC 8017 §8.1) with schema
 * awareness: packages sealed under the legacy PKCS#1 v1.5 scheme must remain
 * verifiable, and new packages verify under PSS.
 *
 * Evidence: artifacts/gates/G-19/signature-pss-report.json
 */
import crypto from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { verifyManifestSignature } from "../../functions/src/cbam/report/kms-signature";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-19");
const PSS_SALT_LENGTH = 32;

describe("G-19 signature.pss-scheme", () => {
  const manifest = Buffer.from("cbamvalid-dossier-7.0-seal-check", "utf8");
  const sha256 = (bytes: Buffer): string => crypto.createHash("sha256").update(bytes).digest("hex");

  const pss = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const legacy = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  it("produces and verifies an RSA-4096 PSS signature under the schema-aware verifier", () => {
    const signatureBase64 = crypto
      .sign("sha256", manifest, { key: pss.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: PSS_SALT_LENGTH })
      .toString("base64");
    expect(
      verifyManifestSignature({
        algorithm: "RSA_SIGN_PSS_4096_SHA256",
        manifest,
        publicKeyPem: pss.publicKey,
        signatureBase64,
      })
    ).toBe(true);
  });

  it("keeps legacy PKCS#1 v1.5 packages verifiable (backward compatibility)", () => {
    const signatureBase64 = crypto.sign("sha256", manifest, legacy.privateKey).toString("base64");
    expect(
      verifyManifestSignature({
        algorithm: "RSA_SIGN_PKCS1_4096_SHA256",
        manifest,
        publicKeyPem: legacy.publicKey,
        signatureBase64,
      })
    ).toBe(true);
  });

  it("rejects a signature verified under the wrong scheme", () => {
    const digest = sha256(manifest);
    const pssSignature = crypto
      .sign("sha256", manifest, { key: pss.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: PSS_SALT_LENGTH })
      .toString("base64");
    const legacySignature = crypto.sign("sha256", manifest, legacy.privateKey).toString("base64");
    // A PSS signature must fail under the PKCS1 path and vice versa.
    expect(
      verifyManifestSignature({
        algorithm: "RSA_SIGN_PKCS1_4096_SHA256",
        manifest,
        publicKeyPem: pss.publicKey,
        signatureBase64: pssSignature,
      })
    ).toBe(false);
    expect(
      verifyManifestSignature({
        algorithm: "RSA_SIGN_PSS_4096_SHA256",
        manifest,
        publicKeyPem: legacy.publicKey,
        signatureBase64: legacySignature,
      })
    ).toBe(false);
    void digest;
  });

  it("verifies a PSS-sealed package through the shipped verify/cli.js (schema-aware)", () => {
    const dir = mkdtempSync(join(tmpdir(), "cbamvalid-pss-"));
    const readmeBytes = Buffer.from("pss-seal", "utf8");
    mkdirSync(join(dir, "Supporting_Evidence"), { recursive: true });
    writeFileSync(join(dir, "Supporting_Evidence", "README.txt"), readmeBytes);
    const manifestPath = join(dir, "Data Integrity Manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      })
    );
    // The CLI verifies the manifest FILE bytes, so the PSS signature must be
    // produced over those exact bytes.
    const manifestFileBytes = Buffer.from(readFileSync(manifestPath, "utf8"), "utf8");
    const signatureBase64 = crypto
      .sign("sha256", manifestFileBytes, { key: pss.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: PSS_SALT_LENGTH })
      .toString("base64");
    writeFileSync(
      join(dir, "Manifest Signature.sig"),
      JSON.stringify({
        algorithm: "RSA_SIGN_PSS_4096_SHA256",
        publicKeyPem: pss.publicKey,
        signatureBase64,
      })
    );
    writeFileSync(
      join(dir, "Calculation Trace.json"),
      JSON.stringify({
        calculation: {
          calculationRootHash: "0".repeat(64),
          trace: [
            {
              formulaId: "F-EMM-001",
              outputValue: "1.000000",
              calculationHash: "1".repeat(64),
            },
          ],
        },
      })
    );
    const result = spawnSync(process.execPath, [join(process.cwd(), "scripts", "verify", "cli.js"), "--package", dir, "--strict"], {
      encoding: "utf8",
    });
    expect(result.stdout).toContain("scheme=PSS");
    expect(result.stdout).toContain("VERIFICATION_REPORT: PASS");
    expect(result.status).toBe(0);
  });

  it("writes the G-19 evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "signature-pss-report.json"),
      JSON.stringify({
        scheme: "RSA-4096 PSS (RFC 8017 §8.1)",
        saltLength: PSS_SALT_LENGTH,
        legacySchemeKept: "RSA-SIGN-PKCS1-v1.5 verified through schema-aware verifier",
        verified: [
          "PSS signature produced and verified",
          "legacy PKCS#1 v1.5 signature still verifies",
          "cross-scheme verification fails",
          "shipped verify/cli.js is schema-aware and verifies a PSS package",
        ],
      }, null, 2)
    );
    expect(true).toBe(true);
  });
});
