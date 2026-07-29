import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createBlankCaseDraft } from "../lib/cbam/new-case";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "cbam-desk";
const REGION = process.env.FIREBASE_REGION || "europe-west1";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
const FUNCTIONS_BASE_URL =
  process.env.FUNCTIONS_BASE_URL ||
  `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

if (!API_KEY) {
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY_REQUIRED");
}
if (PROJECT_ID !== "cbam-desk") {
  throw new Error("LIVE_TENANT_SMOKE_PROJECT_NOT_ALLOWED");
}

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const userAUid = `test-tenant-a-${runId}`;
const userBUid = `test-tenant-b-${runId}`;
const createdUsers: string[] = [];
const createdObjects: string[] = [];
const createdDocuments: Array<{ collection: string; id: string }> = [];

type CallableResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; status: string; message: string };

async function exchangeCustomToken(uid: string): Promise<string> {
  const customToken = await auth.createCustomToken(uid, { testOnly: true });
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(API_KEY!)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = await response.json() as { idToken?: string; error?: { message?: string } };
  if (!response.ok || !body.idToken) {
    throw new Error(`CUSTOM_TOKEN_EXCHANGE_FAILED:${body.error?.message || response.status}`);
  }
  return body.idToken;
}

async function callFunction(
  name: string,
  idToken: string,
  data: Record<string, unknown>
): Promise<CallableResult> {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json() as {
    result?: Record<string, unknown>;
    data?: Record<string, unknown>;
    error?: { status?: string; message?: string };
  };
  if (body.error) {
    return {
      ok: false,
      status: body.error.status || `HTTP_${response.status}`,
      message: body.error.message || "CALLABLE_ERROR",
    };
  }
  const result = body.result || body.data;
  if (!response.ok || !result) {
    throw new Error(`CALLABLE_PROTOCOL_INVALID:${name}:${response.status}`);
  }
  return { ok: true, result };
}

function requireSuccess(result: CallableResult, operation: string): Record<string, unknown> {
  if (!result.ok) {
    throw new Error(`${operation}_FAILED:${result.status}:${result.message}`);
  }
  return result.result;
}

function requireDenied(result: CallableResult, operation: string): void {
  if (result.ok) throw new Error(`${operation}_UNEXPECTEDLY_ALLOWED`);
  if (!["NOT_FOUND", "PERMISSION_DENIED"].includes(result.status)) {
    throw new Error(`${operation}_WRONG_DENIAL:${result.status}:${result.message}`);
  }
}

async function waitForScan(
  token: string,
  caseId: string,
  evidenceId: string,
  expectedStatus: "CLEAN" | "INFECTED"
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const result = requireSuccess(
      await callFunction("getCbamCase", token, { caseId }),
      "OWNER_POLL_EVIDENCE_SCAN"
    );
    const view = result.case as Record<string, unknown>;
    const evidence = (view.evidenceRegister as Array<Record<string, unknown>>)
      .find((entry) => entry.evidenceId === evidenceId);
    if (evidence?.malwareScanStatus === expectedStatus) {
      const receipt = evidence.malwareScanReceipt as Record<string, unknown> | undefined;
      if (
        receipt?.status !== expectedStatus ||
        receipt.sourceSha256 !== evidence.fileHash ||
        !Number.isSafeInteger(receipt.sourceGeneration)
      ) {
        throw new Error("LIVE_MALWARE_SCAN_RECEIPT_INVALID");
      }
      return receipt;
    }
    if (
      evidence?.malwareScanStatus === "CLEAN" ||
      evidence?.malwareScanStatus === "INFECTED"
    ) {
      throw new Error("LIVE_MALWARE_SCAN_UNEXPECTED_STATUS");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("LIVE_MALWARE_SCAN_TIMEOUT");
}

async function createTestUser(uid: string): Promise<string> {
  await auth.createUser({
    uid,
    email: `${uid}@example.invalid`,
    emailVerified: true,
    disabled: false,
  });
  createdUsers.push(uid);
  return exchangeCustomToken(uid);
}

async function cleanup(): Promise<void> {
  await Promise.allSettled(
    createdObjects.map((path) => bucket.file(path).delete({ ignoreNotFound: true }))
  );
  await Promise.allSettled(
    createdDocuments.map(({ collection, id }) => db.collection(collection).doc(id).delete())
  );
  await Promise.allSettled(createdUsers.map((uid) => auth.deleteUser(uid)));
}

async function main(): Promise<void> {
  const tokenA = await createTestUser(userAUid);
  const tokenB = await createTestUser(userBUid);

  const requestId = crypto.randomUUID();
  const createResult = requireSuccess(
    await callFunction("saveCbamCase", tokenA, {
      requestId,
      data: createBlankCaseDraft(userAUid, {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
    }),
    "CREATE_CASE_A"
  );
  const caseId = String(createResult.caseId || "");
  if (!caseId) throw new Error("CREATE_CASE_A_ID_MISSING");
  createdDocuments.push({ collection: "cbam_cases", id: caseId });
  createdDocuments.push({
    collection: "case_creation_requests",
    id: crypto.createHash("sha256").update(`${userAUid}\u0000${requestId}`).digest("hex"),
  });

  const getA = requireSuccess(
    await callFunction("getCbamCase", tokenA, { caseId }),
    "OWNER_GET_CASE"
  );
  const caseView = getA.case as Record<string, unknown>;
  const initialRevision = Number(caseView.revision);
  requireDenied(
    await callFunction("getCbamCase", tokenB, { caseId }),
    "CROSS_TENANT_GET_CASE"
  );

  const evidenceId = crypto.randomUUID();
  const evidenceBytes = Buffer.from(`CBAMValid tenant isolation smoke ${runId}`, "utf8");
  const evidenceHash = crypto.createHash("sha256").update(evidenceBytes).digest("hex");
  const evidencePath = `evidence/${userAUid}/${caseId}/${evidenceId}/tenant-smoke.txt`;
  await bucket.file(evidencePath).save(evidenceBytes, {
    resumable: false,
    contentType: "text/plain",
    metadata: {
      metadata: {
        ownerId: userAUid,
        caseId,
        evidenceId,
        sha256: evidenceHash,
        testOnly: "true",
      },
    },
  });
  createdObjects.push(evidencePath);
  const [evidenceMetadata] = await bucket.file(evidencePath).getMetadata();
  const evidenceGeneration = Number(evidenceMetadata.generation);
  if (!Number.isSafeInteger(evidenceGeneration) || evidenceGeneration <= 0) {
    throw new Error("LIVE_EVIDENCE_GENERATION_INVALID");
  }

  const caseData = { ...caseView };
  delete caseData.revision;
  delete caseData.updatedAt;
  caseData.evidenceRegister = [
    ...((caseData.evidenceRegister as unknown[]) || []),
    {
      evidenceId,
      documentType: "TEST_ONLY_TENANT_ISOLATION",
      fileName: "tenant-smoke.txt",
      storagePath: evidencePath,
      mimeType: "text/plain",
      sizeBytes: evidenceBytes.byteLength,
      issuer: "CBAMValid automated security smoke",
      issueDate: new Date().toISOString().slice(0, 10),
      reportingPeriod: "2026",
      fileHash: evidenceHash,
      objectGeneration: evidenceGeneration,
      uploadTimestamp: new Date().toISOString(),
      uploader: userAUid,
      reviewStatus: "PENDING",
      supportStatus: "PENDING",
      malwareScanStatus: "PENDING",
      confidentiality: "INTERNAL",
      linkedInputs: ["directEmissions"],
      linkedCalculations: [],
    },
  ];
  requireSuccess(
    await callFunction("saveCbamCase", tokenA, {
      caseId,
      expectedRevision: initialRevision,
      data: caseData,
    }),
    "OWNER_REGISTER_EVIDENCE"
  );
  await waitForScan(tokenA, caseId, evidenceId, "CLEAN");

  const afterClean = requireSuccess(
    await callFunction("getCbamCase", tokenA, { caseId }),
    "OWNER_GET_CASE_AFTER_CLEAN_SCAN"
  ).case as Record<string, unknown>;
  const infectedEvidenceId = crypto.randomUUID();
  const eicarBytes = Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    "utf8"
  );
  const eicarHash = crypto.createHash("sha256").update(eicarBytes).digest("hex");
  const eicarPath =
    `evidence/${userAUid}/${caseId}/${infectedEvidenceId}/eicar-test.txt`;
  await bucket.file(eicarPath).save(eicarBytes, {
    resumable: false,
    contentType: "text/plain",
    metadata: {
      metadata: {
        ownerId: userAUid,
        caseId,
        evidenceId: infectedEvidenceId,
        sha256: eicarHash,
        testOnly: "true",
      },
    },
  });
  createdObjects.push(eicarPath);
  const [eicarMetadata] = await bucket.file(eicarPath).getMetadata();
  const eicarGeneration = Number(eicarMetadata.generation);
  if (!Number.isSafeInteger(eicarGeneration) || eicarGeneration <= 0) {
    throw new Error("LIVE_EICAR_GENERATION_INVALID");
  }
  const afterCleanData = { ...afterClean };
  delete afterCleanData.revision;
  delete afterCleanData.updatedAt;
  afterCleanData.evidenceRegister = [
    ...((afterCleanData.evidenceRegister as unknown[]) || []),
    {
      evidenceId: infectedEvidenceId,
      documentType: "TEST_ONLY_EICAR",
      fileName: "eicar-test.txt",
      storagePath: eicarPath,
      mimeType: "text/plain",
      sizeBytes: eicarBytes.byteLength,
      issuer: "EICAR anti-malware test fixture",
      issueDate: new Date().toISOString().slice(0, 10),
      reportingPeriod: "2026",
      fileHash: eicarHash,
      objectGeneration: eicarGeneration,
      uploadTimestamp: new Date().toISOString(),
      uploader: userAUid,
      reviewStatus: "PENDING",
      supportStatus: "PENDING",
      malwareScanStatus: "PENDING",
      confidentiality: "INTERNAL",
      linkedInputs: ["malwareScannerValidation"],
      linkedCalculations: [],
    },
  ];
  requireSuccess(
    await callFunction("saveCbamCase", tokenA, {
      caseId,
      expectedRevision: afterClean.revision,
      data: afterCleanData,
    }),
    "OWNER_REGISTER_EICAR"
  );
  const infectedReceipt = await waitForScan(
    tokenA,
    caseId,
    infectedEvidenceId,
    "INFECTED"
  );
  let infectedSourceExists = true;
  const sourceDeleteDeadline = Date.now() + 30_000;
  while (infectedSourceExists && Date.now() < sourceDeleteDeadline) {
    [infectedSourceExists] = await bucket.file(eicarPath).exists();
    if (infectedSourceExists) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (infectedSourceExists) throw new Error("LIVE_EICAR_SOURCE_NOT_DELETED");
  const quarantineBucketName = String(infectedReceipt.quarantineBucket || "");
  const quarantineObjectName = String(infectedReceipt.quarantineObject || "");
  const quarantineGeneration = Number(infectedReceipt.quarantineGeneration);
  if (
    !quarantineBucketName ||
    !quarantineObjectName ||
    !Number.isSafeInteger(quarantineGeneration) ||
    quarantineGeneration <= 0
  ) {
    throw new Error("LIVE_EICAR_QUARANTINE_RECEIPT_INVALID");
  }
  const quarantineObject = getStorage(app)
    .bucket(quarantineBucketName)
    .file(quarantineObjectName, { generation: quarantineGeneration });
  const [quarantineExists] = await quarantineObject.exists();
  if (!quarantineExists) throw new Error("LIVE_EICAR_QUARANTINE_OBJECT_MISSING");
  await quarantineObject.delete({ ifGenerationMatch: quarantineGeneration });

  requireDenied(
    await callFunction("reviewCbamEvidence", tokenB, {
      caseId,
      evidenceId,
      decision: "REJECTED",
      supportStatus: "UNSUPPORTED",
      reviewerNotes: "Cross-tenant mutation attempt must be denied.",
    }),
    "CROSS_TENANT_REVIEW_EVIDENCE"
  );
  requireDenied(
    await callFunction("deleteCbamEvidence", tokenB, {
      caseId,
      evidenceId,
      reason: "Cross-tenant delete attempt must be denied.",
    }),
    "CROSS_TENANT_DELETE_EVIDENCE"
  );

  const objectUrl =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
    `/o/${encodeURIComponent(evidencePath)}?alt=media`;
  const ownerRead = await fetch(objectUrl, {
    headers: { authorization: `Bearer ${tokenA}` },
  });
  if (ownerRead.status !== 200) {
    throw new Error(`OWNER_STORAGE_READ_FAILED:${ownerRead.status}`);
  }
  const crossTenantRead = await fetch(objectUrl, {
    headers: { authorization: `Bearer ${tokenB}` },
  });
  if (![401, 403, 404].includes(crossTenantRead.status)) {
    throw new Error(`CROSS_TENANT_STORAGE_READ_ALLOWED:${crossTenantRead.status}`);
  }

  const reportId = `report_${crypto.createHash("sha256").update(`report:${runId}`).digest("hex")}`;
  const reportBytes = Buffer.from(`TEST_ONLY immutable report ${runId}`, "utf8");
  const reportHash = crypto.createHash("sha256").update(reportBytes).digest("hex");
  const reportPath = `reports/${userAUid}/${reportId}/dossier.zip`;
  await bucket.file(reportPath).save(reportBytes, {
    resumable: false,
    contentType: "application/zip",
    metadata: { metadata: { sha256: reportHash, testOnly: "true" } },
  });
  createdObjects.push(reportPath);
  await db.collection("cbam_reports").doc(reportId).set({
    reportId,
    uid: userAUid,
    caseId,
    entitlementId: `test-only-${runId}`,
    requestId: crypto.randomUUID(),
    releaseVersion: 1,
    documentHash: reportHash,
    manifestHash: reportHash,
    packageHash: reportHash,
    status: "SEALED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    calculation: {
      goods: [],
      totalDirectEmissions: "0",
      totalIndirectEmissions: "0",
      totalPrecursorEmissions: "0",
      totalEmbeddedEmissions: "0",
      productionVolume: "0",
      specificEmbeddedEmissions: "0",
      eligibleCertificateReduction: "0",
      allocationShareTotal: "0",
      allocationReconciliationDelta: "0",
      calculationRootHash: reportHash,
      ruleset: "TEST_ONLY",
      engineVersion: "TEST_ONLY",
    },
    caseDataHash: reportHash,
    rulesetVersion: "TEST_ONLY",
    sourceHash: reportHash,
    kmsKeyVersion: "TEST_ONLY_SECURITY_BOUNDARY",
    kmsAlgorithm: "RSA_SIGN_PKCS1_4096_SHA256",
    signatureBase64: Buffer.from(reportHash).toString("base64"),
    storage: {
      "dossier.zip": {
        path: reportPath,
        sha256: reportHash,
        sizeBytes: reportBytes.byteLength,
      },
    },
    testOnly: true,
  });
  createdDocuments.push({ collection: "cbam_reports", id: reportId });

  requireSuccess(
    await callFunction("getCbamReport", tokenA, { reportId }),
    "OWNER_GET_REPORT"
  );
  requireDenied(
    await callFunction("getCbamReport", tokenB, { reportId }),
    "CROSS_TENANT_GET_REPORT"
  );
  requireDenied(
    await callFunction("getReportDownloadUrl", tokenB, { reportId, format: "zip" }),
    "CROSS_TENANT_DOWNLOAD_REPORT"
  );

  const unchanged = requireSuccess(
    await callFunction("getCbamCase", tokenA, { caseId }),
    "OWNER_VERIFY_CASE_UNCHANGED"
  ).case as Record<string, unknown>;
  const evidence = (unchanged.evidenceRegister as Array<Record<string, unknown>>)
    .find((entry) => entry.evidenceId === evidenceId);
  if (!evidence || evidence.reviewStatus !== "PENDING") {
    throw new Error("CROSS_TENANT_ATTEMPT_MUTATED_EVIDENCE");
  }

  console.log(JSON.stringify({
    status: "PASS",
    projectId: PROJECT_ID,
    caseDenied: true,
    malwareScanClean: true,
    malwareScanEicarQuarantined: true,
    evidenceMutationDenied: true,
    storageReadDenied: true,
    reportReadDenied: true,
    reportDownloadDenied: true,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(cleanup);
