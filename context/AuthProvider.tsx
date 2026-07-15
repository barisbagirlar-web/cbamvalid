"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  clearServerSessionMarker,
  ensureServerSession,
} from "@/lib/auth/finalize-server-session";

export type AuthClaims = Readonly<Record<string, unknown>>;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  claims: AuthClaims | null;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  claims: null,
  signOutUser: async () => undefined,
});

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Authentication state could not be established.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (currentUser) => {
        if (!active) return;
        if (!currentUser) {
          setUser(null);
          setClaims(null);
          setError(null);
          setLoading(false);
          return;
        }

        try {
          await ensureServerSession(currentUser);
          const tokenResult = await currentUser.getIdTokenResult();
          if (!active) return;
          setClaims(tokenResult.claims as AuthClaims);
          setUser(currentUser);
          setError(null);
        } catch (sessionError: unknown) {
          const normalized = asError(sessionError);
          console.error("Failed to establish authenticated client/server session", normalized);
          clearServerSessionMarker();
          setClaims(null);
          setUser(null);
          setError(normalized);
          await signOut(firebaseAuth).catch((signOutError: unknown) => {
            console.error("Failed to clear client authentication after session failure", signOutError);
          });
        } finally {
          if (active) setLoading(false);
        }
      },
      (listenerError) => {
        if (!active) return;
        setUser(null);
        setClaims(null);
        setError(listenerError);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signOutUser = async () => {
    clearServerSessionMarker();
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) console.error("Server session deletion failed", response.status);
    } finally {
      await signOut(firebaseAuth).catch((signOutError: unknown) => {
        console.error("Firebase sign-out failed", signOutError);
      });
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, claims, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
