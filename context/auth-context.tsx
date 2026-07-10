"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signOut, onIdTokenChanged } from "firebase/auth";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebaseAuth } from "@/lib/firebase/client";
import { createServerSession } from "@/lib/auth/create-server-session";

const auth = firebaseAuth;
const db = getFirestore(firebaseAuth.app);

// Google Translate veya harici eklentilerin DOM'u bozup React'i çökertmesini (removeChild/insertBefore hataları) engellemek için monkey-patch
if (typeof window !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Node.prototype as any).removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn("removeChild: Child node was not a child of this node, bypassing to prevent React crash.");
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Node.prototype as any).insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn("insertBefore: Reference node was not a child of this node, bypassing to prevent React crash.");
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

interface UserData {
  email: string;
  tokens: number;
  role: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onIdTokenChanged(auth, async (currentUser) => {
      // Clean up any previous document listener to prevent leaks
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      setUser(currentUser);
      
      if (!currentUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      // Dynamically sync the HttpOnly session cookie on token changes/refreshes
      try {
        await createServerSession(currentUser);
      } catch (err) {
        console.error("Failed to sync session cookie in background:", err);
      }

      // Sync Firestore user doc data in real-time (tokens, role, email)
      const userDocRef = doc(db, "users", currentUser.uid);
      unsubscribeDoc = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          } else {
            // Document might not exist yet if user just registered, wait for it
            setUserData(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching user data from Firestore:", error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
