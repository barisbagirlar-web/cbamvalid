import "server-only";

import type { Bucket, File } from "@google-cloud/storage";
import type {
  DocumentReference,
  Firestore,
  Query,
} from "firebase-admin/firestore";
import { FOUR_DOSSIER_KEYS } from "../../../tests/fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_OLD_CASE_IDS,
  TEB232_UID,
  teb232CaseId,
} from "../../../scripts/refresh-teb232-four-complete-cases";
import {
  prepareAllTeb232DraftCasesForSeal,
} from "./prepare-teb232-drafts-for-seal";
import {
  reconcileTeb232Cases,
  type Teb232ReconcileResult,
} from "./reconcile-teb232";

export const TEB232_LEGACY_EXTRA_CASE_ID =
  "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8";

type DocumentBackup = {
  path: string;
  data: Record<string, unknown>;
};
type FileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};
type ExactState = {
  documents: Map<string, DocumentReference>;
  files: Map<string, File>;
  documentBackups: DocumentBackup[];
  fileBackups: FileBackup[];
};

function assertIdentity(params: {
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
}): void {
  if (
    params.authenticatedUid !== TEB232_UID ||
    params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL ||
    params.emailVerified !== true
  ) {
    throw new Error("TEB232_RECONCILE_IDENTITY_REFUSED");
  }
}

function createState(): ExactState {
  return {
    documents: new Map(),
    files: new Map(),
    documentBackups: [],
    fileBackups: [],
  };
}

async function addDocument(
  state: ExactState,
  reference: DocumentReference
): Promise<void> {
  const snapshot = await reference.get();
  if (snapshot.exists) state.documents.set(reference.path, reference);
}

async function addQuery(state: ExactState, query: Query): Promise<void> {
  const snapshot = await query.get();
  for (const document of snapshot.docs) {
    state.documents.set(document.ref.path, document.ref);
  }
}

async function addFiles(
  state: ExactState,
  bucket: Bucket,
  prefix: string
): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) state.files.set(file.name, file);
}

async function discoverCaseState(
  db: Firestore,
  bucket: Bucket,
  caseIds: readonly string[]
): Promise<ExactState> {
  const state = createState();

  for (const caseId of caseIds) {
    await addDocument(state, db.collection("cbam_cases").doc(caseId));
    await addQuery(state, db.collection("cbam_cases").where("caseId", "==", caseId));
    await addQuery(state, db.collection("cbam_reports").where("caseId", "==", caseId));
    await addQuery(state, db.collection("document_seals").where("caseId", "==", caseId));
    await addQuery(state, db.collection("report_requests").where("caseId", "==", caseId));
    await addFiles(state, bucket, `evidence/${TEB232_UID}/${caseId}/`);
  }

  const reports = [...state.documents.values()].filter(
    (reference) => reference.parent.id === "cbam_reports"
  );
  for (const reportReference of reports) {
    const snapshot = await reportReference.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() || {};
    const reportId = String(data.reportId || reportReference.id);
    const documentHash = String(data.documentHash || "");
    const packageCode = String(data.packageCode || "");
    await addDocument(state, db.collection("seal_log").doc(reportId));
    await addDocument(state, db.collection("seal_outbox").doc(reportId));
    if (documentHash) {
      await addDocument(state, db.collection("document_seals").doc(documentHash));
    }
    if (packageCode) {
      await addDocument(state, db.collection("package_codes").doc(packageCode));
    }
    await addFiles(state, bucket, `reports/${TEB232_UID}/${reportId}/`);
  }
  return state;
}

async function discoverUserDraftCaseIds(db: Firestore): Promise<string[]> {
  const canonical = new Set(FOUR_DOSSIER_KEYS.map(teb232CaseId));
  const excluded = new Set([
    ...TEB232_OLD_CASE_IDS,
    TEB232_LEGACY_EXTRA_CASE_ID,
    ...canonical,
  ]);
  const snapshot = await db
    .collection("cbam_cases")
    .where("uid", "==", TEB232_UID)
    .get();

  return snapshot.docs
    .map((document) => {
      const data = document.data() || {};
      return {
        caseId: String(data.caseId || document.id),
        status: String(data.status || "DRAFT").toUpperCase(),
      };
    })
    .filter(
      ({ caseId, status }) => status === "DRAFT" && !excluded.has(caseId)
    )
    .map(({ caseId }) => caseId);
}

async function capture(state: ExactState): Promise<void> {
  for (const reference of state.documents.values()) {
    const snapshot = await reference.get();
    const data = snapshot.data();
    if (snapshot.exists && data) {
      state.documentBackups.push({
        path: reference.path,
        data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
      });
    }
  }
  for (const file of state.files.values()) {
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    state.fileBackups.push({
      name: file.name,
      bytes,
      contentType: metadata.contentType,
      metadata: (metadata.metadata || {}) as Record<string, string>,
    });
  }
}

async function remove(db: Firestore, state: ExactState): Promise<void> {
  for (const file of state.files.values()) {
    await file.delete({ ignoreNotFound: true });
  }
  const references = [...state.documents.values()];
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = db.batch();
    for (const reference of references.slice(offset, offset + 400)) {
      batch.delete(reference);
    }
    await batch.commit();
  }
}

async function restore(
  db: Firestore,
  bucket: Bucket,
  state: ExactState
): Promise<void> {
  for (const item of state.fileBackups) {
    await bucket.file(item.name).save(item.bytes, {
      resumable: false,
      contentType: item.contentType,
      metadata: { metadata: item.metadata || {} },
    });
  }
  for (let offset = 0; offset < state.documentBackups.length; offset += 400) {
    const batch = db.batch();
    for (const item of state.documentBackups.slice(offset, offset + 400)) {
      batch.set(db.doc(item.path), item.data);
    }
    await batch.commit();
  }
}

export async function reconcileTeb232LiveCases(params: {
  db: Firestore;
  bucket: Bucket;
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
}): Promise<Teb232ReconcileResult> {
  assertIdentity(params);

  const userDraftCaseIds = await discoverUserDraftCaseIds(params.db);
  const userDraftState = await discoverCaseState(
    params.db,
    params.bucket,
    userDraftCaseIds
  );
  const legacyState = await discoverCaseState(
    params.db,
    params.bucket,
    [TEB232_LEGACY_EXTRA_CASE_ID]
  );

  await capture(userDraftState);
  await capture(legacyState);

  // The historical canonical reconciler intentionally operates on an exact
  // four-case set. Temporarily isolate user-created Teb232 drafts so canonical
  // repair cannot delete or reject them; restore them byte-for-byte afterwards.
  await remove(params.db, userDraftState);
  await remove(params.db, legacyState);

  let canonical: Teb232ReconcileResult;
  try {
    canonical = await reconcileTeb232Cases(params);
  } catch (error) {
    await restore(params.db, params.bucket, userDraftState);
    await restore(params.db, params.bucket, legacyState);
    throw error;
  }

  // User-created test drafts are preserved, then upgraded independently to a
  // complete controlled scenario. The one obsolete legacy extra remains removed.
  await restore(params.db, params.bucket, userDraftState);

  const draftPreparation = await prepareAllTeb232DraftCasesForSeal({
    authenticatedUid: params.authenticatedUid,
    authenticatedEmail: params.authenticatedEmail,
    emailVerified: params.emailVerified,
  });

  return {
    ...canonical,
    changed:
      canonical.changed ||
      legacyState.documents.size > 0 ||
      legacyState.files.size > 0 ||
      draftPreparation.changed,
  };
}
