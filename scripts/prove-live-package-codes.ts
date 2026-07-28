import admin from "firebase-admin";
import {
  PACKAGE_CODE_PATTERN,
  resolvePackageCode,
} from "../functions/src/cbam/report/package-code";

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
    });
  }

  const snap = await admin
    .firestore()
    .collection("cbam_reports")
    .where("status", "==", "SEALED")
    .limit(8)
    .get();

  console.log(`SEALED_COUNT_SAMPLE=${snap.size}`);
  let ok = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as { packageCode?: string; reportId?: string };
    const reportId = d.reportId || doc.id;
    const code = resolvePackageCode({ packageCode: d.packageCode, reportId });
    const matches = PACKAGE_CODE_PATTERN.test(code);
    if (matches) ok += 1;
    console.log(
      JSON.stringify({
        stored: d.packageCode ?? null,
        resolved: code,
        matches,
        hasStored: Boolean(d.packageCode),
      })
    );
  }

  console.log(`PACKAGE_CODE_PROOF=${ok}/${snap.size}`);
  if (!(ok === snap.size && snap.size > 0)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
