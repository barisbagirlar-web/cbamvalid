/**
 * Rebuild gate-free public sample dossier assets from page webps + package fixtures.
 * Usage: node scripts/build-public-sample-dossier.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "sample-dossier");
const pagesDir = path.join(outDir, "v1", "pages");

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main() {
  const pages = fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith(".webp"))
    .sort();
  if (pages.length !== 16) {
    throw new Error(`Expected 16 page webps, found ${pages.length}`);
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle("CBAMValid Sample Dossier");
  pdf.setAuthor("CBAMValid");
  pdf.setSubject("Fictional demonstration dossier — not a verification opinion");

  for (const file of pages) {
    const png = await sharp(path.join(pagesDir, file)).png().toBuffer();
    const img = await pdf.embedPng(png);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const pdfPath = path.join(outDir, "CBAMValid-Sample-Dossier.pdf");
  fs.writeFileSync(pdfPath, await pdf.save());

  const jsonSrc = path.join(root, "artifacts", "sample-v5", "Calculation Trace.json");
  const xlsxSrc = path.join(root, "artifacts", "sample-v5", "Verifier Workspace.xlsx");
  const jsonPath = path.join(outDir, "CBAMValid-Sample-Dossier.json");
  const xlsxPath = path.join(outDir, "CBAMValid-Sample-Dossier.xlsx");
  fs.copyFileSync(jsonSrc, jsonPath);
  fs.copyFileSync(xlsxSrc, xlsxPath);

  const files = [
    {
      path: "CBAMValid-Sample-Dossier.pdf",
      mediaType: "application/pdf",
      role: "sample-pdf",
      href: "/sample-dossier/CBAMValid-Sample-Dossier.pdf",
      sizeBytes: fs.statSync(pdfPath).size,
      sha256: sha256File(pdfPath),
    },
    {
      path: "CBAMValid-Sample-Dossier.json",
      mediaType: "application/json",
      role: "sample-json",
      href: "/sample-dossier/CBAMValid-Sample-Dossier.json",
      sizeBytes: fs.statSync(jsonPath).size,
      sha256: sha256File(jsonPath),
    },
    {
      path: "CBAMValid-Sample-Dossier.xlsx",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      role: "sample-xlsx",
      href: "/sample-dossier/CBAMValid-Sample-Dossier.xlsx",
      sizeBytes: fs.statSync(xlsxPath).size,
      sha256: sha256File(xlsxPath),
    },
  ];

  const manifest = {
    schemaVersion: "CBAMVALID-PUBLIC-SAMPLE-1.0",
    title: "CBAMValid Public Sample Dossier",
    notice:
      "Fictional demonstration data. Not a customs declaration, official CBAM Registry submission, or accredited verifier opinion.",
    pageCount: 16,
    generatedAt: new Date().toISOString(),
    primaryDocumentSha256: files[0].sha256,
    files,
    spreads: {
      cover: "/sample-dossier/v1/pages/page-001.webp",
      calculationTrace: "/sample-dossier/v1/pages/page-011.webp",
      evidenceRegister: "/sample-dossier/v1/pages/page-013.webp",
    },
  };

  fs.writeFileSync(
    path.join(outDir, "integrity-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  console.log(
    JSON.stringify(
      {
        pageCount: manifest.pageCount,
        primaryDocumentSha256: manifest.primaryDocumentSha256,
        pdfBytes: files[0].sizeBytes,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
