import "server-only";

import type { Bucket, File } from "@google-cloud/storage";
import type {
  DocumentReference,
  Firestore,
  Query,
} from "firebase-admin/firestore";
import {
  reconcileTeb232Cases,
  type Teb232ReconcileResult,
} from "./reconcile-teb232";

export const TEB232_LEGACY_EXTRA_CASE_ID =
  "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8";

const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";

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

async function discoverLegacyExtraState(
  db: Firestore,
  bucket: Bucket
): Promise<ExactState> {
  const state = createState();
  const caseId = TEB232_LEGACY_EXTRA_CASE_ID;
  await addDocument(state, db.collection("cbam_cases").doc(caseId));
  await addQuery(state, db.collection("cbam_cases").where("caseId", "==", caseId));
  await addQuery(state, db.collection("cbam_reports").where("caseId", "==", caseId));
  await addQuery(state, db.collection("document_seals").where("caseId", "==", caseId));
  await addQuery(state, db.collection("report_requests").where("caseId", "==", caseId));
  await addFiles(state, bucket, `evidence/${TEB232_UID}/${caseId}/`);

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
  const state = await discoverLegacyExtraState(params.db, params.bucket);
  if (state.documents.size === 0 && state.files.size === 0) {
    return reconcileTeb232Cases(params);
  }

  await capture(state);
  await remove(params.db, state);
  try {
    return await reconcileTeb232Cases(params);
  } catch (error) {
    await restore(params.db, params.bucket, state);
    throw error;
  }
}
