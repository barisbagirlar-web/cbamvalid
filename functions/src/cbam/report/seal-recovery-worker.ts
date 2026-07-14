import { onSchedule } from "firebase-functions/v2/scheduler";
import { adminDb } from "../../firebase-admin";

export const sealRecoveryWorker = onSchedule("every 5 minutes", async (event) => {
  console.log("[SEAL-RECOVERY] Starting sweep of stale outbox entries...");
  const outboxRef = adminDb.collection("seal_outbox");
  const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const snapshot = await outboxRef.where("createdAt", "<=", threshold).get();

  if (snapshot.empty) {
    console.log("[SEAL-RECOVERY] No stale entries found.");
    return;
  }

  let recoveredCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const reportId = doc.id;
    
    try {
      const sealRef = adminDb.collection("document_seals").doc(data.documentHash);
      const sealDoc = await sealRef.get();

      if (sealDoc.exists) {
        await outboxRef.doc(reportId).delete();
        await adminDb.collection("seal_log").doc(reportId).set({ state: "COMPLETION_NOTIFIED", timestamp: new Date().toISOString() });
        recoveredCount++;
      } else {
        await outboxRef.doc(reportId).delete();
        await adminDb.collection("seal_log").doc(reportId).set({ state: "FAILED", error: "Recovered from crashed state.", timestamp: new Date().toISOString() });
        failedCount++;
      }

    } catch (err) {
      console.error(`[SEAL-RECOVERY] Failed to process recovery for report ${reportId}:`, err);
    }
  }

  console.log(`[SEAL-RECOVERY] Sweep complete. Recovered: ${recoveredCount}, Failed: ${failedCount}`);
});
