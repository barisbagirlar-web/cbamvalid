import integrityManifest from "@/public/sample-dossier/integrity-manifest.json";

export type PublicSampleFileRole = "sample-pdf" | "sample-json" | "sample-xlsx";

export const PUBLIC_SAMPLE_NOTICE =
  "Fictional demonstration data. Not a customs declaration, official CBAM Registry submission, or accredited verifier opinion.";

export const PUBLIC_SAMPLE_DOSSIER = {
  title: integrityManifest.title,
  notice: integrityManifest.notice,
  pageCount: integrityManifest.pageCount,
  primaryDocumentSha256: integrityManifest.primaryDocumentSha256,
  files: integrityManifest.files,
  spreads: integrityManifest.spreads,
  downloads: {
    pdf: "/sample-dossier/CBAMValid-Sample-Dossier.pdf",
    json: "/sample-dossier/CBAMValid-Sample-Dossier.json",
    xlsx: "/sample-dossier/CBAMValid-Sample-Dossier.xlsx",
    manifest: "/sample-dossier/integrity-manifest.json",
  },
} as const;

export function findPublicSampleByHash(hash: string) {
  const normalized = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return null;
  return (
    PUBLIC_SAMPLE_DOSSIER.files.find((file) => file.sha256.toLowerCase() === normalized) ?? null
  );
}

export function isPublicSampleHash(hash: string): boolean {
  return findPublicSampleByHash(hash) !== null;
}
