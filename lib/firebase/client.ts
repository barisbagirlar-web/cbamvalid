/* eslint-disable */

"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "cbam-desk.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

for (const [key, value] of Object.entries(config)) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`FIREBASE_CLIENT_CONFIG_MISSING:${key}`);
  }
}

const app = getApps().length ? getApp() : initializeApp(config);
export const firebaseAuth = getAuth(app);
export const firebaseFunctions = getFunctions(app, "europe-west1");
export const firebaseDb = getFirestore(app);
export const firebaseStorage = getStorage(app);

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  connectFunctionsEmulator(firebaseFunctions, "127.0.0.1", 5001);
  connectFirestoreEmulator(firebaseDb, "127.0.0.1", 8080);
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099");
  connectStorageEmulator(firebaseStorage, "127.0.0.1", 9199);
}

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY) {
  if (process.env.NODE_ENV !== "production") {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set Firebase Auth persistence to browserLocalPersistence:", err);
});
