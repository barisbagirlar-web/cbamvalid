"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  claims: Record<string, any> | null;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  claims: null,
  signOutUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [claims, setClaims] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    // Set up the single unified auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (currentUser) {
          try {
            const tokenResult = await currentUser.getIdTokenResult();
            setClaims(tokenResult.claims);
            
            // Only exchange token if it was authenticated recently (within 5 minutes)
            // and has not already been established via finalizeServerSession.
            const authTimeMs = Date.parse(tokenResult.authTime);
            const nowMs = Date.now();
            const isFresh = nowMs - authTimeMs < 5 * 60 * 1000;
            const alreadyEstablished = typeof window !== "undefined" && (window as any).__sessionEstablished;
            
            if (isFresh && !alreadyEstablished) {
              const token = await currentUser.getIdToken(true);
              await fetch("/api/auth/session", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({ idToken: token }),
              });
            }
          } catch (e) {
            console.error("Failed to establish auth session:", e);
            setClaims(null);
          }
        } else {
          setClaims(null);
        }
        setUser(currentUser);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Auth state listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    try {
      if (typeof window !== "undefined") {
        delete (window as any).__sessionEstablished;
      }
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
    } catch (err: any) {
      console.error("Firebase signOut error:", err);
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
