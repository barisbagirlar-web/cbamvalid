import { isSandboxApp } from "@/lib/cbam/sandbox-env";

export const dynamic = "force-dynamic";

const FORMATS = ["pdf", "zip", "xlsx", "manifest"] as const;
type QaArtifactFormat = (typeof FORMATS)[number];

function isFormat(value: string): value is QaArtifactFormat {
  return FORMATS.includes(value as QaArtifactFormat);
}

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string; format: string }> }
): Promise<Response> {
  if (!isSandboxApp()) return new Response(null, { status: 404 });

  const { key, format } = await context.params;
  if (!isFormat(format)) return new Response(null, { status: 404 });

  // Load synthetic fixtures only after the sandbox gate. Production must never
  // import or render the QA dataset.
  const [{ FOUR_DOSSIER_KEYS }, { buildDossierSealedPackage, dossierReportId }] =
    await Promise.all([
      import("@/tests/fixtures/four-dossiers"),
      import("@/tests/fixtures/four-dossier-package"),
    ]);

  if (!FOUR_DOSSIER_KEYS.includes(key as (typeof FOUR_DOSSIER_KEYS)[number])) {
    return new Response(null, { status: 404 });
  }

  const dossierKey = key as (typeof FOUR_DOSSIER_KEYS)[number];
  const pkg = await buildDossierSealedPackage(dossierKey);
  const reportId = dossierReportId(dossierKey);
  const baseName = safeFileName(`${dossierKey}-${reportId}`);

  const payload = (() => {
    switch (format) {
      case "pdf":
        return {
          bytes: pkg.finalized.primaryPdf,
          mediaType: "application/pdf",
          fileName: `${baseName}-current-report.pdf`,
        };
      case "zip":
        return {
          bytes: pkg.finalized.zip,
          mediaType: "application/zip",
          fileName: `${baseName}-current-package.zip`,
        };
      case "xlsx":
        return {
          bytes: pkg.finalized.workbook,
          mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName: `${baseName}-verifier-workspace.xlsx`,
        };
      case "manifest":
        return {
          bytes: pkg.manifestResult.bytes,
          mediaType: "application/json",
          fileName: `${baseName}-manifest.json`,
        };
    }
  })();

  return new Response(new Uint8Array(payload.bytes), {
    status: 200,
    headers: {
      "Content-Type": payload.mediaType,
      "Content-Disposition": `attachment; filename="${payload.fileName}"`,
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-CBAMValid-QA-Data": "synthetic",
      "X-CBAMValid-Report-ID": reportId,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
