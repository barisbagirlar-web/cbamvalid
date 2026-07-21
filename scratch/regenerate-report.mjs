import crypto from "node:crypto";
import { createRequire } from "module";
const requireFn = createRequire(import.meta.url);
const requireFunc = createRequire(requireFn.resolve("../functions/package.json"));
const { initializeApp, getApps } = requireFunc("firebase-admin/app");
const { getFirestore } = requireFunc("firebase-admin/firestore");
const { getStorage } = requireFunc("firebase-admin/storage");
import { CommercialReportPipelineV2 } from "../functions/build/cbam/report/commercial-report-pipeline-v2.js";
import { performDossierCalculations } from "../functions/build/cbam/calculator.js";
import { runQualityControls } from "../functions/build/cbam/validation/quality-controls.js";
import { signManifestWithKms } from "../functions/build/cbam/report/kms-signature.js";

// Setup environment variables
process.env.GCLOUD_PROJECT = "cbam-desk";
process.env.CBAM_KMS_KEY_VERSION = "projects/cbam-desk/locations/europe-west1/keyRings/cbam/cryptoKeys/signing/cryptoKeyVersions/1";

if (getApps().length === 0) {
  initializeApp({
    projectId: "cbam-desk",
    storageBucket: "cbam-desk.firebasestorage.app",
  });
}

const db = getFirestore();
const bucket = getStorage().bucket();

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

async function loadEvidenceFiles(caseData) {
  const files = [];
  for (const evidence of caseData.evidenceRegister) {
    const object = bucket.file(evidence.storagePath);
    const [bytes] = await object.download();
    if (bytes.byteLength !== evidence.sizeBytes || sha256(bytes) !== evidence.fileHash.toLowerCase()) {
      throw new Error(`EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
    }
    files.push({ evidenceId: evidence.evidenceId, fileName: evidence.fileName, bytes });
  }
  return files;
}

async function commitImmutableArtifact({ path, bytes, contentType, metadata }) {
  const file = bucket.file(path);
  await file.save(bytes, {
    contentType,
    metadata: {
      metadata,
    },
  });
  return {
    path,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
  };
}

async function run() {
  const reportId = "report_23f400da8b1f70f43494011ced5ea987a36553dd9410607601178cfd70f5cd80";
  console.log(`Loading report document: ${reportId}`);
  const reportDoc = await db.collection("cbam_reports").doc(reportId).get();
  if (!reportDoc.exists) {
    throw new Error("Report not found!");
  }
  const reportData = reportDoc.data();
  console.log(`Report data loaded. uid=${reportData.uid}, caseId=${reportData.caseId}`);

  console.log(`Loading case document: ${reportData.caseId}`);
  const caseDoc = await db.collection("cbam_cases").doc(reportData.caseId).get();
  if (!caseDoc.exists) {
    throw new Error("Case not found!");
  }
  const caseData = caseDoc.data().data; // Nesting contains the AuditReadyCase fields
  caseData.caseId = reportData.caseId;
  caseData.ownerId = reportData.uid;

  console.log("Loading evidence files...");
  const evidenceFiles = await loadEvidenceFiles(caseData);
  console.log(`Loaded ${evidenceFiles.length} evidence files.`);

  console.log("Running dossier calculations...");
  const calculation = performDossierCalculations(caseData);
  console.log(`Calculation complete. Root hash: ${calculation.calculationRootHash}`);

  console.log("Running quality controls...");
  const controls = runQualityControls(caseData);
  console.log(`Quality controls completed. Result count: ${controls.length}`);

  console.log("Executing V2 sealing pipeline...");
  const { artifacts, manifestBytes, signature, packageResult } = await CommercialReportPipelineV2.executeSealingPipeline({
    caseData,
    calculation,
    controls,
    reportId,
    releaseVersion: reportData.releaseVersion,
    generatedAt: reportData.createdAt, // use original creation time
    evidenceFiles,
    productCode: "pack_premium_dossier_v5",
    releaseContractVersion: 5,
    signManifest: async (bytes) => {
      console.log("Signing manifest JSON with Cloud KMS...");
      const sig = await signManifestWithKms(bytes);
      console.log(`Manifest signed successfully. Signature base64 prefix: ${sig.signatureBase64.substring(0, 10)}`);
      return sig;
    }
  });

  console.log("Sealing pipeline execution succeeded! Committing files to GCS...");
  const manifest = { bytes: manifestBytes, manifest: JSON.parse(manifestBytes.toString("utf8")) };
  const basePath = `reports/${reportData.uid}/${reportId}`;
  const commonMetadata = { reportId, caseId: reportData.caseId, requestId: reportData.requestId || "" };

  const storageEntries = await Promise.all([
    commitImmutableArtifact({ path: `${basePath}/dossier.zip`, bytes: packageResult.zip, contentType: "application/zip", metadata: commonMetadata }),
    commitImmutableArtifact({ path: `${basePath}/dossier.pdf`, bytes: packageResult.primaryPdf, contentType: "application/pdf", metadata: commonMetadata }),
    commitImmutableArtifact({ path: `${basePath}/dossier.xlsx`, bytes: packageResult.workbook, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", metadata: commonMetadata }),
    commitImmutableArtifact({ path: `${basePath}/manifest.json`, bytes: manifest.bytes, contentType: "application/json", metadata: commonMetadata }),
    commitImmutableArtifact({ path: `${basePath}/manifest.sig`, bytes: packageResult.signatureBytes, contentType: "application/vnd.cbamvalid.kms-signature+json", metadata: commonMetadata }),
    commitImmutableArtifact({ path: `${basePath}/case-snapshot.json`, bytes: Buffer.from(canonical(caseData), "utf8"), contentType: "application/json", metadata: commonMetadata }),
  ]);

  if (packageResult.zipHash !== storageEntries[0].sha256) {
    throw new Error("PACKAGE_RECEIPT_HASH_MISMATCH");
  }

  const primaryDossier = artifacts.find(a => a.path === "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf");
  const operatorEmissionsReport = artifacts.find(a => a.path === "Operator Emissions Report.pdf");
  const technicalCompilation = artifacts.find(a => a.path === "Complete Dossier Compilation.pdf");
  
  const primaryDossierHash = primaryDossier ? sha256(primaryDossier.bytes) : "";
  const operatorEmissionsReportHash = operatorEmissionsReport ? sha256(operatorEmissionsReport.bytes) : "";
  const technicalCompilationHash = technicalCompilation ? sha256(technicalCompilation.bytes) : "";

  console.log("GCS files uploaded. Updating Firestore document...");
  const updatedFields = {
    documentHash: primaryDossierHash,
    manifestHash: signature.manifestHash,
    packageHash: packageResult.zipHash,
    primaryDossierHash,
    operatorEmissionsReportHash,
    technicalCompilationHash,
    kmsKeyVersion: signature.keyVersion,
    kmsAlgorithm: signature.algorithm,
    signatureBase64: signature.signatureBase64,
    storage: {
      "dossier.zip": {
        path: storageEntries[0].path,
        sha256: storageEntries[0].sha256,
        sizeBytes: storageEntries[0].sizeBytes,
      },
      "dossier.pdf": {
        path: storageEntries[1].path,
        sha256: storageEntries[1].sha256,
        sizeBytes: storageEntries[1].sizeBytes,
      },
      "dossier.xlsx": {
        path: storageEntries[2].path,
        sha256: storageEntries[2].sha256,
        sizeBytes: storageEntries[2].sizeBytes,
      },
      "manifest.json": {
        path: storageEntries[3].path,
        sha256: storageEntries[3].sha256,
        sizeBytes: storageEntries[3].sizeBytes,
      },
      "manifest.sig": {
        path: storageEntries[4].path,
        sha256: storageEntries[4].sha256,
        sizeBytes: storageEntries[4].sizeBytes,
      },
      "case-snapshot.json": {
        path: storageEntries[5].path,
        sha256: storageEntries[5].sha256,
        sizeBytes: storageEntries[5].sizeBytes,
      },
    },
    packageMetadata: {
      totalFiles: artifacts.length + 2,
      manifestFileCount: manifest.manifest.files.length,
      evidenceFileCount: evidenceFiles.length,
    },
    updatedAt: new Date().toISOString(),
  };

  await db.collection("cbam_reports").doc(reportId).update(updatedFields);
  console.log("Firestore document updated successfully!");
}

run().catch(console.error);
