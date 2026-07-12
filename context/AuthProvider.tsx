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
        setUser(currentUser);
        setError(null);
        if (currentUser) {
          try {
            const tokenResult = await currentUser.getIdTokenResult();
            setClaims(tokenResult.claims);
            // Set __session cookie for Next.js Middleware
            const token = await currentUser.getIdToken();
            const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
            document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax${isSecure ? '; Secure' : ''}`;
          } catch (e) {
            console.error("Failed to fetch claims:", e);
            setClaims(null);
            document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          }
        } else {
          setClaims(null);
          document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
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
      await signOut(auth);
      document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
