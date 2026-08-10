/**
 * G-20 — multi-runtime reproducibility of the verification CLI.
 *
 * The shipped verifier is implemented in two independent runtimes (Node.js and
 * Python). The same package must produce the byte-identical verification
 * output in both: manifest re-hash, schema-aware signature verification result
 * and Calculation Trace checks.
 *
 * Evidence: artifacts/gates/G-20/comparison-report.json
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PYTHON_BIN } from "./cross-runtime-helper";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-20");
const CLI_JS = join(process.cwd(), "scripts", "verify", "cli.js");
const CLI_PY = join(process.cwd(), "scripts", "verify", "cli.py");
const PSS_SALT_LENGTH = 32;

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

interface CliResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function runNodeCli(pkgDir: string, strict: boolean): CliResult {
  const args = ["--no-warnings", CLI_JS, "--package", pkgDir];
  if (strict) args.push("--strict");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function runPythonCli(pkgDir: string, strict: boolean): CliResult {
  const args = [CLI_PY, "--package", pkgDir];
  if (strict) args.push("--strict");
  const result = spawnSync(PYTHON_BIN, args, { encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function signManifestFile(
  manifestPath: string,
  privateKey: crypto.KeyObject,
  pss: boolean
): string {
  const manifestBytes = readFileSync(manifestPath);
  return crypto
    .sign(
      "sha256",
      manifestBytes,
      pss
        ? { key: privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: PSS_SALT_LENGTH }
        : privateKey
    )
    .toString("base64");
}

function buildPackage(options: {
  algorithm: string;
  keyPair: { publicKey: string; privateKey: crypto.KeyObject };
  manifestContent: unknown;
  readmeContent: Buffer;
  trace: unknown;
  signWithKey?: { publicKey: string; privateKey: crypto.KeyObject };
}): { dir: string; readmePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "cbamvalid-g20-"));
  const readmePath = join(dir, "Supporting_Evidence", "README.txt");
  mkdirSync(join(dir, "Supporting_Evidence"), { recursive: true });
  writeFileSync(readmePath, options.readmeContent);
  const manifestPath = join(dir, "Data Integrity Manifest.json");
  writeFileSync(manifestPath, JSON.stringify(options.manifestContent));
  const signer = options.signWithKey ?? options.keyPair;
  writeFileSync(
    join(dir, "Manifest Signature.sig"),
    JSON.stringify({
      // The advertised key is always keyPair.publicKey; signWithKey lets a
      // scenario sign with a different key (wrong-key rejection).
      algorithm: options.algorithm,
      publicKeyPem: options.keyPair.publicKey,
      signatureBase64: signManifestFile(manifestPath, signer.privateKey, options.algorithm.startsWith("RSA_SIGN_PSS")),
    })
  );
  writeFileSync(join(dir, "Calculation Trace.json"), JSON.stringify(options.trace));
  return { dir, readmePath };
}

const comparisons: Array<{ caseName: string; identical: boolean; node: CliResult; python: CliResult }> = [];

describe("G-20 verify-cli.cross-implementation", () => {
  const pssKey = (() => {
    const pair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKey: pair.publicKey, privateKey: crypto.createPrivateKey(pair.privateKey) };
  })();
  const legacyKey = (() => {
    const pair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKey: pair.publicKey, privateKey: crypto.createPrivateKey(pair.privateKey) };
  })();
  const readmeBytes = Buffer.from("cross-implementation", "utf8");
  const validTrace = {
    calculation: {
      calculationRootHash: "a".repeat(64),
      trace: [{ formulaId: "F-EMM-001", outputValue: "1.000000", calculationHash: "b".repeat(64) }],
    },
  };

  const cases: Array<{ name: string; dir: string; strict: boolean }> = [];

  it("builds the seven mandate scenarios and compares both runtimes byte-for-byte", () => {
    // 1. PSS-sealed package → PASS
    const pssPkg = buildPackage({
      algorithm: "RSA_SIGN_PSS_4096_SHA256",
      keyPair: pssKey,
      manifestContent: {
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      },
      readmeContent: readmeBytes,
      trace: validTrace,
    });
    cases.push({ name: "PSS sealed package", dir: pssPkg.dir, strict: true });

    // 2. Legacy PKCS#1 v1.5 sealed package → PASS (backward compatibility)
    const legacyPkg = buildPackage({
      algorithm: "RSA_SIGN_PKCS1_4096_SHA256",
      keyPair: legacyKey,
      manifestContent: {
        schemaVersion: "CBAMVALID-DOSSIER-6.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      },
      readmeContent: readmeBytes,
      trace: validTrace,
    });
    cases.push({ name: "Legacy PKCS1 sealed package", dir: legacyPkg.dir, strict: true });

    // 3. Tampered component (hash mismatch) → FAIL
    const tampered = buildPackage({
      algorithm: "RSA_SIGN_PSS_4096_SHA256",
      keyPair: pssKey,
      manifestContent: {
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(Buffer.from("expected", "utf8")) }],
      },
      readmeContent: readmeBytes,
      trace: validTrace,
    });
    cases.push({ name: "Tampered component hash", dir: tampered.dir, strict: true });

    // 4. Empty Calculation Trace → FAIL
    const emptyTrace = buildPackage({
      algorithm: "RSA_SIGN_PSS_4096_SHA256",
      keyPair: pssKey,
      manifestContent: {
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      },
      readmeContent: readmeBytes,
      trace: { calculation: { calculationRootHash: "a".repeat(64), trace: [] } },
    });
    cases.push({ name: "Empty calculation trace", dir: emptyTrace.dir, strict: true });

    // 5. Missing signature under --strict → FAIL
    const noSigDir = mkdtempSync(join(tmpdir(), "cbamvalid-g20-nosig-"));
    const noSigReadme = join(noSigDir, "Supporting_Evidence", "README.txt");
    mkdirSync(join(noSigDir, "Supporting_Evidence"), { recursive: true });
    writeFileSync(noSigReadme, readmeBytes);
    writeFileSync(
      join(noSigDir, "Data Integrity Manifest.json"),
      JSON.stringify({
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      })
    );
    writeFileSync(join(noSigDir, "Calculation Trace.json"), JSON.stringify(validTrace));
    cases.push({ name: "Missing signature (strict)", dir: noSigDir, strict: true });

    // 6. Signature produced with a different key → FAIL
    const wrongKey = buildPackage({
      algorithm: "RSA_SIGN_PSS_4096_SHA256",
      keyPair: pssKey,
      signWithKey: legacyKey,
      manifestContent: {
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      },
      readmeContent: readmeBytes,
      trace: validTrace,
    });
    cases.push({ name: "Signature from wrong key", dir: wrongKey.dir, strict: true });

    // 7. Strict package missing Calculation Trace → FAIL
    const noTraceDir = mkdtempSync(join(tmpdir(), "cbamvalid-g20-notrace-"));
    const noTraceReadme = join(noTraceDir, "Supporting_Evidence", "README.txt");
    mkdirSync(join(noTraceDir, "Supporting_Evidence"), { recursive: true });
    writeFileSync(noTraceReadme, readmeBytes);
    const noTraceManifestPath = join(noTraceDir, "Data Integrity Manifest.json");
    writeFileSync(
      noTraceManifestPath,
      JSON.stringify({
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        files: [{ path: "Supporting_Evidence/README.txt", sha256: sha256(readmeBytes) }],
      })
    );
    writeFileSync(
      join(noTraceDir, "Manifest Signature.sig"),
      JSON.stringify({
        algorithm: "RSA_SIGN_PSS_4096_SHA256",
        publicKeyPem: pssKey.publicKey,
        signatureBase64: signManifestFile(noTraceManifestPath, pssKey.privateKey, true),
      })
    );
    cases.push({ name: "Missing Calculation Trace (strict)", dir: noTraceDir, strict: true });

    for (const scenario of cases) {
      const node = runNodeCli(scenario.dir, scenario.strict);
      const python = runPythonCli(scenario.dir, scenario.strict);
      comparisons.push({
        caseName: scenario.name,
        identical: node.stdout === python.stdout && node.stderr === python.stderr && node.status === python.status,
        node,
        python,
      });
    }

    for (const comparison of comparisons) {
      expect(comparison.identical, `Node/Python divergence: ${comparison.caseName}`).toBe(true);
    }

    // Sanity anchors on the shared behaviour.
    const passCase = comparisons[0]!;
    expect(passCase.node.stdout).toContain("VERIFICATION_REPORT: PASS");
    expect(passCase.node.stdout).toContain("scheme=PSS");
    expect(passCase.node.status).toBe(0);
    const failCase = comparisons[2]!;
    expect(failCase.node.stdout).toContain("VERIFICATION_REPORT: FAIL");
    expect(failCase.node.status).toBe(1);
  });

  it("writes the G-20 evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    const payload = {
      mandate: "G-20 multi-runtime reproducibility",
      runtimes: ["node " + process.version, "python3"],
      scenarios: comparisons.map((comparison) => ({
        caseName: comparison.caseName,
        identical: comparison.identical,
        nodeExit: comparison.node.status,
        pythonExit: comparison.python.status,
        nodeStdout: comparison.node.stdout.trim().split("\n"),
        pythonStdout: comparison.python.stdout.trim().split("\n"),
      })),
      allIdentical: comparisons.every((comparison) => comparison.identical),
    };
    writeFileSync(join(ARTIFACT_DIR, "comparison-report.json"), JSON.stringify(payload, null, 2));
    expect(payload.allIdentical).toBe(true);
  });
});
