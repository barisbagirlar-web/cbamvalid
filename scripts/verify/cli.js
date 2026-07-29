#!/usr/bin/env node
/**
 * Offline package verifier CLI — shipped inside sealed ZIP under Supporting_Evidence/verify/.
 * Zero network. Re-hashes components, verifies manifest signature (embedded key),
 * and checks Calculation Trace.json structure.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  const args = process.argv.slice(2);
  const pkgIdx = args.indexOf("--package");
  if (pkgIdx < 0 || !args[pkgIdx + 1]) {
    console.error("Usage: node verify/cli.js --package <dir-or-extracted-zip> [--strict]");
    process.exit(2);
  }
  const root = path.resolve(args[pkgIdx + 1]);
  const strict = args.includes("--strict");

  const manifestPath = path.join(root, "Data Integrity Manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail("Data Integrity Manifest.json missing");
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  let hashFails = 0;
  for (const entry of files) {
    const rel = entry.path || entry.fileName || entry.name;
    if (!rel) continue;
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      fail(`Missing component: ${rel}`);
      hashFails += 1;
      continue;
    }
    const digest = sha256(fs.readFileSync(full));
    const expected = (entry.sha256 || entry.hash || "").toLowerCase();
    if (expected && digest !== expected.toLowerCase()) {
      fail(`Hash mismatch: ${rel}`);
      hashFails += 1;
    }
  }
  if (hashFails === 0) pass(`Re-hashed ${files.length} manifest components`);

  const sigCandidates = [
    path.join(root, "Supporting_Evidence", "Manifest Signature.sig"),
    path.join(root, "Manifest Signature.sig"),
  ];
  const sigPath = sigCandidates.find((candidate) => fs.existsSync(candidate));
  if (sigPath) {
    try {
      const sigJson = JSON.parse(fs.readFileSync(sigPath, "utf8"));
      const pem = sigJson.publicKeyPem;
      const signature = Buffer.from(sigJson.signatureBase64 || "", "base64");
      const manifestBytes = fs.readFileSync(manifestPath);
      if (pem && signature.length) {
        const ok = crypto.verify("sha256", manifestBytes, pem, signature);
        if (ok) pass(`Manifest detached signature verified (${path.relative(root, sigPath)})`);
        else fail("Manifest signature verification failed");
      } else {
        fail("Manifest Signature.sig missing publicKeyPem or signatureBase64");
      }
    } catch (err) {
      fail(`Signature parse/verify error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (strict) {
    fail("Manifest Signature.sig missing");
  }

  const tracePath = path.join(root, "Calculation Trace.json");
  if (fs.existsSync(tracePath)) {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    const calc = trace.calculation || trace;
    const nodes = calc.trace || [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      fail("Calculation Trace has no nodes");
    } else {
      pass(`Calculation Trace present with ${nodes.length} nodes; root=${calc.calculationRootHash || "n/a"}`);
      for (const node of nodes) {
        if (!node.formulaId || node.outputValue === undefined || !node.calculationHash) {
          fail(`Incomplete calc node: ${JSON.stringify(node.formulaId)}`);
        }
        if (String(node.formulaId).includes("undefined") || /CBAM_GOOD_$/.test(String(node.formulaId))) {
          fail(`Truncated/invalid formulaId: ${node.formulaId}`);
        }
      }
    }
  } else if (strict) {
    fail("Calculation Trace.json missing");
  }

  const out = path.join(root, "VERIFICATION_REPORT.txt");
  const lines = [
    "CBAMValid Independent Package Verification",
    `Package root: ${root}`,
    `Exit: ${process.exitCode ? "FAIL" : "PASS"}`,
  ];
  try {
    fs.writeFileSync(out, `${lines.join("\n")}\n`);
  } catch {
    /* ignore write when root is read-only */
  }

  if (!process.exitCode) console.log("VERIFICATION_REPORT: PASS");
  else console.log("VERIFICATION_REPORT: FAIL");
}

main();
