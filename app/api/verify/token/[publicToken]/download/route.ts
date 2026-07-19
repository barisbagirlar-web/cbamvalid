import { NextRequest, NextResponse } from "next/server";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicToken: string }> }
) {
  try {
    const params = await props.params;
    const publicToken = params.publicToken;

    if (!publicToken || !/^[a-fA-F0-9]{64}$/.test(publicToken)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const publicVerificationTokenHash = crypto
      .createHash("sha256")
      .update(publicToken)
      .digest("hex");

    const querySnap = await adminDb
      .collection("cbam_reports")
      .where("publicVerificationTokenHash", "==", publicVerificationTokenHash)
      .where("publicVerificationState", "==", "ACTIVE")
      .limit(1)
      .get();

    if (querySnap.empty) {
      return NextResponse.json({ error: "Active verification dossier not found" }, { status: 404 });
    }

    const reportData = querySnap.docs[0].data();
    const zipStorage = reportData.storage?.["dossier.zip"];

    if (!zipStorage || !zipStorage.path) {
      return NextResponse.json({ error: "Verification package artifact not found" }, { status: 404 });
    }

    const bucket = getAdminStorageBucket();
    const [fileBytes] = await bucket.file(zipStorage.path).download();

    return new NextResponse(new Uint8Array(fileBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="cbamvalid_dossier_${reportData.reportId}_v${reportData.releaseVersion}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("[PUBLIC TOKEN DOWNLOAD ERROR]:", error.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
