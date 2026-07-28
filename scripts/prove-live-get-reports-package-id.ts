/**
 * Live callable proof: getCbamReports returns human Package IDs (A1234),
 * never truncated report_ hashes as the operator-facing identifier.
 */
import admin from "firebase-admin";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { PACKAGE_CODE_PATTERN } from "../functions/src/cbam/report/package-code";

async function main() {
  const b64 =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 ||
    process.env.ADMIN_SERVICE_ACCOUNT_B64 ||
    "";
  if (!admin.apps.length) {
    if (b64) {
      const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "cbam-desk",
      });
    } else if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "cbam-desk",
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "cbam-desk",
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "cbam-desk",
      });
    }
  }

  const sealed = await admin
    .firestore()
    .collection("cbam_reports")
    .where("status", "==", "SEALED")
    .limit(1)
    .get();
  if (sealed.empty) throw new Error("NO_SEALED_REPORTS");
  const report = sealed.docs[0].data() as { uid?: string; reportId?: string };
  const uid = String(report.uid || "");
  if (!uid) throw new Error("SEALED_REPORT_UID_MISSING");

  const customToken = await admin.auth().createCustomToken(uid);

  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cbam-desk",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }

  const auth = getAuth();
  await signInWithCustomToken(auth, customToken);
  const functions = getFunctions(undefined, "europe-west1");
  const callable = httpsCallable(functions, "getCbamReports");
  const result = await callable({});
  const payload = result.data as { reports?: Array<{ reportId?: string; packageCode?: string }> };
  const reports = payload.reports || [];
  if (!reports.length) throw new Error("GET_CBAM_REPORTS_EMPTY_FOR_OWNER");

  let ok = 0;
  for (const item of reports.slice(0, 10)) {
    const code = String(item.packageCode || "");
    const pass = PACKAGE_CODE_PATTERN.test(code);
    if (pass) ok += 1;
    console.log(
      JSON.stringify({
        reportIdPrefix: String(item.reportId || "").slice(0, 16),
        packageCode: code,
        pass,
      })
    );
  }

  console.log(`GET_CBAM_REPORTS_PACKAGE_ID_PROOF=${ok}/${Math.min(reports.length, 10)}`);
  if (ok === 0) process.exit(1);
}

main().catch((error) => {
  console.error("CALLABLE_PROOF_FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
