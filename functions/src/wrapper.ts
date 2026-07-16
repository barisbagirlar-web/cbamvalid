import { CallableRequest, HttpsError, onCall, CallableOptions } from "firebase-functions/v2/https";
import { z } from "zod";

export interface AuthenticatedCallableRequest<T = unknown> extends CallableRequest<T> {
  auth: NonNullable<CallableRequest<T>["auth"]>;
}

const SAFE_DOMAIN_CODES = new Set([
  "failed-precondition",
  "permission-denied",
  "not-found",
  "already-exists",
  "resource-exhausted",
  "aborted",
]);

function shouldEnforceAppCheck(): boolean {
  if (process.env.FUNCTIONS_EMULATOR === "true") return false;
  if (process.env.CBAM_ENFORCE_APP_CHECK === "false") return false;
  return true;
}

function domainHttpsError(error: unknown): HttpsError | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code !== "string" || !SAFE_DOMAIN_CODES.has(candidate.code)) return null;
  const message = typeof candidate.message === "string" && candidate.message.trim()
    ? candidate.message
    : "The requested operation could not be completed.";
  return new HttpsError(candidate.code as ConstructorParameters<typeof HttpsError>[0], message);
}

export function createCallable<T, Res>(
  options: CallableOptions & { schema?: z.ZodSchema<T> },
  handler: (data: T, context: AuthenticatedCallableRequest<T>) => Promise<Res>
) {
  return onCall<T>(
    {
      region: "europe-west1",
      enforceAppCheck: shouldEnforceAppCheck(),
      consumeAppCheckToken: true,
      cors: true,
      ...options,
    },
    async (request) => {
      try {
        if (!request.auth) {
          throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        let validatedData = request.data;
        if (options.schema) {
          const parseResult = options.schema.safeParse(request.data);
          if (!parseResult.success) {
            console.error("[CALLABLE VALIDATION ERROR]", {
              uid: request.auth.uid,
              issues: parseResult.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
            });
            throw new HttpsError("invalid-argument", "Invalid input data format.");
          }
          validatedData = parseResult.data;
        }

        const startTime = Date.now();
        console.log(`[CALLABLE START] uid=${request.auth.uid}`);
        const result = await handler(validatedData, request as AuthenticatedCallableRequest<T>);
        console.log(`[CALLABLE END] uid=${request.auth.uid} duration=${Date.now() - startTime}ms`);
        return result;
      } catch (error: unknown) {
        console.error(`[CALLABLE ERROR] uid=${request.auth?.uid || "unauthenticated"}`, error);
        if (error instanceof HttpsError) throw error;
        const mapped = domainHttpsError(error);
        if (mapped) throw mapped;
        throw new HttpsError("internal", "An internal error occurred.");
      }
    }
  );
}
