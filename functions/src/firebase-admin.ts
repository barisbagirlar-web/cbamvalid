import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app;

if (!getApps().length) {
  app = initializeApp();
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Use a custom setting for firestore to ignore undefined properties
adminDb.settings({ ignoreUndefinedProperties: true });
