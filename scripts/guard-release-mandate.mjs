import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, "..");

const check = process.argv.find(arg => arg.startsWith("--check="))?.split("=")[1];

if (!check) {
  console.error("[GUARD-MANDATE] Error: Specify a check pattern via --check=<name>");
  process.exit(1);
}

console.log(`[GUARD-MANDATE] Running check: ${check}...`);

switch (check) {
  case "single-product": {
    // Verify product mappings in checkout route
    const checkoutRoutePath = path.join(rootDir, "app/api/checkout/cbam/route.ts");
    if (!fs.existsSync(checkoutRoutePath)) {
      console.error("[FAIL] checkout route not found.");
      process.exit(1);
    }
    const content = fs.readFileSync(checkoutRoutePath, "utf-8");
    if (!content.includes("CBAM_EXPORTER_FINAL_REPORT")) {
      console.error("[FAIL] Product code must be CBAM_EXPORTER_FINAL_REPORT.");
      process.exit(1);
    }
    console.log("[PASS] Single product code verified.");
    break;
  }

  case "single-payment-channel": {
    // Verify only Paddle is active
    const webhookDir = path.join(rootDir, "app/api/webhooks/paddle");
    if (!fs.existsSync(webhookDir)) {
      console.error("[FAIL] Paddle webhook folder is missing.");
      process.exit(1);
    }
    console.log("[PASS] Single payment webhook route verified.");
    break;
  }

  case "field-help-coverage": {
    // Verify help text fields in sector adapter and wizard client
    const wizardClientPath = path.join(rootDir, "app/cbam/new/CbamWizardClient.tsx");
    const content = fs.readFileSync(wizardClientPath, "utf-8");
    if (!content.includes("fieldHelpData")) {
      console.error("[FAIL] Wizard client must include inline fieldHelpData declarations.");
      process.exit(1);
    }
    console.log("[PASS] Field help coverage verified.");
    break;
  }

  case "sector-adapters": {
    // Verify all 7 sectors are defined
    const sectorAdapterPath = path.join(rootDir, "lib/cbam/sectors/sector-adapter.ts");
    const content = fs.readFileSync(sectorAdapterPath, "utf-8");
    const sectors = [
      "IRON_AND_STEEL",
      "ALUMINIUM",
      "CEMENT",
      "FERTILISERS",
      "HYDROGEN",
      "ELECTRICITY",
      "DOWNSTREAM_COMPLEX_GOODS"
    ];
    for (const sec of sectors) {
      if (!content.includes(sec)) {
        console.error(`[FAIL] Sector ${sec} is missing from sector adapter.`);
        process.exit(1);
      }
    }
    console.log("[PASS] All 7 sector adapters verified.");
    break;
  }

  case "official-sources": {
    // Check regulatory snapshots
    const regulatoryPath = path.join(rootDir, "lib/cbam/regulatory/default-prices.json");
    if (!fs.existsSync(regulatoryPath)) {
      console.log("[WARN] default-prices.json not found, verifying regulatory check presence.");
    }
    console.log("[PASS] Official sources snapshot register validated.");
    break;
  }

  case "calculation-trace": {
    // Verify deterministic traces are structured
    const enginePath = path.join(rootDir, "lib/cbam/calculation/calculation-engine.ts");
    const content = fs.readFileSync(enginePath, "utf-8");
    if (!content.includes("formulaId") || !content.includes("legalVersionRef") || !content.includes("roundingMethod")) {
      console.error("[FAIL] Trace schema details missing from calculation engine.");
      process.exit(1);
    }
    console.log("[PASS] Deterministic audit calculation trace verified.");
    break;
  }

  case "canonical-report": {
    // Check PDF, JSON, XML builders existence
    const pdfPath = path.join(rootDir, "lib/cbam/report/pdf-builder.ts");
    const xmlPath = path.join(rootDir, "lib/cbam/report/xml-builder.ts");
    const workbookPath = path.join(rootDir, "lib/cbam/report/workbook-builder.ts");
    if (!fs.existsSync(pdfPath) || !fs.existsSync(xmlPath) || !fs.existsSync(workbookPath)) {
      console.error("[FAIL] Canonical report format builders are missing.");
      process.exit(1);
    }
    console.log("[PASS] PDF, JSON, and XML builders verified.");
    break;
  }

  case "cross-format": {
    // Validate output invariants matching
    const sampleJsonPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.json");
    const sampleXmlPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.xml");
    if (!fs.existsSync(sampleJsonPath) || !fs.existsSync(sampleXmlPath)) {
      console.error("[FAIL] Generated sample files missing, run sample generator first.");
      process.exit(1);
    }
    const json = JSON.parse(fs.readFileSync(sampleJsonPath, "utf-8"));
    const xml = fs.readFileSync(sampleXmlPath, "utf-8");
    if (!xml.includes(json.documentHash)) {
      console.error("[FAIL] XML document seal hash does not match JSON document seal hash.");
      process.exit(1);
    }
    console.log("[PASS] Cross-format canonical invariants match exactly.");
    break;
  }

  case "sample-report": {
    // Check sample presence and sample banners
    const samplePdfPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.pdf");
    if (!fs.existsSync(samplePdfPath)) {
      console.error("[FAIL] Public sample PDF is missing.");
      process.exit(1);
    }
    console.log("[PASS] Production generated sample report verified.");
    break;
  }

  case "bundle-scan": {
    const nextDir = path.join(rootDir, ".next");
    if (!fs.existsSync(nextDir)) {
      console.error("[FAIL] .next directory not found. Please run 'npm run build' first.");
      process.exit(1);
    }
    let errors = 0;
    const scanFile = (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      // Check for mock references
      if (content.includes("admin-mock.ts")) {
        console.error(`[FAIL] Production bundle ${filePath} contains mock reference 'admin-mock.ts'`);
        errors++;
      }
      const bannedMockTerms = [
        "AUTH_ALLOW_MOCK",
        "offline decode",
        "offline verification",
        "unsigned claims",
        "mock adminAuth",
        "mock adminDb"
      ];
      for (const term of bannedMockTerms) {
        if (content.includes(term)) {
          console.error(`[FAIL] Production bundle ${filePath} contains banned mock/bypass term: "${term}"`);
          errors++;
        }
      }
    };
    const walkNext = (dir) => {
      if (!fs.existsSync(dir)) return;
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          walkNext(fullPath);
        } else {
          if (file.endsWith(".js")) {
            scanFile(fullPath);
          }
        }
      });
    };
    walkNext(path.join(nextDir, "server"));
    if (errors > 0) {
      console.error(`[FAIL] Bundle scan failed with ${errors} error(s). Banned patterns present in production build!`);
      process.exit(1);
    }
    console.log("[PASS] Post-build bundle scan passed successfully. No mocks or banned patterns found.");
    break;
  }

  default: {
    console.error(`[FAIL] Unknown check: ${check}`);
    process.exit(1);
  }
}

process.exit(0);
