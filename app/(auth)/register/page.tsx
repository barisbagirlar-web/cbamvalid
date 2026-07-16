"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import { firebaseAuth as auth } from "@/lib/firebase/client";
import { finalizeServerSession } from "@/lib/auth/finalize-server-session";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-routing";
import { resolveSafeNextRoute } from "@/lib/auth/safe-next-route";

function verificationUrl(): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  const nextRoute = resolveSafeNextRoute(requested, "/cases/new");
  const url = new URL("/verify-email", window.location.origin);
  url.searchParams.set("next", nextRoute);
  return url.toString();
}

function authMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  if (code === "auth/email-already-in-use") return "This corporate email is already registered.";
  if (code === "auth/weak-password") return "Use a stronger password with at least 12 characters.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/popup-blocked") return "The sign-in popup was blocked. Allow popups for this site and retry.";
  if (code === "auth/popup-closed-by-user") return "The sign-in popup was closed before completion.";
  if (code === "auth/cancelled-popup-request") return "The sign-in request was cancelled. Retry once.";
  if (code === "auth/account-exists-with-different-credential") return "This email is linked to another sign-in method.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized for Google Sign-in.";
  return error instanceof Error && error.message
    ? error.message
    : "Registration could not be completed.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(credential.user, {
        url: verificationUrl(),
        handleCodeInApp: false,
      });
      const requested = new URLSearchParams(window.location.search).get("next");
      const nextRoute = resolveSafeNextRoute(requested, "/cases/new");
      window.location.replace(`/verify-email?next=${encodeURIComponent(nextRoute)}&sent=1`);
    } catch (registrationError: unknown) {
      console.error("Registration failed", registrationError);
      setError(authMessage(registrationError));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      await result.user.reload();
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user, {
          url: verificationUrl(),
          handleCodeInApp: false,
        });
        window.location.replace("/verify-email?sent=1");
        return;
      }
      await finalizeServerSession(result.user);
      window.location.replace(await resolvePostLoginRoute(result.user));
    } catch (signInError: unknown) {
      console.error("Google registration failed", signInError);
      setError(authMessage(signInError));
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image src="/cbam_logo.svg" alt="CBAMValid" width={196} height={48} priority className="mb-4 h-8 w-auto" />
          <h1 className="font-serif text-3xl text-foreground">Create Account</h1>
          <p className="mt-2 text-sm text-muted">Verified email is required before purchase or report sealing.</p>
        </div>

        <section className="rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)] sm:p-10">
          <form onSubmit={handleRegister} className="space-y-6">
            {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-center text-xs text-red-800">{error}</div>}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Corporate Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} autoComplete="email" className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none" placeholder="name@company.com" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} disabled={loading} autoComplete="new-password" className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none" />
              <p className="mt-1 text-xs text-muted">Minimum 12 characters.</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} disabled={loading} autoComplete="new-password" className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none" />
            </div>
            <button type="submit" disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account…</> : "Create Account and Verify Email"}
            </button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted">or</span></div></div>
          <button type="button" onClick={() => void handleGoogleSignIn()} disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong px-5 py-3 font-medium hover:bg-neutral-soft disabled:opacity-50">Continue with Google</button>
        </section>

        <div className="mt-8 text-center text-sm"><span className="text-muted">Already registered? </span><button type="button" onClick={() => router.push("/login")} className="font-bold hover:underline">Sign In</button></div>
      </div>
    </main>
  );
}
