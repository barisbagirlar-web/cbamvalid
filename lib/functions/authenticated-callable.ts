import { FirebaseError } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type {
  HttpsCallable,
  HttpsCallableStreamOptions,
} from "firebase/functions";

export async function requireCallableAuthentication(
  auth: Auth,
  persistenceReady: Promise<void>
): Promise<User> {
  await persistenceReady;
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) {
    throw new FirebaseError(
      "functions/unauthenticated",
      "Your Firebase session is unavailable. Sign in again."
    );
  }

  // Ensures the Functions SDK auth provider has a current ID token before the
  // cross-origin callable request is created. Firebase refreshes expired tokens.
  await user.getIdToken();
  return user;
}

export function withCallableAuthentication<RequestData, ResponseData, StreamData = unknown>(
  auth: Auth,
  persistenceReady: Promise<void>,
  callable: HttpsCallable<RequestData, ResponseData, StreamData>
): HttpsCallable<RequestData, ResponseData, StreamData> {
  const invoke = async (data?: RequestData | null) => {
    await requireCallableAuthentication(auth, persistenceReady);
    return callable(data);
  };

  return Object.assign(invoke, {
    stream: async (
      data?: RequestData | null,
      options?: HttpsCallableStreamOptions
    ) => {
      await requireCallableAuthentication(auth, persistenceReady);
      return callable.stream(data, options);
    },
  });
}
