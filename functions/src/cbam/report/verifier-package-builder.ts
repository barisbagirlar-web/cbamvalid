import crypto from "node:crypto";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import type { KmsSignatureResult } from "./kms-signature";
import { buildVerifierWorkbook } from "./xlsx-builder";
import { buildPdfDossier } from "./pdf-builder";

export const REQUIRED_TOP_LEVEL_COMPONENTS = [
  "Product and Scope Definition.pdf",
  "CN Code Classification.pdf",
  "Data Request Checklist.pdf",
  "Monitoring Plan Summary.pdf",
  "Process Map.pdf",
  "System Boundary.pdf",
  "Source Stream Register.csv",
  "Emission Source Register.csv",
  "Meter Register.csv",
  "Activity Data Ledger.csv",
  "Evidence Register.csv",
  "Field Evidence Matrix.csv",
  "Methodology Decision Log.pdf",
  "Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
  "Operator Summary Statement.pdf",
  "Verification Readiness Assessment.pdf",
  "Misstatement Register.csv",
  "Corrective Action Log.csv",
  "O3CI Field Mapping.csv",
  "Calculation Trace.json",
  "Data Integrity Manifest.json",
  "Manifest Signature.sig",
  "Units and Conversions Register.csv",
  "Carbon Price Register.csv",
  "Verifier Workspace.xlsx",
  "Supporting_Evidence/",
] as const;

export type EvidenceBinary = { evidenceId: string; fileName: string; bytes: Buffer };
export type PackageArtifact = { path: string; bytes: Buffer; mediaType: string };

type ManifestFile = { path: string; sha256: string; sizeBytes: number; mediaType: string };
export type DataIntegrityManifest = {
  schemaVersion: "CBAMVALID-DOSSIER-3.0";
  reportId: string;
  caseId: string;
  releaseVersion: number;
  generatedAt: string;
  ruleset: string;
  engineVersion: string;
  calculationRootHash: string;
  componentContract: { requiredTopLevelComponents: readonly string[]; requiredCount: 27 };
  files: ManifestFile[];
  evidenceCount: number;
  signatureScope: "EXACT_UTF8_BYTES_OF_THIS_MANIFEST";
};

function hash(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]): Buffer {
  return Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
}

function pdf(params: { title: string; generatedAt: string; reportId: string; sections: Array<{ heading: string; lines: string[] }> }): Buffer {
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  document.setCreationDate(new Date(params.generatedAt));
  document.setFileId(hash(Buffer.from(`${params.reportId}:${params.title}`)).slice(0, 32).toUpperCase());
  document.setProperties({
    title: params.title,
    author: "CBAMValid",
    creator: "CBAMValid Verifier Package Engine 3.0",
    subject: `Verifier-preparation component for ${params.reportId}`,
    keywords: "CBAM, verifier preparation, evidence, audit trail",
  });
  let page = 1;
  let y = 20;
  const header = () => {
    document.setFont("helvetica", "bold");
    document.setFontSize(15);
    document.text(params.title, 15, y);
    y += 7;
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text(`Report ${params.reportId} · Generated ${params.generatedAt}`, 15, y);
    y += 8;
  };
  const ensure = (height: number) => {
    if (y + height <= 275) return;
    document.setFontSize(8);
    document.text(`Page ${page}`, 180, 287);
    document.addPage();
    page += 1;
    y = 20;
    header();
  };
  header();
  for (const section of params.sections) {
    ensure(15);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(section.heading, 15, y);
    y += 6;
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    for (const line of section.lines) {
      const wrapped = document.splitTextToSize(line || "—", 178) as string[];
      ensure(wrapped.length * 4.5 + 2);
      document.text(wrapped, 15, y);
      y += wrapped.length * 4.5 + 1;
    }
    y += 3;
  }
  document.setFontSize(8);
  document.text(`Page ${page}`, 180, 287);
  return Buffer.from(document.output("arraybuffer"));
}

function artifact(path: string, bytes: Buffer, mediaType: string): PackageArtifact {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) throw new Error(`PACKAGE_PATH_INVALID:${path}`);
  return { path, bytes, mediaType };
}

function supportedEvidencePath(item: EvidenceBinary): string {
  const fileName = item.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || "evidence.bin";
  return `Supporting_Evidence/${item.evidenceId}/${fileName}`;
}

function buildPdfArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
}): PackageArtifact[] {
  const { caseData, calculation, controls, reportId, releaseVersion, generatedAt } = params;
  const pdfFile = (path: string, title: string, sections: Array<{ heading: string; lines: string[] }>) => artifact(path, pdf({ title, generatedAt, reportId, sections }), "application/pdf");
  const goods = calculation.goods.map((good) => `Good ${good.goodIndex}: CN ${good.cnCode}, ${good.sector}, ${good.productionVolume} t, share ${good.allocationShare}, ${good.specificEmbeddedEmissions} tCO2e/t`);
  const blockers = controls.filter((control) => control.status === "BLOCKER").map((control) => `${control.ruleId} — ${control.name}: ${control.message || "Blocked"}`);
  return [
    pdfFile("Product and Scope Definition.pdf", "Product and Scope Definition", [{ heading: "Case scope", lines: [`Case: ${caseData.caseId}`, `Reporting year: ${caseData.reportingPeriod.year.value}`, `Importer: ${caseData.importerIdentity.legalName.value}`, `Exporter/operator: ${caseData.exporterIdentity.legalName.value}`] }, { heading: "Goods", lines: goods }]),
    pdfFile("CN Code Classification.pdf", "CN Code Classification", [{ heading: "Classifications", lines: caseData.goods.map((good, index) => `Good ${index + 1}: CN ${good.cnCode.value}, sector ${good.sector}, evidence ${good.cnCode.evidenceId || "missing"}`) }]),
    pdfFile("Data Request Checklist.pdf", "Data Request Checklist", [{ heading: "Required records", lines: ["Corporate and EORI evidence", "Customs CN classification records", "Production ledger and allocation basis", "Direct emissions monitoring records", "Electricity and emission-factor evidence", "Precursor records or documented no-precursor decision", "Carbon-price proof where claimed"] }, { heading: "Current blockers", lines: blockers.length ? blockers : ["No unresolved blocker"] }]),
    pdfFile("Monitoring Plan Summary.pdf", "Monitoring Plan Summary", [{ heading: "Material inputs", lines: [`Direct emissions: ${caseData.directEmissions.value} ${caseData.directEmissions.canonicalUnit}`, `Electricity: ${caseData.electricityConsumed.value} ${caseData.electricityConsumed.canonicalUnit}`, `Grid factor: ${caseData.gridEmissionFactor.value} ${caseData.gridEmissionFactor.canonicalUnit}`] }, { heading: "Source types", lines: [`Direct: ${caseData.directEmissions.sourceType}`, `Electricity: ${caseData.electricityConsumed.sourceType}`, `Grid factor: ${caseData.gridEmissionFactor.sourceType}`] }]),
    pdfFile("Process Map.pdf", "Process Map", [{ heading: "Production route", lines: [String(caseData.installation.productionRoute.value || "—"), "Inputs → installation processes → embedded emissions attribution → goods allocation → verifier checks"] }, { heading: "Precursors", lines: caseData.precursors.length ? caseData.precursors.map((item, index) => `${index + 1}. ${item.name.value}, ${item.countryOfOrigin.value}, quantity ${item.quantity.value}`) : ["No precursor line recorded; refer to methodology decision log."] }]),
    pdfFile("System Boundary.pdf", "System Boundary", [{ heading: "Installation", lines: [`${caseData.installation.name.value}, ${caseData.installation.country.value}`] }, { heading: "Boundary statement", lines: [caseData.installation.systemBoundaries || "—"] }]),
    pdfFile("Methodology Decision Log.pdf", "Methodology Decision Log", [{ heading: "Decisions", lines: caseData.methodologyDecisions.length ? caseData.methodologyDecisions.map((item) => `${item.topic}: ${item.selectedMethod}. ${item.reason} Basis: ${item.legalOrTechnicalBasis}. Status: ${item.reviewStatus}.`) : ["No methodology decision recorded."] }]),
    pdfFile("Calculation Annex.pdf", "Calculation Annex", [{ heading: "Engine", lines: [`Ruleset: ${calculation.ruleset}`, `Engine: ${calculation.engineVersion}`, `Root hash: ${calculation.calculationRootHash}`] }, { heading: "Formula trace", lines: calculation.trace.map((item) => `${item.formulaId}: ${item.outputValue} ${item.outputUnit}; hash ${item.calculationHash}`) }]),
    artifact("Operator Emissions Report.pdf", buildPdfDossier(caseData, calculation as any, undefined, false, false), "application/pdf"),
    pdfFile("Operator Summary Statement.pdf", "Operator Summary Statement", [{ heading: "Statement", lines: [`Release ${releaseVersion} for case ${caseData.caseId}.`, `The dossier contains ${caseData.evidenceRegister.length} evidence records and ${caseData.methodologyDecisions.length} methodology decisions.`, `Calculation root hash: ${calculation.calculationRootHash}`] }]),
    pdfFile("Verification Readiness Assessment.pdf", "Verification Readiness Assessment", [{ heading: "Quality-control result", lines: controls.map((control) => `${control.ruleId}: ${control.status} — ${control.name}${control.message ? ` — ${control.message}` : ""}`) }, { heading: "Conclusion", lines: [blockers.length ? `${blockers.length} blocker(s) remain.` : "All applicable automated controls passed. Independent verifier judgment remains required."] }]),
  ];
}

function buildCsvArtifacts(params: { caseData: AuditReadyCase; calculation: DossierCalculationResult; controls: QualityControlResult[] }): PackageArtifact[] {
  const { caseData, calculation, controls } = params;
  return [
    artifact("Source Stream Register.csv", csv([["Stream ID", "Name", "Country", "Quantity", "Direct tCO2e", "Indirect tCO2e"], ...caseData.precursors.map((item, index) => [`P${index + 1}`, item.name.value, item.countryOfOrigin.value, item.quantity.value, item.directEmissions.value, item.indirectEmissions.value])]), "text/csv"),
    artifact("Emission Source Register.csv", csv([["Source", "Value", "Unit", "Source type", "Evidence ID"], ["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId], ["Electricity", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId], ["Grid factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId]]), "text/csv"),
    artifact("Meter Register.csv", csv([["Input", "Measurement method", "Document reference", "Responsible person"], ["Direct emissions", caseData.directEmissions.measurementMethod, caseData.directEmissions.documentReference, caseData.directEmissions.responsiblePerson], ["Electricity", caseData.electricityConsumed.measurementMethod, caseData.electricityConsumed.documentReference, caseData.electricityConsumed.responsiblePerson]]), "text/csv"),
    artifact("Activity Data Ledger.csv", csv([["Good", "CN", "Production t", "Allocation share", "Allocated tCO2e", "Specific tCO2e/t"], ...calculation.goods.map((good) => [good.goodIndex, good.cnCode, good.productionVolume, good.allocationShare, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions])]), "text/csv"),
    artifact("Evidence Register.csv", csv([["Evidence ID", "Type", "File", "Storage path", "Issuer", "Issue date", "SHA-256", "Bytes", "Review", "Support", "Malware"], ...caseData.evidenceRegister.map((item) => [item.evidenceId, item.documentType, item.fileName, item.storagePath, item.issuer, item.issueDate, item.fileHash, item.sizeBytes, item.reviewStatus, item.supportStatus, item.malwareScanStatus])]), "text/csv"),
    artifact("Field Evidence Matrix.csv", csv([["Evidence ID", "Linked input", "Linked calculations"], ...caseData.evidenceRegister.flatMap((item) => item.linkedInputs.map((input) => [item.evidenceId, input, item.linkedCalculations.join(" | ")]))]), "text/csv"),
    artifact("Misstatement Register.csv", csv([["Rule", "Issue", "Status", "Message"], ...controls.filter((item) => item.status !== "PASS" && item.status !== "NOT_APPLICABLE").map((item) => [item.ruleId, item.name, item.status, item.message])]), "text/csv"),
    artifact("Corrective Action Log.csv", csv([["Rule", "Remediation code", "Required action", "State"], ...controls.filter((item) => item.status === "BLOCKER").map((item) => [item.ruleId, item.remediationCode, item.message, "OPEN"])]), "text/csv"),
    artifact("O3CI Field Mapping.csv", csv([["Dossier field", "O3CI concept", "Value / reference"], ["caseId", "CASE_IDENTIFIER", caseData.caseId], ["reportingPeriod.year", "REPORTING_PERIOD", caseData.reportingPeriod.year.value], ["installation.name", "INSTALLATION", caseData.installation.name.value], ["goods[].cnCode", "GOODS_CLASSIFICATION", caseData.goods.map((item) => item.cnCode.value).join(" | ")], ["calculationRootHash", "CALCULATION_PROVENANCE", calculation.calculationRootHash]]), "text/csv"),
    artifact("Units and Conversions Register.csv", csv([["Field", "Raw unit", "Canonical unit", "Conversion"], ...caseData.goods.map((good, index) => [`goods.${index}.productionVolume`, good.productionVolume.rawUnit, good.productionVolume.canonicalUnit, good.productionVolume.rawUnit === "kg" ? "divide by 1000" : "identity"]), ["directEmissions", caseData.directEmissions.rawUnit, caseData.directEmissions.canonicalUnit, "identity"], ["electricityConsumed", caseData.electricityConsumed.rawUnit, caseData.electricityConsumed.canonicalUnit, "identity"], ["gridEmissionFactor", caseData.gridEmissionFactor.rawUnit, caseData.gridEmissionFactor.canonicalUnit, "identity"]]), "text/csv"),
    artifact("Carbon Price Register.csv", csv([["ID", "Amount paid", "Applicable emissions", "Currency", "Period", "Legislation", "Payment evidence", "Eligible reduction"], ...caseData.carbonPriceRecords.map((item) => [item.id, item.amountPaid, item.applicableEmissions, item.currency, item.paymentPeriod, item.legislationReference, item.proofOfPaymentEvidenceId, item.eligibleCertificateReduction])]), "text/csv"),
  ];
}

export async function buildUnsignedVerifierArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  evidenceFiles: EvidenceBinary[];
}): Promise<PackageArtifact[]> {
  const workbook = await buildVerifierWorkbook(params);
  const artifacts = [
    ...buildPdfArtifacts(params),
    ...buildCsvArtifacts(params),
    artifact("Calculation Trace.json", Buffer.from(canonical({ reportId: params.reportId, caseId: params.caseData.caseId, generatedAt: params.generatedAt, calculation: params.calculation }), "utf8"), "application/json"),
    artifact("Verifier Workspace.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    artifact("Supporting_Evidence/README.txt", Buffer.from("Evidence files are immutable copies verified against the Evidence Register and Data Integrity Manifest.\r\n", "utf8"), "text/plain"),
    ...params.evidenceFiles.map((item) => artifact(supportedEvidencePath(item), item.bytes, "application/octet-stream")),
  ];
  const paths = artifacts.map((item) => item.path);
  if (new Set(paths).size !== paths.length) throw new Error("PACKAGE_DUPLICATE_PATH");
  return artifacts;
}

export function buildDataIntegrityManifest(params: {
  artifacts: PackageArtifact[];
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  evidenceCount: number;
}): { manifest: DataIntegrityManifest; bytes: Buffer } {
  const manifest: DataIntegrityManifest = {
    schemaVersion: "CBAMVALID-DOSSIER-3.0",
    reportId: params.reportId,
    caseId: params.caseData.caseId || "",
    releaseVersion: params.releaseVersion,
    generatedAt: params.generatedAt,
    ruleset: params.calculation.ruleset,
    engineVersion: params.calculation.engineVersion,
    calculationRootHash: params.calculation.calculationRootHash,
    componentContract: { requiredTopLevelComponents: REQUIRED_TOP_LEVEL_COMPONENTS, requiredCount: 27 },
    files: params.artifacts.map((item) => ({ path: item.path, sha256: hash(item.bytes), sizeBytes: item.bytes.byteLength, mediaType: item.mediaType })).sort((left, right) => left.path.localeCompare(right.path)),
    evidenceCount: params.evidenceCount,
    signatureScope: "EXACT_UTF8_BYTES_OF_THIS_MANIFEST",
  };
  return { manifest, bytes: Buffer.from(canonical(manifest), "utf8") };
}

function topLevelComponents(paths: string[]): string[] {
  const components = new Set<string>();
  for (const path of paths) {
    const slash = path.indexOf("/");
    components.add(slash >= 0 ? `${path.slice(0, slash)}/` : path);
  }
  return [...components].sort();
}

export async function finalizeVerifierPackage(params: {
  artifacts: PackageArtifact[];
  manifestBytes: Buffer;
  signature: KmsSignatureResult;
  generatedAt: string;
}): Promise<{ zip: Buffer; zipHash: string; primaryPdf: Buffer; workbook: Buffer; signatureBytes: Buffer }> {
  if (hash(params.manifestBytes) !== params.signature.manifestHash) throw new Error("PACKAGE_MANIFEST_SIGNATURE_HASH_MISMATCH");
  const signatureBuffer = Buffer.from(canonical(params.signature), "utf8");
  if (!crypto.verify("sha256", params.manifestBytes, params.signature.publicKeyPem, Buffer.from(params.signature.signatureBase64, "base64"))) throw new Error("PACKAGE_SIGNATURE_VERIFICATION_FAILED");

  const allArtifacts = [
    ...params.artifacts,
    artifact("Data Integrity Manifest.json", params.manifestBytes, "application/json"),
    artifact("Manifest Signature.sig", signatureBuffer, "application/vnd.cbamvalid.kms-signature+json"),
  ];
  const topLevel = topLevelComponents(allArtifacts.map((item) => item.path));
  const expected = [...REQUIRED_TOP_LEVEL_COMPONENTS].sort();
  if (topLevel.length !== 27 || canonical(topLevel) !== canonical(expected)) {
    throw new Error(`PACKAGE_COMPONENT_CONTRACT_FAILED:${topLevel.join("|")}`);
  }

  const zip = new JSZip();
  const date = new Date(params.generatedAt);
  zip.folder("Supporting_Evidence");
  for (const item of allArtifacts) zip.file(item.path, item.bytes, { date, createFolders: true });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });

  const reopened = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const reopenedTopLevel = topLevelComponents(Object.keys(reopened.files).filter((path) => !reopened.files[path].dir || path === "Supporting_Evidence/"));
  if (canonical(reopenedTopLevel) !== canonical(expected)) throw new Error("PACKAGE_REOPEN_COMPONENT_CONTRACT_FAILED");
  const manifest = JSON.parse(params.manifestBytes.toString("utf8")) as DataIntegrityManifest;
  for (const file of manifest.files) {
    const entry = reopened.file(file.path);
    if (!entry) throw new Error(`PACKAGE_REOPEN_FILE_MISSING:${file.path}`);
    const bytes = await entry.async("nodebuffer");
    if (bytes.byteLength !== file.sizeBytes || hash(bytes) !== file.sha256) throw new Error(`PACKAGE_REOPEN_HASH_MISMATCH:${file.path}`);
  }
  const reopenedManifest = await reopened.file("Data Integrity Manifest.json")?.async("nodebuffer");
  const reopenedSignature = await reopened.file("Manifest Signature.sig")?.async("nodebuffer");
  if (!reopenedManifest || !reopenedSignature || !reopenedManifest.equals(params.manifestBytes) || !reopenedSignature.equals(signatureBuffer)) throw new Error("PACKAGE_REOPEN_TRUST_COMPONENT_MISMATCH");
  if (!crypto.verify("sha256", reopenedManifest, params.signature.publicKeyPem, Buffer.from(params.signature.signatureBase64, "base64"))) throw new Error("PACKAGE_REOPEN_SIGNATURE_INVALID");

  const primaryPdf = allArtifacts.find((item) => item.path === "Operator Emissions Report.pdf")?.bytes;
  const workbook = allArtifacts.find((item) => item.path === "Verifier Workspace.xlsx")?.bytes;
  if (!primaryPdf || !workbook) throw new Error("PACKAGE_PRIMARY_ARTIFACT_MISSING");
  return { zip: buffer, zipHash: hash(buffer), primaryPdf, workbook, signatureBytes: signatureBuffer };
}
