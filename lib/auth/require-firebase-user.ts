import { NextRequest } from "next/server";
import { adminAuth } from "../firebase/admin";

export async function requireFirebaseUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw { status: 401, message: "Missing or invalid authorization header." };
  }

  const token = authHeader.substring(7);
  if (!token.trim()) {
    throw { status: 401, message: "Bearer token is empty." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    if (error.code?.startsWith("auth/")) {
      throw { status: 401, message: "Unauthorized: " + error.message };
    }
    throw { status: 500, message: "Internal authentication failure: " + error.message };
  }
}
