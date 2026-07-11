import "server-only";
import { getApps, getApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;

import { credential } from "firebase-admin";

function getFirebaseApp() {
  if (getApps().length > 0) return getApp();

  let certParam;
  
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      certParam = JSON.parse(decoded);
    } catch (e) {
      console.warn("Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT_B64");
    }
  } else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    certParam = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return initializeApp({
    credential: certParam ? credential.cert(certParam) : credential.applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
}

export function getAdminAuth() {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getAdminDb() {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}
