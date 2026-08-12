import { NextResponse } from "next/server";
import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";
import { isValidShareTokenId, revokeShareLink } from "@/lib/verify/share-links";

export async function DELETE(request: Request, props: { params: Promise<{ reportId: string; tokenId: string }> }) {
  try {
    const auth = await requireFirebaseSession(request);
    const { reportId, tokenId } = await props.params;
    if (!isValidShareTokenId(tokenId)) {
      return NextResponse.json({ error: "INVALID_TOKEN_ID" }, { status: 400 });
    }
    await revokeShareLink({ reportId, uid: auth.uid, tokenId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    const status = message === "REPORT_FORBIDDEN" ? 403 : message.endsWith("NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
