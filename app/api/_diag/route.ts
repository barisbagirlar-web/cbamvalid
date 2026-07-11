// DIAGNOSTIC ROUTE — DELETE AFTER USE
export const runtime = "nodejs";
export async function GET() {
  const pkRaw = process.env.FIREBASE_PRIVATE_KEY || "";
  const r: Record<string, unknown> = {
    hasProject: !!process.env.FIREBASE_PROJECT_ID,
    hasEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasKey: !!pkRaw,
    keyLen: pkRaw.length,
    keyHead: JSON.stringify(pkRaw.slice(0, 32)),
    keyHasRealNewline: pkRaw.includes("\n"),
    keyHasLiteralBackslashN: pkRaw.includes("\\n"),
    // also check ADMIN_ prefixed variants
    hasAdminProject: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    hasAdminEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    hasAdminKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    hasB64: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64,
    nodeEnv: process.env.NODE_ENV,
  };
  try {
    const { cert, initializeApp, getApps, getApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const pk = pkRaw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
    const app = getApps().length ? getApp() : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: pk,
      }),
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
