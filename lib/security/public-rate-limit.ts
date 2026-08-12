import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, FieldValue } from "@/lib/firebase/admin";

function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown")
    .split(",")[0]
    .trim();
}

export async function enforcePublicRateLimit(
  request: Request,
  scope: string,
  limit = 30,
  windowMs = 60_000,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ipHash = crypto.createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 32);
  const scopeHash = crypto.createHash("sha256").update(scope).digest("hex").slice(0, 16);
  const id = `${scopeHash}_${ipHash}_${windowStart}`;
  const ref = adminDb.collection("public_rate_limits").doc(id);

  const allowed = await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const count = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
    if (count >= limit) return false;
    tx.set(
      ref,
      {
        count: FieldValue.increment(1),
        scopeHash,
        windowStart,
        expiresAt: Timestamp.fromMillis(windowStart + windowMs * 2),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  return {
    allowed,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
  };
}
