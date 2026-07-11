// DIAGNOSTIC ROUTE — DELETE AFTER USE
export const runtime = "nodejs";
export async function GET() {
  const pkRaw = process.env.FIREBASE_PRIVATE_KEY || "";
  const adminB64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 || "";
  const r: Record<string, unknown> = {
    // FIREBASE_PRIVATE_KEY variant
    hasKey: !!pkRaw,
    keyLen: pkRaw.length,
    keyHead: JSON.stringify(pkRaw.slice(0, 32)),
    keyHasRealNewline: pkRaw.includes("\n"),
    keyHasLiteralBackslashN: pkRaw.includes("\\n"),
    // ADMIN_ prefixed variants
    hasAdminProject: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    hasAdminEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    hasAdminKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    // B64 service account
    hasB64: !!adminB64,
    b64Len: adminB64.length,
    b64Head: JSON.stringify(adminB64.slice(0, 32)),
    nodeEnv: process.env.NODE_ENV,
  };
  try {
    const { cert, initializeApp, getApps, getApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    let certParam: Record<string, string> | undefined;
    if (adminB64) {
      const decoded = Buffer.from(adminB64, "base64").toString("utf8");
      certParam = JSON.parse(decoded);
    } else if (pkRaw) {
      const pk = pkRaw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
      certParam = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "",
        privateKey: pk,
      };
    }
    const app = getApps().length ? getApp() : initializeApp({
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      credential: certParam ? require("firebase-admin").credential.cert(certParam) : require("firebase-admin").credential.applicationDefault(),
    });
    getAuth(app);
    r.adminInit = "OK";
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    r.adminInit = "FAIL";
    r.errCode = err?.code;
    r.errMsg = err?.message;
  }
  return Response.json(r);
}
