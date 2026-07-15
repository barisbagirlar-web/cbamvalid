import { CallableRequest, HttpsError, onCall, CallableOptions } from "firebase-functions/v2/https";
import { z } from "zod";

export interface AuthenticatedCallableRequest<T = unknown> extends CallableRequest<T> {
  auth: NonNullable<CallableRequest<T>["auth"]>;
}

function shouldEnforceAppCheck(): boolean {
  if (process.env.FUNCTIONS_EMULATOR === "true") return false;
  if (process.env.CBAM_ENFORCE_APP_CHECK === "false") return false;
  return true;
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
        const message = error instanceof Error ? error.message : "An internal error occurred.";
        throw new HttpsError("internal", message);
      }
    }
  );
}
