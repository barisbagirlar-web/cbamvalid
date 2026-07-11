"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signOutUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Set up the single unified auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
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
      await signOut(auth);
    } catch (err: any) {
      console.error("Firebase signOut error:", err);
    } finally {
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
