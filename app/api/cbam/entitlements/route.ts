import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    const snapshot = await getAdminDb()
      .collection("entitlements")
      .where("uid", "==", session.uid)
      .where("status", "==", "AVAILABLE")
      .get();

    const entitlements = snapshot.docs.map((doc: any) => doc.data());

    return NextResponse.json({ status: "success", entitlements });
  } catch (error: any) {
    console.error("[ENTITLEMENTS LIST API ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to fetch entitlements" }, { status });
  }
}
