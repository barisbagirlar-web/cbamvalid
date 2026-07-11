import "server-only";
import admin from "firebase-admin";

const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);

export function getAdminAuth() {
  return adminAuth;
}

export function getAdminDb() {
  return adminDb;
}
