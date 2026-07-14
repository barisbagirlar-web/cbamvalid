#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requireReady = process.argv.includes('--require-ready');
const reportPath = resolve(root, 'release_report.md');
const evidencePath = resolve(root, 'docs/release/sales-readiness-evidence.json');

const shaPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

const requiredGateNames = [
  'authoritativeCaseServerLoad',
  'clientIsVerifiedAbsent',
  'approvedEvidenceRequired',
  'evidenceByteHashVerification',
  'tenantIsolationFirestore',
  'tenantIsolationStorage',
  'fiveReleaseConcurrency',
  'sixthReleaseDenied',
  'sixIndependentSectorEngines',
  'rulesetFailClosed',
  'immutableStorageCreateOnly',
  'storageReadbackHash',
  'immutableRedownload',
  'manifestSignatureVerification',
  'zip27ComponentContract',
  'pdfVisualQa',
  'realXlsxValidation',
  'verifierWorkspace',
  'fullBrowserE2e',
  'deployedShaEqualsRepositoryHead',
  'paddleCredentialsRotated'
];

const requiredArtifactIds = [
  'authoritative-case-server-load',
  'client-isverified-absent',
  'approved-evidence-required',
  'evidence-byte-hash-verification',
  'tenant-isolation-firestore',
  'tenant-isolation-storage',
  'five-release-concurrency',
  'sixth-release-denial',
  'six-independent-sector-engines',
  'ruleset-fail-closed',
  'immutable-storage-create-only',
  'storage-readback-hash',
  'immutable-redownload',
  'manifest-signature-verification',
  'zip-27-component-contract',
  'pdf-visual-qa',
  'real-xlsx-validation',
  'verifier-workspace',
  'full-browser-e2e',
  'production-runtime-logs',
  'live-build-sha',
  'paddle-credential-rotation'
];

function fail(messages) {
  console.error('SALES_READINESS_GUARD=FAIL');
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

let report;
let evidence;

try {
  report = await readFile(reportPath, 'utf8');
} catch (error) {
  fail([`Cannot read ${reportPath}: ${error instanceof Error ? error.message : String(error)}`]);
}

try {
  evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
} catch (error) {
  fail([`Cannot read or parse ${evidencePath}: ${error instanceof Error ? error.message : String(error)}`]);
}

const errors = [];
const reportClaimsReady = /(?:PRODUCTION_SALES_READY|SALES_READY)=YES/.test(report);
const evidenceClaimsReady = evidence?.salesReady === true;
const readinessClaimed = reportClaimsReady || evidenceClaimsReady || requireReady;

if (evidence?.schemaVersion !== 1) errors.push('Unsupported or missing evidence schemaVersion.');
if (!isIsoDate(evidence?.generatedAt)) errors.push('generatedAt must be an exact ISO-8601 timestamp.');
if (!shaPattern.test(evidence?.startingSha ?? '')) errors.push('startingSha must be a 40-character lowercase Git SHA.');

if (!readinessClaimed) {
  if (evidence?.salesReady !== false) errors.push('Fail-closed evidence must set salesReady=false when readiness is not proven.');
  if (!/PRODUCTION_SALES_READY=NO/.test(report)) errors.push('release_report.md must explicitly declare PRODUCTION_SALES_READY=NO.');
  if (!/RELEASE_CLOSE_ALLOWED=NO/.test(report)) errors.push('release_report.md must explicitly declare RELEASE_CLOSE_ALLOWED=NO.');

  if (errors.length > 0) fail(errors);

  console.log('SALES_READINESS_GUARD=PASS');
  console.log('PRODUCTION_SALES_READY=NO');
  console.log('MODE=FAIL_CLOSED_NO_FALSE_CLAIM');
  process.exit(0);
}

if (!shaPattern.test(evidence?.finalSha ?? '')) errors.push('finalSha is missing or invalid.');
if (!shaPattern.test(evidence?.deployedSha ?? '')) errors.push('deployedSha is missing or invalid.');
if (evidence?.finalSha !== evidence?.deployedSha) errors.push('finalSha and deployedSha do not match.');
if (evidence?.workingTreeClean !== true) errors.push('workingTreeClean must be true.');
if (evidence?.productionRuntimeErrors !== 0) errors.push('productionRuntimeErrors must equal 0.');

const counts = evidence?.counts ?? {};
if (counts.requirementMatrixOpen !== 0) errors.push('requirementMatrixOpen must equal 0.');
if (counts.productionTodoPlaceholder !== 0) errors.push('productionTodoPlaceholder must equal 0.');
if (counts.unsafeCoreAny !== 0) errors.push('unsafeCoreAny must equal 0.');
if (counts.zipComponents !== 27) errors.push('zipComponents must equal 27.');
if (counts.failedSealConsumption !== 0) errors.push('failedSealConsumption must equal 0.');

for (const gateName of requiredGateNames) {
  if (evidence?.gates?.[gateName] !== true) errors.push(`Mandatory gate ${gateName} is not true.`);
}

if (evidence?.salesReady !== true) errors.push('salesReady must be true for a readiness claim.');

const artifacts = Array.isArray(evidence?.evidenceArtifacts) ? evidence.evidenceArtifacts : [];
const artifactById = new Map(artifacts.map((artifact) => [artifact?.id, artifact]));

for (const artifactId of requiredArtifactIds) {
  const artifact = artifactById.get(artifactId);
  if (!artifact) {
    errors.push(`Missing evidence artifact ${artifactId}.`);
    continue;
  }

  if (typeof artifact.path !== 'string' || artifact.path.trim() === '') {
    errors.push(`Evidence artifact ${artifactId} has no path.`);
  }
  if (!sha256Pattern.test(artifact.sha256 ?? '')) {
    errors.push(`Evidence artifact ${artifactId} has no valid SHA-256.`);
  }
  if (typeof artifact.command !== 'string' || artifact.command.trim() === '') {
    errors.push(`Evidence artifact ${artifactId} has no executable command.`);
  }
  if (artifact.exitCode !== 0) {
    errors.push(`Evidence artifact ${artifactId} did not record exitCode=0.`);
  }
  if (!isIsoDate(artifact.verifiedAt)) {
    errors.push(`Evidence artifact ${artifactId} has no valid verifiedAt timestamp.`);
  }
}

if (!reportClaimsReady) errors.push('Final evidence claims readiness but release_report.md does not declare PRODUCTION_SALES_READY=YES.');

if (errors.length > 0) fail(errors);

console.log('SALES_READINESS_GUARD=PASS');
console.log('PRODUCTION_SALES_READY=YES');
console.log(`FINAL_SHA=${evidence.finalSha}`);
console.log(`DEPLOYED_SHA=${evidence.deployedSha}`);
