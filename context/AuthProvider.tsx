"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { type User, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  claims: Record<string, unknown> | null;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  claims: null,
  signOutUser: async () => undefined,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        try {
          if (!currentUser) {
            setUser(null);
            setClaims(null);
            setError(null);
            return;
          }

          await currentUser.reload();
          const refreshedUser = auth.currentUser || currentUser;
          const tokenResult = await refreshedUser.getIdTokenResult(true);
          setUser(refreshedUser);
          setClaims(tokenResult.claims as Record<string, unknown>);
          setError(null);

          if (!refreshedUser.emailVerified) {
            await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
            if (typeof window !== "undefined") {
              delete (window as Window & { __sessionEstablished?: boolean }).__sessionEstablished;
            }
            return;
          }

          const authTimeMs = Date.parse(tokenResult.authTime);
          const isFresh = Number.isFinite(authTimeMs) && Date.now() - authTimeMs < 5 * 60 * 1000;
          const alreadyEstablished = typeof window !== "undefined" &&
            (window as Window & { __sessionEstablished?: boolean }).__sessionEstablished === true;
          if (isFresh && !alreadyEstablished) {
            const token = await refreshedUser.getIdToken(true);
            const response = await fetch("/api/auth/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ idToken: token }),
            });
            if (!response.ok) throw new Error("Failed to establish server session.");
            (window as Window & { __sessionEstablished?: boolean }).__sessionEstablished = true;
          }
        } catch (listenerError: unknown) {
          const normalized = listenerError instanceof Error
            ? listenerError
            : new Error("Authentication state could not be established.");
          console.error("Failed to establish auth session", normalized);
          setClaims(null);
          setError(normalized);
        } finally {
          setLoading(false);
        }
      },
      (listenerError) => {
        console.error("Auth state listener error", listenerError);
        setError(listenerError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    try {
      if (typeof window !== "undefined") {
        delete (window as Window & { __sessionEstablished?: boolean }).__sessionEstablished;
      }
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
    } catch (signOutError: unknown) {
      console.error("Firebase signOut error", signOutError);
    } finally {
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, claims, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
