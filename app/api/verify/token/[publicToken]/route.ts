import { NextRequest, NextResponse } from "next/server";
import {
  buildBuyerShareMetadata,
  findActiveReportByPublicToken,
  isValidPublicTokenFormat,
  logBuyerShareView,
} from "@/lib/verify/public-token-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicToken: string }> }
) {
  try {
    const params = await props.params;
    const publicToken = params.publicToken;

    if (!publicToken || !isValidPublicTokenFormat(publicToken)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const report = await findActiveReportByPublicToken(publicToken);
    if (!report) {
      return NextResponse.json({ error: "Active verification dossier not found" }, { status: 404 });
    }

    // Fire-and-forget must not block buyer UX; still await for reliability in serverless.
    await logBuyerShareView({
      reportId: report.id,
      userAgent: request.headers.get("user-agent"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      event: "VIEW",
    });

    return NextResponse.json({ data: buildBuyerShareMetadata(report.data) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PUBLIC TOKEN VERIFY ERROR]:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
