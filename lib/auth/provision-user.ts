import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";

export async function provisionUserProfile(
  decoded: DecodedIdToken
): Promise<void> {
  const userRef =
    adminDb.collection("users").doc(decoded.uid);

  await adminDb.runTransaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (transaction: any) => {
      const existing =
        await transaction.get(userRef);

      if (existing.exists) {
        return;
      }

      transaction.create(userRef, {
        uid: decoded.uid,
        email:
          typeof decoded.email === "string"
            ? decoded.email
            : "",
        name:
          typeof decoded.name === "string"
            ? decoded.name
            : "",
        role: "user",
        accountStatus: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  );
}
