import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local values manually
const envFile = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found");
  process.exit(1);
}

const b64 = match[1];
const serviceAccountString = Buffer.from(b64, "base64").toString("utf8");

// Write to a temporary file
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

// Set environment variables before any firebase imports
process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

// Import firebase-admin
import admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

if (admin.apps.length === 0) {
  initializeApp();
}

async function run() {
  const bucket = getStorage().bucket("cbam-desk.firebasestorage.app");
  const uid = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
  const reportId = "report_4a94bcf5519a6294ac4e0973c4368bf137c8d89d9e8d3fa52cfff336c494daa6";
  const filePath = `reports/${uid}/${reportId}/dossier.pdf`;

  console.log(`Downloading ${filePath}...`);
  const file = bucket.file(filePath);
  
  const destPath = path.resolve(__dirname, "../../public/sample/cbam-exporter-final-evidence-report-sample.pdf");
  await file.download({ destination: destPath });
  console.log(`Successfully downloaded PDF to ${destPath}`);

  // Calculate local sha256 to print
  const pdfBytes = fs.readFileSync(destPath);
  const hash = crypto.createHash("sha256").update(pdfBytes).digest("hex");
  console.log(`Local SHA-256: ${hash}`);
}

run()
  .catch(console.error)
  .finally(() => {
    try {
      fs.unlinkSync(tempKeyPath);
    } catch (e) {}
  });
