import "server-only";

let authInstance: import("firebase-admin/auth").Auth | null = null;
let dbInstance: import("firebase-admin/firestore").Firestore | null = null;

function getFirebaseApp() {
  // Store package names in variables to defeat Turbopack static analysis/bundling.
  // This guarantees they are left as native Node.js require() calls at runtime.
  const adminPkg = "firebase-admin";
  const appPkg = "firebase-admin/app";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require(adminPkg) as typeof import("firebase-admin");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getApps, getApp, initializeApp } = require(appPkg) as typeof import("firebase-admin/app");

  if (getApps().length > 0) return getApp();

  let serviceAccount: Record<string, string> | undefined;

  // Priority 1: base64-encoded full service account JSON
  const b64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 || process.env.ADMIN_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      const decoded = Buffer.from(
        b64,
        "base64"
      ).toString("utf8");
      serviceAccount = JSON.parse(decoded);
    } catch {
      console.warn("[admin] Failed to parse service account B64");
    }
  }

  // Priority 2: individual credential env vars
  if (!serviceAccount && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_ADMIN_PROJECT_ID ?? "",
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "",
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount as Parameters<typeof admin.credential.cert>[0])
      : admin.credential.applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
}

export function getAdminAuth() {
  if (!authInstance) {
    const authPkg = "firebase-admin/auth";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require(authPkg) as typeof import("firebase-admin/auth");
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getAdminDb() {
  if (!dbInstance) {
    const dbPkg = "firebase-admin/firestore";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require(dbPkg) as typeof import("firebase-admin/firestore");
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}
