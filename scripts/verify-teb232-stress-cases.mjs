#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema.ts";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls.ts";
import { performDossierCalculations } from "../functions/src/cbam/calculator.ts";

const uid = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";

function loadEnvLocal() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function caseIdFor(requestId) {
  const digest = createHash("sha256").update(`${uid}\0${requestId}`).digest("hex");
  return `case_${digest}`;
}

async function main() {
  const env = loadEnvLocal();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const ids = [
    ["STEEL", caseIdFor("a1111111-1111-4111-8111-000000000001")],
    ["CEMENT", caseIdFor("a1111111-1111-4111-8111-000000000002")],
    ["ALU", caseIdFor("a1111111-1111-4111-8111-000000000003")],
  ];

  const bucket = admin.storage().bucket();
  const out = [];

  for (const [label, caseId] of ids) {
    const snap = await admin.firestore().collection("cbam_cases").doc(caseId).get();
    if (!snap.exists) {
      out.push({ label, caseId, error: "MISSING" });
      continue;
    }
    const raw = snap.data();
    const parsed = AuditReadyCaseSchema.parse({ ...raw.data, caseId, ownerId: uid });
    const blockers = runQualityControls(parsed).filter((r) => r.status === "BLOCKER");
    let calc = null;
    let calcErr = null;
    try {
      calc = performDossierCalculations(parsed);
    } catch (e) {
      calcErr = e instanceof Error ? e.message : String(e);
    }
    const evidenceChecks = [];
    for (const ev of parsed.evidenceRegister) {
      const [exists] = await bucket.file(ev.storagePath).exists();
      let hashOk = false;
      if (exists) {
        const [buf] = await bucket.file(ev.storagePath).download();
        hashOk = createHash("sha256").update(buf).digest("hex") === ev.fileHash.toLowerCase();
      }
      evidenceChecks.push({ evidenceId: ev.evidenceId, exists, hashOk });
    }
    out.push({
      label,
      caseId,
      exporter: parsed.exporterIdentity.legalName.value,
      sector: [...new Set(parsed.goods.map((g) => g.sector))],
      origin: parsed.installation.country.value,
      blockers: blockers.map((b) => ({ id: b.ruleId, msg: b.message })),
      calcErr,
      pricedTotal: calc?.totalEmbeddedEmissions ?? null,
      direct: calc?.totalDirectEmissions ?? null,
      indirect: calc?.totalIndirectEmissions ?? null,
      goods: (calc?.goods || []).map((g) => ({
        cn: g.cnCode,
        seePriced: g.specificEmbeddedEmissions,
        annexII: g.annexII,
        pricedEmbedded: g.pricedEmbeddedEmissions,
      })),
      evidenceOk: evidenceChecks.every((e) => e.exists && e.hashOk),
      evidenceFail: evidenceChecks.filter((e) => !e.exists || !e.hashOk),
    });
  }

  console.log(JSON.stringify(out, null, 2));
  const failed = out.some(
    (r) => r.error || (r.blockers && r.blockers.length) || r.calcErr || r.evidenceOk === false
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
