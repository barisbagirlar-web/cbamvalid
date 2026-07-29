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
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "Token verification failed.";
    if (code.startsWith("auth/")) {
      throw { status: 401, message: "Unauthorized: " + message };
    }
    throw { status: 500, message: "Internal authentication failure: " + message };
  }
}
