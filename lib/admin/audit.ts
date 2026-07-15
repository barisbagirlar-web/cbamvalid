import "server-only";
import { adminDb, FieldValue, DecodedIdToken } from "@/lib/firebase/admin";

export async function logAdminAction(
  adminClaims: DecodedIdToken,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, any>
) {
  try {
    await adminDb.collection("admin_audit_log").add({
      adminId: adminClaims.uid,
      adminEmail: adminClaims.email,
      action,
      targetType,
      targetId,
      details,
      timestamp: FieldValue.serverTimestamp(),
      ipAddress: "server", // could capture from request in real route
    });
  } catch (error) {
    console.error("Failed to write to admin_audit_log:", error);
    // Do not throw here to prevent blocking the actual operation if audit fails
    // However, in high-security environments, you might want to throw.
  }
}
