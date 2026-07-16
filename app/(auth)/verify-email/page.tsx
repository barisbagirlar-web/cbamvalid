"use client";

import { useEffect, useMemo, useState } from "react";
import { reload, sendEmailVerification, signOut } from "firebase/auth";
import { CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { firebaseAuth } from "@/lib/firebase/client";
import { finalizeServerSession } from "@/lib/auth/finalize-server-session";
import { resolveSafeNextRoute } from "@/lib/auth/safe-next-route";

const RESEND_COOLDOWN_SECONDS = 60;

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Email verification could not be completed.";
}

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const nextRoute = useMemo(() => {
    if (typeof window === "undefined") return "/cbam";
    return resolveSafeNextRoute(new URLSearchParams(window.location.search).get("next"), "/cbam");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.replace(`/login?next=${encodeURIComponent(nextRoute)}`);
      return;
    }
    if (user.emailVerified) {
      void finalizeServerSession(user)
        .then(() => window.location.replace(nextRoute))
        .catch((sessionError: unknown) => setError(errorMessage(sessionError)));
    }
  }, [loading, nextRoute, user]);

  const checkVerification = async () => {
    if (!user || checking) return;
    setChecking(true);
    setError("");
    setStatus("");
    try {
      await reload(user);
      const refreshedUser = firebaseAuth.currentUser;
      if (!refreshedUser?.emailVerified) {
        setStatus("Verification is not visible yet. Complete the email link, then check again.");
        return;
      }
      await refreshedUser.getIdToken(true);
      await finalizeServerSession(refreshedUser);
      window.location.replace(nextRoute);
    } catch (verificationError: unknown) {
      setError(errorMessage(verificationError));
    } finally {
      setChecking(false);
    }
  };

  const resendVerification = async () => {
    if (!user || resending || cooldown > 0) return;
    setResending(true);
    setError("");
    setStatus("");
    try {
      const url = new URL("/verify-email", window.location.origin);
      url.searchParams.set("next", nextRoute);
      await sendEmailVerification(user, { url: url.toString(), handleCodeInApp: false });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStatus("A new verification email was sent. Check your inbox and spam folder.");
    } catch (resendError: unknown) {
      setError(errorMessage(resendError));
    } finally {
      setResending(false);
    }
  };

  const changeAccount = async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    await signOut(firebaseAuth);
    window.location.replace(`/login?next=${encodeURIComponent(nextRoute)}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)] sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent"><Mail className="h-7 w-7" /></div>
        <h1 className="mt-6 font-serif text-3xl font-bold">Verify Your Email</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">A verified email is required before purchasing a Preparation Pack or sealing a report.</p>
        <p className="mt-4 rounded-md border border-border bg-neutral-soft p-3 font-mono text-sm">{user?.email || "Loading account…"}</p>

        {status && <div role="status" className="mt-5 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-left text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{status}</div>}
        {error && <div role="alert" className="mt-5 rounded-md border border-red-300 bg-red-50 p-3 text-left text-sm text-red-800">{error}</div>}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void checkVerification()} disabled={!user || loading || checking} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Check Verification</button>
          <button type="button" onClick={() => void resendVerification()} disabled={!user || loading || resending || cooldown > 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong px-4 font-semibold hover:bg-neutral-soft disabled:opacity-50">{resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Email"}</button>
        </div>

        <button type="button" onClick={() => void changeAccount()} className="mt-6 text-sm font-semibold text-muted underline underline-offset-4 hover:text-foreground">Use a different account</button>
      </section>
    </main>
  );
}
