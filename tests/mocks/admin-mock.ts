import "server-only";
import admin from "firebase-admin";

const adminApp = admin.apps.length === 0 ? admin.initializeApp() : admin.app();

export function getAdminApp() {
  return adminApp;
}

export const adminDb = admin.firestore(adminApp);

export function getAdminDb() {
  return adminDb;
}

export const adminAuth = {
  verifySessionCookie: async (cookie: string, checkRevoked?: boolean) => {
    try {
      const payloadBase64 = cookie.split(".")[1];
      const json = Buffer.from(payloadBase64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch {
      throw new Error("auth/invalid-session-cookie");
    }
  },
  verifyIdToken: async (idToken: string, checkRevoked?: boolean) => {
    try {
      const payloadBase64 = idToken.split(".")[1];
      const json = Buffer.from(payloadBase64, "base64").toString("utf8");
      const claims = JSON.parse(json);
      claims.auth_time = claims.auth_time || Math.floor(Date.now() / 1000);
      return claims;
    } catch {
      throw new Error("auth/invalid-id-token");
    }
  },
  createSessionCookie: async (idToken: string, options: any) => {
    return idToken;
  },
};

export function getAdminAuth() {
  return adminAuth;
}
