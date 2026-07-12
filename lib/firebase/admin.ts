/* eslint-disable */

import "server-only";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getApp } from 'firebase-admin/app';

if (!getApps().length) {
  try {
    const b64 = process.env.ADMIN_SERVICE_ACCOUNT_B64;
    if (b64) {
      const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      initializeApp();
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export { FieldValue };
export type { DecodedIdToken };

export function getAdminStorageBucket() {
  return getStorage(getApp()).bucket();
}
