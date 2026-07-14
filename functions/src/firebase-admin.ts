import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app;

if (!getApps().length) {
  app = initializeApp();
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export const getStorageBucket = () => adminStorage.bucket();

// Use a custom setting for firestore to ignore undefined properties
adminDb.settings({ ignoreUndefinedProperties: true });
