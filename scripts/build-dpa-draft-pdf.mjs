/**
 * Generates a DRAFT DPA PDF for public download.
 * Not a signed legal agreement — procurement starting point only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../public/security/dpa-draft.pdf");

const LINES = [
  "CBAMValid — Data Processing Agreement (DRAFT)",
  "",
  "Status: DRAFT for procurement discussion. Not a signed agreement.",
  "Issuer: SectorCalc Corporation (CBAMValid)",
  "Contact: privacy@cbamvalid.com / info@cbamvalid.com",
  "Date: 2026-07-28",
  "",
  "1. Subject matter",
  "Processing of customer account, case, evidence metadata, and sealed",
  "package records required to operate the CBAMValid Preparation Pack service.",
  "",
  "2. Roles",
  "Customer = Controller (or Processor for its clients).",
  "CBAMValid / SectorCalc Corporation = Processor for customer case data.",
  "",
  "3. Hosting region",
  "Primary application region: Google Cloud / Firebase europe-west1 (EU).",
  "",
  "4. Security measures (factual)",
  "- HTTPS/TLS for public endpoints",
  "- HttpOnly server session cookies",
  "- Server-side tenant and case authorization",
  "- Provider encryption at rest (Firestore / Cloud Storage defaults)",
  "- Immutable sealed release objects once published",
  "",
  "5. Sub-processors (material)",
  "- Google Cloud / Firebase: hosting, auth, Firestore, Storage, Functions/Cloud Run",
  "- Paddle: payment processing / merchant of record for paid lock checkout",
  "",
  "6. Certification honesty",
  "This draft does NOT claim ISO 27001, SOC 2, or equivalent certification.",
  "Certificates will be published only with issuer, scope, and validity dates.",
  "",
  "7. Deletion / access requests",
  "privacy@cbamvalid.com or info@cbamvalid.com",
  "Sealed packages already shared with buyers may remain with recipients",
  "under their own retention duties.",
  "",
  "8. Independence boundary",
  "CBAMValid packages are operator-prepared. Processing under this DPA does",
  "not create an accredited verification opinion.",
];

async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 740;
  const size = 10;
  const leading = 14;

  for (const line of LINES) {
    if (y < 48) {
      page = pdf.addPage([612, 792]);
      y = 740;
    }
    const isHeading = line.length > 0 && !line.startsWith("-") && /^(\d+\.|CBAMValid|Status:|Issuer:|Contact:|Date:)/.test(line);
    page.drawText(line || " ", {
      x: 54,
      y,
      size: line.startsWith("CBAMValid") ? 14 : size,
      font: isHeading || line.startsWith("CBAMValid") ? bold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= line.startsWith("CBAMValid") ? 20 : leading;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, await pdf.save());
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
