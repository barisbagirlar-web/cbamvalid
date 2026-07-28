import { NextRequest, NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import {
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

    const reportData = report.data;
    const zipStorage = (reportData.storage as Record<string, { path?: string }> | undefined)?.[
      "dossier.zip"
    ];

    if (!zipStorage?.path) {
      return NextResponse.json({ error: "Verification package artifact not found" }, { status: 404 });
    }

    await logBuyerShareView({
      reportId: report.id,
      userAgent: request.headers.get("user-agent"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      event: "DOWNLOAD",
    });

    const bucket = getAdminStorageBucket();
    const [fileBytes] = await bucket.file(zipStorage.path).download();

    return new NextResponse(new Uint8Array(fileBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="cbamvalid_dossier_${reportData.reportId}_v${reportData.releaseVersion}.zip"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PUBLIC TOKEN DOWNLOAD ERROR]:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
