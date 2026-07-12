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

const app = getApps()[0] ?? initializeApp({
  credential: getCredential(),
  projectId: process.env.GCLOUD_PROJECT ?? "cbam-desk",
});

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export { FieldValue };
export type { DecodedIdToken } from "firebase-admin/auth";

export function getAdminStorageBucket() {
  return getStorage(app).bucket();
}
