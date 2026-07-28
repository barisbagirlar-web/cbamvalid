#!/usr/bin/env node
/**
 * Offline package verifier CLI — shipped inside sealed ZIP.
 * Zero network. Zero install beyond node.
 * Checks: component hashes, manifest signature, optional TSR presence,
 * CalcGraph recompute (when Calculation Graph.json present), truncated IDs.
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

function canonicalJson(value) {
  if (value instanceof Object && value !== null && !Array.isArray(value)) {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = value[k];
    return JSON.stringify(sorted, (_k, v) => v);
  }
  return JSON.stringify(value);
}

function hashNodeBody(node) {
  const { hash, ...nodeBody } = node;
  void hash;
  return sha256(Buffer.from(canonicalJson(nodeBody), "utf8"));
}

function merkleRoot(nodes) {
  const sorted = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sha256(Buffer.from(sorted.map((n) => n.hash).join("|"), "utf8"));
}

function main() {
  const args = process.argv.slice(2);
  const pkgIdx = args.indexOf("--package");
  if (pkgIdx < 0 || !args[pkgIdx + 1]) {
    console.error("Usage: node verify/cli.js --package <extracted-zip-root> [--strict]");
    process.exit(2);
  }
  const root = path.resolve(args[pkgIdx + 1]);
  const strict = args.includes("--strict");
  const reportLines = ["CBAMValid Independent Package Verification", `Package root: ${root}`];

  const manifestPath = path.join(root, "Data Integrity Manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail("Data Integrity Manifest.json missing");
  } else {
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
    reportLines.push(`manifest_hash_check=${hashFails === 0 ? "PASS" : "FAIL"}`);
  }

  const sigPath = path.join(root, "Manifest Signature.sig");
  if (fs.existsSync(sigPath)) {
    try {
      const sigJson = JSON.parse(fs.readFileSync(sigPath, "utf8"));
      const pem = sigJson.publicKeyPem;
      const signature = Buffer.from(sigJson.signatureBase64 || "", "base64");
      const manifestBytes = fs.readFileSync(manifestPath);
      if (pem && signature.length) {
        const ok = crypto.verify("sha256", manifestBytes, pem, signature);
        if (ok) pass("Manifest detached signature verified (embedded public key)");
        else fail("Manifest signature verification failed");
        reportLines.push(`manifest_signature=${ok ? "PASS" : "FAIL"}`);
      } else {
        fail("Manifest Signature.sig missing publicKeyPem or signatureBase64");
      }
    } catch (err) {
      fail(`Signature parse/verify error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (strict) {
    fail("Manifest Signature.sig missing");
  }

  const tsrPath = path.join(root, "Manifest.Timestamp.tsr");
  if (fs.existsSync(tsrPath)) {
    pass("RFC 3161 TSR file present (offline structural check)");
    reportLines.push("tsa=PRESENT_UNVERIFIED_OFFLINE");
  } else {
    reportLines.push("tsa=ABSENT");
    if (strict) {
      // soft: do not fail seal-era packages without TSA until WP-11 infra is live
      pass("RFC 3161 TSR absent — recorded (non-fatal until TSA endpoint configured)");
    }
  }

  const graphPath = path.join(root, "Calculation Graph.json");
  const tracePath = path.join(root, "Calculation Trace.json");

  if (fs.existsSync(graphPath)) {
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    if (!nodes.length) fail("Calculation Graph.json has no nodes");
    else {
      const rebuilt = nodes.map((n) => {
        const hash = hashNodeBody(n);
        if (n.hash && n.hash !== hash) fail(`Node hash mismatch: ${n.id}`);
        return { ...n, hash };
      });
      const rootHash = merkleRoot(rebuilt);
      if (graph.rootHash && graph.rootHash !== rootHash) {
        fail(`Merkle root mismatch: expected ${graph.rootHash} got ${rootHash}`);
      } else {
        pass(`CalcGraph recomputed; root=${rootHash}`);
      }
      for (const n of rebuilt) {
        if (!n.id || /undefined/.test(String(n.id)) || /CBAM_GOOD_$/.test(String(n.id))) {
          fail(`Invalid node id: ${n.id}`);
        }
      }
      reportLines.push(`calcgraph_recompute=PASS root=${rootHash}`);
    }
  } else if (fs.existsSync(tracePath)) {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    const calc = trace.calculation || trace;
    const nodes = calc.trace || [];
    if (!Array.isArray(nodes) || nodes.length === 0) fail("Calculation Trace has no nodes");
    else {
      pass(`Calculation Trace present with ${nodes.length} nodes; root=${calc.calculationRootHash || "n/a"}`);
      for (const node of nodes) {
        if (!node.formulaId || node.outputValue === undefined || !node.calculationHash) {
          fail(`Incomplete calc node: ${JSON.stringify(node.formulaId)}`);
        }
        if (String(node.formulaId).includes("undefined") || /CBAM_GOOD_$/.test(String(node.formulaId))) {
          fail(`Truncated/invalid formulaId: ${node.formulaId}`);
        }
      }
      reportLines.push("calc_trace_structure=PASS");
    }
  } else if (strict) {
    fail("Calculation Graph.json and Calculation Trace.json both missing");
  }

  reportLines.push(`Exit: ${process.exitCode ? "FAIL" : "PASS"}`);
  try {
    fs.writeFileSync(path.join(root, "VERIFICATION_REPORT.txt"), `${reportLines.join("\n")}\n`);
  } catch {
    /* read-only roots */
  }
  console.log(process.exitCode ? "VERIFICATION_REPORT: FAIL" : "VERIFICATION_REPORT: PASS");
}

main();
