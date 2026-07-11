import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    
    if (!session.admin) {
      return NextResponse.json({ error: "Forbidden: Access restricted to Super Admin" }, { status: 403 });
    }

    const { targetUserId, tokensToSet } = await request.json();

    if (!targetUserId || tokensToSet === undefined || isNaN(Number(tokensToSet))) {
      return NextResponse.json({ error: "Invalid target user or token count" }, { status: 400 });
    }

    // Update user tokens using Firebase Admin SDK
    await getAdminDb().collection("users").doc(targetUserId).update({
      tokens: Number(tokensToSet),
    });

    console.log(`Admin ${session.email} set tokens of user ${targetUserId} to ${tokensToSet}`);

    return NextResponse.json({ success: true, updatedUserId: targetUserId, newTokens: tokensToSet });
  } catch (error: any) {
    console.error("Admin action token route error:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Server error" }, { status });
  }
}
