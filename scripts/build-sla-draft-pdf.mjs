/**
 * Generates Enterprise SLA DRAFT PDF for public download.
 * Not a signed MSA — procurement starting point only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../public/enterprise/sla-draft.pdf");

const LINES = [
  "CBAMValid — Service Level Agreement (DRAFT)",
  "",
  "Status: DRAFT for Enterprise procurement. Not a signed MSA.",
  "Issuer: SectorCalc Corporation (CBAMValid)",
  "Contact: info@cbamvalid.com",
  "Version: sla-draft-v1.0.0",
  "Date: 2026-07-28",
  "",
  "1. Scope",
  "Availability and support targets for the CBAMValid Exporter Verification",
  "Preparation Pack service under an Enterprise annual agreement.",
  "",
  "2. Support channels",
  "Primary: info@cbamvalid.com",
  "Privacy / DPA: privacy@cbamvalid.com",
  "",
  "3. Response targets (business hours, Europe/Dublin)",
  "- Critical (seal/download unavailable): respond in 4 business hours;",
  "  aim to restore or provide workaround within 1 business day.",
  "- High (checkout / entitlement / SSO login): respond in 8 business hours;",
  "  aim to resolve within 2 business days.",
  "- Normal (configuration / how-to): respond in 1 business day;",
  "  aim to resolve within 5 business days.",
  "",
  "4. Uptime posture",
  "Runtime depends on Google Cloud / Firebase (europe-west1) managed services.",
  "Sealed releases are immutable objects once published and remain downloadable",
  "subject to tenant authorization.",
  "",
  "5. Exclusions",
  "- Customer IdP / SSO provider outages",
  "- Paddle payment-provider incidents",
  "- Customer network, browser, or evidence-file quality issues",
  "- Force majeure and upstream cloud regional incidents",
  "",
  "6. Credits",
  "Service credits, if any, are defined only in the signed Enterprise MSA.",
  "This draft does not create a credit entitlement by itself.",
  "",
  "7. Certification honesty",
  "This draft does NOT claim ISO 27001 or SOC 2 certification.",
  "",
  "8. Independence boundary",
  "CBAMValid prepares operator dossiers. SLA performance does not create an",
  "accredited verification opinion, EU approval, or customs acceptance.",
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
    const isHeading =
      line.length > 0 &&
      !line.startsWith("-") &&
      /^(\d+\.|CBAMValid|Status:|Issuer:|Contact:|Version:|Date:)/.test(line);
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
