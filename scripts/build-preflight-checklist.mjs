/**
 * Builds the T4.2 pre-flight checklist workbook (XLSX + CSV).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/onboarding");

const TIME = "2–4 hours if your data is ready. 2–3 weeks if starting from zero.";

const CHECKLIST = [
  {
    title: "Identity & scope",
    items: [
      "Legal operator / exporter name as on commercial documents",
      "Installation name, country, and address",
      "Reporting year and period dates",
      "Production route and system boundary decision",
    ],
  },
  {
    title: "Goods & CN codes",
    items: [
      "CN codes for goods in scope",
      "Production quantity per good (tonnes)",
      "Simple vs complex goods classification",
      "Precursor applicability decision",
    ],
  },
  {
    title: "Activity data & emissions",
    items: [
      "Direct emissions for the period (or measurement basis)",
      "Electricity consumption and grid factor where required",
      "Fuel / process activity data supporting the calc path",
      "Allocation method if multiple goods share sources",
    ],
  },
  {
    title: "Evidence files",
    items: [
      "Meters, invoices, lab reports, or process logs for each material input",
      "SHA-ready PDFs or sheets (clear issue dates and periods)",
      "Internal review status path to APPROVED / SUPPORTED",
      "Field-to-evidence links planned before seal",
    ],
  },
];

function xmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sheetXml(rows) {
  const cellXml = rows
    .map((row, rIdx) => {
      const cells = row
        .map((value, cIdx) => {
          const ref = `${String.fromCharCode(65 + cIdx)}${rIdx + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rIdx + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${cellXml}</sheetData>
</worksheet>`;
}

async function buildXlsx(rows) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  const xl = zip.folder("xl");
  xl.file(
    "workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Preflight" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  );
  xl.folder("_rels").file(
    "workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  );
  xl.folder("worksheets").file("sheet1.xml", sheetXml(rows));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  const rows = [
    ["CBAMValid Pre-flight Checklist", "", "", ""],
    ["Honest time estimate", TIME, "", ""],
    ["Fill this sheet at the plant, return completed, then enter into CBAMValid.", "", "", ""],
    ["Category", "Item", "Plant value / note", "Evidence file name"],
  ];
  for (const cat of CHECKLIST) {
    for (const item of cat.items) {
      rows.push([cat.title, item, "", ""]);
    }
  }
  rows.push(["Boundary", "Operator-prepared dossier only — not an accredited verification opinion.", "", ""]);

  mkdirSync(outDir, { recursive: true });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  writeFileSync(join(outDir, "cbamvalid-preflight-checklist.csv"), csv, "utf8");
  writeFileSync(join(outDir, "cbamvalid-preflight-checklist.xlsx"), await buildXlsx(rows));
  console.log(`Wrote ${outDir}/cbamvalid-preflight-checklist.xlsx (+ .csv)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
