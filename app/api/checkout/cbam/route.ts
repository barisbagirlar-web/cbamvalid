import { requireFirebaseSession, AuthError } from "@/lib/auth/require-firebase-session";
import { apiFailure } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retired compatibility endpoint.
 *
 * The only supported checkout path is the authenticated Firebase callable
 * createCheckoutSession, which creates a persisted case-bound order before
 * creating the Paddle transaction. Keeping this route fail-closed prevents a
 * second transaction channel from bypassing order reconciliation, case
 * binding and the five-version Preparation Pack contract.
 */
export async function POST(_request: Request) {
  try {
    await requireFirebaseSession();
  } catch (authError: unknown) {
    if (authError instanceof AuthError) {
      return apiFailure(authError.code, authError.message, authError.status);
    }
    console.error("[RETIRED CHECKOUT AUTH ERROR]", authError);
    return apiFailure("UNAUTHORIZED", "Session expired or authentication failed.", 401);
  }

  return apiFailure(
    "CHECKOUT_CHANNEL_RETIRED",
    "This checkout endpoint has been retired. Start the case-bound Preparation Pack checkout from /credits/buy.",
    410
  );
}
