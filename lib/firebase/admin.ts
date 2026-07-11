import "server-only";

let authInstance: import("firebase-admin/auth").Auth | null = null;
let dbInstance: import("firebase-admin/firestore").Firestore | null = null;

function getFirebaseApp() {
  // Use require() so Turbopack/Webpack treat firebase-admin as a
  // server-only external module and never attempt to bundle it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getApps, getApp, initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");

  if (getApps().length > 0) return getApp();

  let serviceAccount: Record<string, string> | undefined;

  // Priority 1: base64-encoded full service account JSON
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64,
        "base64"
      ).toString("utf8");
      serviceAccount = JSON.parse(decoded);
    } catch {
      console.warn("[admin] Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT_B64");
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("firebase-admin/auth") as typeof import("firebase-admin/auth");
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getAdminDb() {
  if (!dbInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}
