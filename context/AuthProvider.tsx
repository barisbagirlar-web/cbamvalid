"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";
import { CSRF_HEADER_NAME } from "@/lib/auth/session-constants";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOutUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Set up the single unified auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Auth state listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    try {
      // 1. Fetch CSRF token for DELETE request
      const csrfRes = await fetch("/api/auth/csrf", {
        method: "GET",
        credentials: "same-origin",
      });
      
      let csrfToken = "";
      if (csrfRes.ok) {
        const payload = await csrfRes.json();
        csrfToken = payload.csrfToken;
      }

      // 2. Clear the server session cookie
      await fetch("/api/auth/session", {
        method: "DELETE",
        headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {},
        credentials: "same-origin",
      });
    } catch (err) {
      console.error("Server session deletion error:", err);
    } finally {
      // 3. Clear client auth and redirect
      await signOut(auth);
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
