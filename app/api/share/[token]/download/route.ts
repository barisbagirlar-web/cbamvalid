import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { resolveShareToken } from "@/lib/verify/share-links";
import { enforcePublicRateLimit } from "@/lib/security/public-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const rate = await enforcePublicRateLimit(request, "share-download", 30);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { token } = await props.params;
  const resolved = await resolveShareToken(token, false);
  if (resolved.state === "REVOKED") return NextResponse.json({ error: "SHARE_REVOKED" }, { status: 410 });
  if (resolved.state !== "ACTIVE") return NextResponse.json({ error: "SHARE_NOT_FOUND" }, { status: 404 });

  const storage = resolved.reportData.storage as Record<string, { path?: string }> | undefined;
  const zip = storage?.["dossier.zip"];
  if (!zip?.path) return NextResponse.json({ error: "PACKAGE_NOT_FOUND" }, { status: 404 });

  const [fileBytes] = await getAdminStorageBucket().file(zip.path).download();
  return new NextResponse(new Uint8Array(fileBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="cbamvalid_dossier_${resolved.reportId}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
