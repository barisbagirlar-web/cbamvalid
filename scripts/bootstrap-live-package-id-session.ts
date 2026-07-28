/**
 * Bootstrap a live __session cookie for a user who already has sealed reports.
 * Writes playwright storage state to tests/e2e/.auth/package-id-user.json
 */
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";

async function initAdmin() {
  const b64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 || process.env.ADMIN_SERVICE_ACCOUNT_B64 || "";
  if (admin.apps.length) return;
  if (b64) {
    const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || "cbam-desk" });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "cbam-desk",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "cbam-desk",
  });
}

async function main() {
  await initAdmin();
  const sealed = await admin.firestore().collection("cbam_reports").where("status", "==", "SEALED").limit(1).get();
  if (sealed.empty) throw new Error("NO_SEALED_REPORTS");
  const uid = String(sealed.docs[0].data().uid || "");
  if (!uid) throw new Error("UID_MISSING");

  const customToken = await admin.auth().createCustomToken(uid);
  const outDir = path.join(process.cwd(), "tests/e2e/.auth");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "package-id-custom-token.txt"), customToken, "utf8");

  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cbam-desk",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }
  const cred = await signInWithCustomToken(getAuth(), customToken);
  const idToken = await cred.user.getIdToken(true);

  const base = process.env.PLAYWRIGHT_TEST_BASE_URL || "https://cbamvalid.com";
  const res = await fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error(`SESSION_HTTP_${res.status}`);
  const setCookie = res.headers.getSetCookie?.() || [];
  const raw = res.headers.get("set-cookie") || "";
  const cookiesRaw = setCookie.length ? setCookie : raw ? [raw] : [];
  if (!cookiesRaw.length) throw new Error("NO_SET_COOKIE");

  const cookies = cookiesRaw.map((entry) => {
    const [pair] = entry.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    return {
      name,
      value,
      domain: "cbamvalid.com",
      path: "/",
      httpOnly: /httponly/i.test(entry),
      secure: true,
      sameSite: "Lax" as const,
    };
  });

  const outPath = path.join(outDir, "package-id-user.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ cookies, origins: [{ origin: base, localStorage: [] }] }, null, 2)
  );
  console.log(`SESSION_BOOTSTRAP=PASS uid=${uid} cookieCount=${cookies.length} token=yes out=${outPath}`);
}

main().catch((e) => {
  console.error("SESSION_BOOTSTRAP_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
