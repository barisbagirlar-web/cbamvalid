#!/usr/bin/env npx tsx
/**
 * FAZ P0 (F) — seed the four complete sandbox dossiers into the
 * cbam-desk-sandbox Firebase project (or a local emulator).
 *
 * Safety rules (fail-closed):
 *  - the production project `cbam-desk` is REFUSED — synthetic evidence must
 *    never reach production data
 *  - default target is the local Firestore/Storage emulator; pass
 *    FIREBASE_PROJECT=cbam-desk-sandbox with real ADC credentials to seed the
 *    hosted sandbox project
 *
 * Writes:
 *  - Firestore cbam_cases/{caseId} per dossier (full AuditReadyCase + uid)
 *  - Storage evidence/{ownerId}/{caseId}/{evidenceId}/{fileName} per evidence
 *    record (deterministic synthetic PDF bytes, matching fileHash/sizeBytes)
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     npx tsx scripts/seed-four-complete-dossiers.ts
 *
 *   npx tsx scripts/seed-four-complete-dossiers.ts --emulator
 *   FIREBASE_PROJECT=cbam-desk-sandbox npx tsx scripts/seed-four-complete-dossiers.ts
 */
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { FOUR_DOSSIER_KEYS, buildFourDossierEvidenceFiles, createFourDossierCase } from "../tests/fixtures/four-dossiers";

const SANDBOX_PROJECT = "cbam-desk-sandbox";
const PRODUCTION_PROJECT = "cbam-desk";

function resolveProjectId(): string {
  const fromEnv = process.env.FIREBASE_PROJECT ?? "";
  const emulator = process.argv.includes("--emulator");
  if (fromEnv && emulator) {
    throw new Error("Set either FIREBASE_PROJECT or --emulator, not both.");
  }
  if (fromEnv) return fromEnv;
  return SANDBOX_PROJECT;
}

async function main(): Promise<void> {
  const projectId = resolveProjectId();
  if (projectId === PRODUCTION_PROJECT) {
    console.error(`REFUSED: seeding synthetic evidence into production project "${PRODUCTION_PROJECT}" is forbidden.`);
    process.exit(2);
  }

  const useEmulator = !process.env.FIREBASE_PROJECT;
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  if (useEmulator) {
    const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
    const [hostName, port] = host.split(":");
    db.settings({ host: hostName!, port: Number(port ?? 8080), ssl: false });
  }

  console.log(`Seeding four complete dossiers → project "${projectId}"${useEmulator ? " (emulator)" : ""}`);

  for (const key of FOUR_DOSSIER_KEYS) {
    const caseData = createFourDossierCase(key);
    const evidenceFiles = await buildFourDossierEvidenceFiles(caseData);
    const parsed = AuditReadyCaseSchema.parse(caseData);
    const caseId = parsed.caseId!;
    const uid = parsed.ownerId!;

    const payload = JSON.parse(JSON.stringify({ ...parsed, uid })) as Record<string, unknown>;
    await db.collection("cbam_cases").doc(caseId).set(payload);

    let evidenceUploaded = 0;
    for (const file of evidenceFiles) {
      const record = parsed.evidenceRegister.find((item) => item.evidenceId === file.evidenceId);
      const storagePath = record?.storagePath ?? `evidence/${uid}/${caseId}/${file.evidenceId}/${file.fileName}`;
      if (!useEmulator) {
        await admin.storage().bucket().file(storagePath).save(file.bytes, {
          contentType: "application/pdf",
          metadata: { metadata: { evidenceId: file.evidenceId } },
        });
      } else {
        const emulatorBucket = admin.storage().bucket();
        const existing = await emulatorBucket.file(storagePath).exists();
        if (!existing[0]) {
          await emulatorBucket.file(storagePath).save(file.bytes, { contentType: "application/pdf" });
        }
      }
      evidenceUploaded += 1;
    }

    console.log(
      `Seeded ${key}: case ${caseId} (uid ${uid}) with ${evidenceUploaded} evidence files, ` +
      `evidence count ${parsed.evidenceRegister.length}`
    );
  }

  console.log("SEED_COMPLETE");
  process.exit(0);
}

void main();
