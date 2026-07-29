import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

const CLI = path.resolve(
  process.cwd(),
  "src/dossier/90-verify/cli/verify-package.js"
);

function writeSignedPackage(root: string, signatureRelativePath: string): void {
  const manifest = JSON.stringify(
    {
      packageCode: "TEST1",
      files: [],
    },
    null,
    2
  );
  writeFileSync(path.join(root, "Data Integrity Manifest.json"), manifest);
  writeFileSync(
    path.join(root, "Calculation Trace.json"),
    JSON.stringify({
      calculation: {
        calculationRootHash: "a".repeat(64),
        trace: [
          {
            formulaId: "TEST_NODE",
            outputValue: 1,
            calculationHash: "b".repeat(64),
          },
        ],
      },
    })
  );

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const signature = sign("sha256", Buffer.from(manifest, "utf8"), privateKey);
  const signatureAbsolute = path.join(root, signatureRelativePath);
  mkdirSync(path.dirname(signatureAbsolute), { recursive: true });
  writeFileSync(
    signatureAbsolute,
    JSON.stringify({
      algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      signatureBase64: signature.toString("base64"),
      manifestSha256: createHash("sha256").update(manifest).digest("hex"),
    })
  );
}

describe("offline verifier signature path", () => {
  it.each([
    "Supporting_Evidence/Manifest Signature.sig",
    "Manifest Signature.sig",
  ])("accepts sealed signature at %s under --strict", (relativePath) => {
    const root = mkdtempSync(path.join(tmpdir(), "cbam-verify-cli-"));
    try {
      writeSignedPackage(root, relativePath);
      const result = spawnSync(
        process.execPath,
        [CLI, "--package", root, "--strict"],
        { encoding: "utf8" }
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Manifest detached signature verified");
      expect(result.stdout).not.toContain("Manifest Signature.sig missing");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed under --strict when no signature exists", () => {
    const root = mkdtempSync(path.join(tmpdir(), "cbam-verify-cli-missing-"));
    try {
      writeFileSync(
        path.join(root, "Data Integrity Manifest.json"),
        JSON.stringify({ packageCode: "TEST1", files: [] })
      );
      writeFileSync(
        path.join(root, "Calculation Trace.json"),
        JSON.stringify({
          calculation: {
            calculationRootHash: "a".repeat(64),
            trace: [
              {
                formulaId: "TEST_NODE",
                outputValue: 1,
                calculationHash: "b".repeat(64),
              },
            ],
          },
        })
      );
      const result = spawnSync(
        process.execPath,
        [CLI, "--package", root, "--strict"],
        { encoding: "utf8" }
      );
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(
        "Manifest Signature.sig missing"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
