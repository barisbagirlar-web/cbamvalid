import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { enforcePublicRateLimit } from "@/lib/security/public-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pseudonym(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return `op_${crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export async function GET(request: Request, props: { params: Promise<{ sha256: string }> }) {
  const rate = await enforcePublicRateLimit(request, "api-v1-verify", 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { sha256 } = await props.params;
  const hash = sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: "INVALID_SHA256" }, { status: 400 });
  }

  const snapshot = await adminDb.collection("cbam_reports").where("documentHash", "==", hash).limit(2).get();
  if (snapshot.empty) {
    return NextResponse.json(
      { exists: false, status: null },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  }
  if (snapshot.size > 1) {
    console.error("[VERIFY HASH COLLISION] multiple report records reference the same document hash", hash);
    return NextResponse.json({ error: "REGISTRY_INTEGRITY_CONFLICT" }, { status: 409 });
  }

  const data = snapshot.docs[0].data();
  const revoked = data.publicVerificationState === "REVOKED" || data.status === "REVOKED";
  const sealed = data.status === "SEALED" || revoked;
  if (!sealed) {
    console.error("[VERIFY STATE CONFLICT] hash matched a non-sealed report", snapshot.docs[0].id, data.status);
    return NextResponse.json({ error: "REGISTRY_STATE_CONFLICT" }, { status: 409 });
  }

  return NextResponse.json(
    {
      exists: true,
      sealedAt: toIsoTimestamp(data.createdAt),
      rulesetVersion: typeof data.rulesetVersion === "string" ? data.rulesetVersion : null,
      engineVersion:
        typeof data.engineVersion === "string"
          ? data.engineVersion
          : typeof data.calculation?.engineVersion === "string"
            ? data.calculation.engineVersion
            : null,
      operator: pseudonym(data.uid),
      status: revoked ? "revoked" : "valid",
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff" } },
  );
}
