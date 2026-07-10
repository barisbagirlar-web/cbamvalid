"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function SignOutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await logout();
      router.push("/login");
      router.refresh();
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
