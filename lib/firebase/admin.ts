import "server-only";

import {
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps().length ? getApp() : initializeApp();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

// Proxies for backward compatibility and lazy initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminAuth = new Proxy({} as any, {
  get(_, prop) {
    const auth = getAdminAuth();
    const value = Reflect.get(auth, prop);
    return typeof value === "function" ? value.bind(auth) : value;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminDb = new Proxy({} as any, {
  get(_, prop) {
    const db = getAdminDb();
    const value = Reflect.get(db, prop);
    return typeof value === "function" ? value.bind(db) : value;
  }
});
