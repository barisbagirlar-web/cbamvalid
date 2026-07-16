"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import { firebaseAuth as auth } from "@/lib/firebase/client";
import { finalizeServerSession } from "@/lib/auth/finalize-server-session";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-routing";
import { resolveSafeNextRoute } from "@/lib/auth/safe-next-route";

function authMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email or password is incorrect.";
  }
  if (code === "auth/too-many-requests") return "Too many sign-in attempts. Wait and retry.";
  if (code === "auth/popup-blocked") return "The sign-in popup was blocked. Allow popups and retry.";
  if (code === "auth/popup-closed-by-user") return "The sign-in popup was closed before completion.";
  if (code === "auth/cancelled-popup-request") return "The sign-in request was cancelled.";
  if (code === "auth/account-exists-with-different-credential") return "This email is linked to another sign-in method.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized for Google Sign-in.";
  return error instanceof Error && error.message ? error.message : "Unable to start your session.";
}

function verificationReturnUrl(nextRoute: string): string {
  const url = new URL("/verify-email", window.location.origin);
  url.searchParams.set("next", nextRoute);
  return url.toString();
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestedRoute = () => resolveSafeNextRoute(
    new URLSearchParams(window.location.search).get("next"),
    "/cbam"
  );

  const routeVerifiedUser = async (user: import("firebase/auth").User) => {
    await user.reload();
    if (!user.emailVerified) {
      const nextRoute = requestedRoute();
      await sendEmailVerification(user, {
        url: verificationReturnUrl(nextRoute),
        handleCodeInApp: false,
      }).catch((verificationError: unknown) => {
        console.error("Verification resend during login failed", verificationError);
      });
      window.location.replace(`/verify-email?next=${encodeURIComponent(nextRoute)}`);
      return;
    }
    await finalizeServerSession(user);
    window.location.replace(await resolvePostLoginRoute(user));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await routeVerifiedUser(credential.user);
    } catch (signInError: unknown) {
      console.error("Email sign-in failed", signInError);
      setError(authMessage(signInError));
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
      await routeVerifiedUser(result.user);
    } catch (signInError: unknown) {
      console.error("Google sign-in failed", signInError);
      setError(authMessage(signInError));
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image src="/cbam_logo.svg" alt="CBAMValid" width={196} height={48} priority className="mb-4 h-8 w-auto" />
          <h1 className="font-serif text-3xl text-foreground">CBAM Portal</h1>
          <p className="mt-2 text-sm text-muted">Verified exporter account access</p>
        </div>

        <section className="rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)] sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-center text-xs text-red-800">{error}</div>}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Corporate Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} autoComplete="email" className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none" placeholder="name@company.com" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} autoComplete="current-password" className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none" />
            </div>
            <button type="submit" disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</> : "Sign In"}
            </button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted">or</span></div></div>
          <button type="button" onClick={() => void handleGoogleSignIn()} disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong px-5 py-3 font-medium hover:bg-neutral-soft disabled:opacity-50">Continue with Google</button>
        </section>

        <div className="mt-8 text-center text-sm"><button type="button" onClick={() => router.push("/register")} className="font-bold hover:underline">Create Account</button></div>
      </div>
    </main>
  );
}
