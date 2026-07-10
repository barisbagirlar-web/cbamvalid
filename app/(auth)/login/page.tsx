/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";
import { finalizeServerSession } from "@/lib/auth/create-server-session";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await finalizeServerSession(credential.user);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to start your session. Check your details and try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      const result = await signInWithPopup(auth, provider);
      await finalizeServerSession(result.user);
    } catch (err: any) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please enable popups for this site.");
      } else if (code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completion. Please try again.");
      } else if (code === "auth/cancelled-popup-request") {
        setError("Sign-in request was cancelled. Please try again.");
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with a different credential linked to this email.");
      } else {
        setError(err?.message || "Unable to start Google sign-in.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 font-sans">
      <div className="w-full max-w-md animate-in fade-in">
        {/* LOGO / BAŞLIK */}
        <div className="mb-12 text-center flex flex-col items-center">
          <img src="/cbam_logo.svg" alt="CBAM Valid Logo" className="h-8 w-auto object-contain mb-4" />
          <h1 className="font-serif text-3xl text-foreground mb-3 tracking-tight">CBAM Portal</h1>
          <p className="text-sm font-mono text-muted">Authorized Exporter Portal</p>
        </div>

        {/* FORM KARTI */}
        <div className="bg-surface border border-border rounded-xl p-10 shadow-[var(--shadow-card)]">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-3 border border-border bg-accent-soft text-accent text-xs font-mono text-center rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Corporate Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-45 mt-4 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Sign In to Portal"
              )}
            </button>
          </form>

          {/* DIVIDER & GOOGLE BUTTON */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-muted font-mono">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-5 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft disabled:opacity-45 cursor-pointer"
          >
            {/* GOOGLE LOGO INLINE BRANDING RULES */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign In with Google
          </button>
        </div>

        {/* ALT LİNKLER */}
        <div className="mt-8 text-center text-sm font-semibold">
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="text-muted hover:text-foreground transition-colors border-b border-transparent hover:border-foreground pb-0.5 cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
