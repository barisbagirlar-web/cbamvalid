import { CallableRequest, HttpsError, onCall, CallableOptions } from "firebase-functions/v2/https";
import { z } from "zod";

export interface AuthenticatedCallableRequest<T = any> extends CallableRequest<T> {
  auth: NonNullable<CallableRequest<T>["auth"]>;
}

export function createCallable<T, Res>(
  options: CallableOptions & { schema?: z.ZodSchema<T> },
  handler: (data: T, context: AuthenticatedCallableRequest<T>) => Promise<Res>
) {
  return onCall<T>(
    {
      region: "europe-west1",
      enforceAppCheck: true,
      ...options,
    },
    async (request) => {
      try {
        // 1. App Check validation (handled natively by enforceAppCheck: true, but we can verify it's not strictly null if we wanted, though enforceAppCheck is better)
        if (!request.app && options.enforceAppCheck !== false) {
          throw new HttpsError("unauthenticated", "App Check token is missing or invalid.");
        }

        // 2. Auth extraction
        if (!request.auth) {
          throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        // 3. Input validation
        let validatedData = request.data;
        if (options.schema) {
          const parseResult = options.schema.safeParse(request.data);
          if (!parseResult.success) {
            console.error("Validation error:", parseResult.error);
            throw new HttpsError("invalid-argument", "Invalid input data format.");
          }
          validatedData = parseResult.data;
        }

        // 4. Execution with correlation logging
        const startTime = Date.now();
        console.log(`[CALLABLE START] uid=${request.auth.uid}`);
        
        const result = await handler(validatedData, request as AuthenticatedCallableRequest<T>);
        
        console.log(`[CALLABLE END] uid=${request.auth.uid} duration=${Date.now() - startTime}ms`);
        return result;

      } catch (error: any) {
        console.error(`[CALLABLE ERROR] uid=${request.auth?.uid}`, error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError("internal", error.message || "An internal error occurred.");
      }
    }
  );
}
