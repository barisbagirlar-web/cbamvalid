import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const InquirySchema = z.object({
  company: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  installations: z.coerce.number().int().min(1).max(10000),
  needSso: z.boolean().optional().default(false),
  needHolding: z.boolean().optional().default(false),
  needSla: z.boolean().optional().default(false),
  message: z.string().trim().max(4000).optional().default(""),
  source: z.enum(["enterprise", "partners", "demo", "pricing"]).optional().default("enterprise"),
});

/**
 * Enterprise / partner inquiry intake.
 * Fail-closed validation. Persists when Admin is available; always returns mailto fallback.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = InquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "SCHEMA", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const receivedAt = new Date().toISOString();
  let persisted = false;

  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    await adminDb.collection("enterprise_inquiries").add({
      ...data,
      receivedAt,
      status: "NEW",
    });
    persisted = true;
  } catch {
    persisted = false;
  }

  const subject = encodeURIComponent(
    `CBAMValid ${data.source} inquiry — ${data.company}`
  );
  const mailBody = encodeURIComponent(
    [
      `Company: ${data.company}`,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Installations: ${data.installations}`,
      `SSO: ${data.needSso ? "yes" : "no"}`,
      `Holding: ${data.needHolding ? "yes" : "no"}`,
      `SLA: ${data.needSla ? "yes" : "no"}`,
      `Source: ${data.source}`,
      `ReceivedAt: ${receivedAt}`,
      "",
      data.message || "(no message)",
    ].join("\n")
  );

  return NextResponse.json({
    ok: true,
    persisted,
    receivedAt,
    mailto: `mailto:info@cbamvalid.com?subject=${subject}&body=${mailBody}`,
  });
}
