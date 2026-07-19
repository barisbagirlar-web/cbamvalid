declare module "firebase-functions/v2/https" {
  export type FunctionsErrorCode =
    | "ok"
    | "cancelled"
    | "unknown"
    | "invalid-argument"
    | "deadline-exceeded"
    | "not-found"
    | "already-exists"
    | "permission-denied"
    | "resource-exhausted"
    | "failed-precondition"
    | "aborted"
    | "out-of-range"
    | "unimplemented"
    | "internal"
    | "unavailable"
    | "data-loss"
    | "unauthenticated";

  export class HttpsError extends Error {
    readonly code: FunctionsErrorCode;
    readonly details: unknown;
    constructor(code: FunctionsErrorCode, message: string, details?: unknown);
  }
}
