import "server-only";

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const getCredential = () => {
  if (process.env.ADMIN_USE_ADC === "true") {
    return applicationDefault();
  }
  const b64 = process.env.ADMIN_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      return cert(serviceAccount);
    } catch (e) {
      console.warn("Failed to parse service account JSON, falling back to applicationDefault", e);
    }
  }
  return applicationDefault();
};

const configuredStorageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  undefined;

const app = getApps()[0] ?? initializeApp({
  credential: getCredential(),
  projectId: process.env.GCLOUD_PROJECT ?? "cbam-desk",
  ...(configuredStorageBucket ? { storageBucket: configuredStorageBucket } : {}),
});

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export { FieldValue };
export type { DecodedIdToken } from "firebase-admin/auth";
export type { DocumentData } from "firebase-admin/firestore";

export function getAdminStorageBucket(bucketName?: string) {
  const resolved = bucketName || configuredStorageBucket || app.options.storageBucket;
  if (!resolved) {
    throw new Error("FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED");
  }
  return getStorage(app).bucket(resolved);
}
