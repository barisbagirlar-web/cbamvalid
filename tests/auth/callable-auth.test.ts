import { FirebaseError } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { HttpsCallable } from "firebase/functions";
import { describe, expect, it, vi } from "vitest";
import {
  requireCallableAuthentication,
  withCallableAuthentication,
} from "@/lib/functions/authenticated-callable";

function authFixture(user: User | null) {
  return {
    currentUser: user,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  } as unknown as Auth;
}

describe("authenticated callable boundary", () => {
  it("waits for persistence and auth restoration before invoking a callable", async () => {
    const sequence: string[] = [];
    let releasePersistence: (() => void) | undefined;
    const persistenceReady = new Promise<void>((resolve) => {
      releasePersistence = () => {
        sequence.push("persistence");
        resolve();
      };
    });
    const user = {
      getIdToken: vi.fn().mockImplementation(async () => {
        sequence.push("token");
        return "id-token";
      }),
    } as unknown as User;
    const auth = authFixture(user);
    vi.mocked(auth.authStateReady).mockImplementation(async () => {
      sequence.push("auth-ready");
    });
    const callable = vi.fn().mockImplementation(async () => {
      sequence.push("callable");
      return { data: { cases: [] } };
    }) as unknown as HttpsCallable<void, { cases: unknown[] }>;
    callable.stream = vi.fn();
    const authenticated = withCallableAuthentication(auth, persistenceReady, callable);

    const pending = authenticated();
    expect(callable).not.toHaveBeenCalled();
    releasePersistence?.();
    await pending;

    expect(sequence).toEqual(["persistence", "auth-ready", "token", "callable"]);
  });

  it("fails closed before the network call when no Firebase user is restored", async () => {
    const auth = authFixture(null);
    const callable = vi.fn() as unknown as HttpsCallable<void, unknown>;
    callable.stream = vi.fn();
    const authenticated = withCallableAuthentication(
      auth,
      Promise.resolve(),
      callable
    );

    await expect(authenticated()).rejects.toMatchObject({
      code: "functions/unauthenticated",
    } satisfies Partial<FirebaseError>);
    expect(callable).not.toHaveBeenCalled();
  });

  it("obtains an ID token for an authenticated user", async () => {
    const user = {
      getIdToken: vi.fn().mockResolvedValue("id-token"),
    } as unknown as User;
    const auth = authFixture(user);

    await expect(
      requireCallableAuthentication(auth, Promise.resolve())
    ).resolves.toBe(user);
    expect(user.getIdToken).toHaveBeenCalledOnce();
  });
});
