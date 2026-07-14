import { adminDb } from "../../firebase/admin";
import { CaseStatusSchema } from "../schema";
import { createHash } from "crypto";

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
}

export async function migrateLegacyCases(options: MigrationOptions = { dryRun: true, batchSize: 500 }) {
  const casesRef = adminDb.collection("cbam_cases");
  const snapshot = await casesRef.get();
  
  const results = {
    total: snapshot.docs.length,
    migrated: 0,
    quarantined: 0,
    skipped: 0,
    dryRun: options.dryRun,
    logs: [] as string[]
  };

  const limit = options.batchSize || 500;
  let batch = adminDb.batch();
  let operationCount = 0;
  let commitCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    if (data.version >= 2) {
      results.skipped++;
      continue;
    }

    const migrationId = createHash("sha256").update(`migrate_v2_${doc.id}`).digest("hex");

    if (!data.status || !CaseStatusSchema.safeParse(data.status).success) {
      results.logs.push(`Case ${doc.id} quarantined: Invalid status.`);
      if (!options.dryRun) {
        batch.update(doc.ref, { 
          status: "REVIEW_REQUIRED",
          migrationNote: "Legacy status quarantined.",
          migrationId
        });
        operationCount++;
      }
      results.quarantined++;
    } else {
      results.logs.push(`Case ${doc.id} mapped to v2 schema.`);
      if (!options.dryRun) {
        batch.update(doc.ref, {
          version: 2,
          "installation.systemBoundaries": data.installation?.systemBoundaries || "DEFAULT",
          migratedAt: new Date().toISOString(),
          migrationId
        });
        operationCount++;
      }
      results.migrated++;
    }

    if (operationCount >= limit) {
      if (!options.dryRun) {
        await batch.commit();
        commitCount++;
        batch = adminDb.batch();
        operationCount = 0;
      }
    }
  }

  if (!options.dryRun && operationCount > 0) {
    await batch.commit();
    commitCount++;
    results.logs.push(`Committed ${commitCount} batches.`);
  }

  return results;
}
