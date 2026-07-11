"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "cbam-desk.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate environment variables on initialization
for (const [key, value] of Object.entries(config)) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`FIREBASE_CLIENT_CONFIG_MISSING:${key}`);
  }
}

const app = getApps().length ? getApp() : initializeApp(config);
export const firebaseAuth = getAuth(app);
export const firebaseFunctions = getFunctions(app, "europe-west1");
export const firebaseDb = getFirestore(app);

// Initialize App Check (browser only)
if (typeof window !== "undefined") {
  // Use debug token in development, use ReCaptcha Enterprise in production
  if (process.env.NODE_ENV !== 'production') {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY || 'dummy_key'),
    isTokenAutoRefreshEnabled: true
  });
}

// Enforce browserLocalPersistence
setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set Firebase Auth persistence to browserLocalPersistence:", err);
});
