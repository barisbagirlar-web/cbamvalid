import "server-only";

import admin from "firebase-admin";

function getAdminApp() {
  return admin.apps.length ? admin.app() : admin.initializeApp();
}

export function getAdminAuth() {
  return admin.auth(getAdminApp());
}

export function getAdminDb() {
  return admin.firestore(getAdminApp());
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
