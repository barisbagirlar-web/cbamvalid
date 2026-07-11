"use client";

import React from "react";
import { useAuth } from "@/context/AuthProvider";

export default function SignOutButton() {
  const { signOutUser } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-kil-text/60 hover:text-kil-text border border-kil-border hover:bg-kil-card/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
    >
      Sign Out
    </button>
  );
}
