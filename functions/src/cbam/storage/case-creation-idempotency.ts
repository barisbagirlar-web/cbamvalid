import { createHash } from "node:crypto";
import { createCanonicalCaseId } from "../case-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CaseCreationIdentity = {
  uid: string;
  requestId: string;
  digest: string;
  caseId: string;
};

export type CaseCreationMarker = {
  uid: string;
  requestId: string;
  caseId: string;
  createdAt: string;
};

export type CaseCreationDecision = "CREATE" | "RETURN_EXISTING";

export function deriveCaseCreationIdentity(uid: string, requestId: string): CaseCreationIdentity {
  const normalizedUid = uid.trim();
  const normalizedRequestId = requestId.trim();
  if (!normalizedUid) throw new Error("CASE_OWNER_ID_REQUIRED");
  if (!UUID_PATTERN.test(normalizedRequestId)) {
    throw new Error("CASE_CREATION_REQUEST_ID_INVALID");
  }

  const digest = createHash("sha256")
    .update(`${normalizedUid}\u0000${normalizedRequestId}`)
    .digest("hex");
  return {
    uid: normalizedUid,
    requestId: normalizedRequestId,
    digest,
    caseId: createCanonicalCaseId(digest),
  };
}

export function parseCaseCreationMarker(data: unknown): CaseCreationMarker {
  if (!data || typeof data !== "object") throw new Error("CASE_CREATION_MARKER_INVALID");
  const source = data as Partial<CaseCreationMarker>;
  if (
    typeof source.uid !== "string" ||
    typeof source.requestId !== "string" ||
    typeof source.caseId !== "string" ||
    typeof source.createdAt !== "string"
  ) {
    throw new Error("CASE_CREATION_MARKER_INVALID");
  }
  return {
    uid: source.uid,
    requestId: source.requestId,
    caseId: createCanonicalCaseId(source.caseId),
    createdAt: source.createdAt,
  };
}

export function decideCaseCreationState(params: {
  identity: CaseCreationIdentity;
  marker: CaseCreationMarker | null;
  caseExists: boolean;
}): CaseCreationDecision {
  const { identity, marker, caseExists } = params;

  if (marker) {
    if (
      marker.uid !== identity.uid ||
      marker.requestId !== identity.requestId ||
      marker.caseId !== identity.caseId
    ) {
      throw new Error("CASE_CREATION_IDEMPOTENCY_COLLISION");
    }
    if (!caseExists) throw new Error("CASE_CREATION_IDEMPOTENCY_BROKEN");
    return "RETURN_EXISTING";
  }

  if (caseExists) throw new Error("CASE_CREATION_IDEMPOTENCY_BROKEN");
  return "CREATE";
}
