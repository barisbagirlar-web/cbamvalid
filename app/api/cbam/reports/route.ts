import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    const snapshot = await getAdminDb()
      .collection("cbam_reports")
      .where("uid", "==", session.uid)
      .get();

    const reports = snapshot.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ status: "success", reports });
  } catch (error: any) {
    console.error("[REPORTS LIST API ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to fetch reports" }, { status });
  }
}
