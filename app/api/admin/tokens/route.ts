import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSessionRevocationSensitive } from "@/lib/auth/get-server-session";

export async function POST(request: Request) {
  try {
    const session = await getServerSessionRevocationSensitive();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    const err = error as Error;
    console.error("Admin action token route error:", err.message || err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
