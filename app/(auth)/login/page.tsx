"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import {
  firebaseAuthErrorMessage,
  googleSignInMessage,
} from "@/lib/auth/client-auth-error";
import { finalizeServerSession } from "@/lib/auth/finalize-server-session";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-routing";
import { firebaseAuth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const completeLogin = async (user: Parameters<typeof finalizeServerSession>[0]) => {
    await finalizeServerSession(user);
    const route = await resolvePostLoginRoute(user);
    window.location.replace(route);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await completeLogin(credential.user);
    } catch (loginError: unknown) {
      console.error("Email sign-in failed", loginError);
      setError(firebaseAuthErrorMessage(loginError, "Unable to start your session. Check your details and retry."));
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
      const result = await signInWithPopup(firebaseAuth, provider);
      await completeLogin(result.user);
    } catch (loginError: unknown) {
      console.error("Google sign-in failed", loginError);
      setError(googleSignInMessage(loginError));
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 font-sans">
      <div className="w-full max-w-md animate-in fade-in">
        <header className="mb-12 flex flex-col items-center text-center">
          <Image src="/cbam_logo.svg" alt="CBAMValid" width={196} height={48} priority className="mb-4 h-8 w-auto object-contain" />
          <h1 className="mb-3 font-serif text-3xl tracking-tight text-foreground">CBAM Portal</h1>
          <p className="font-mono text-sm text-muted">Authenticated exporter workspace</p>
        </header>

        <section className="rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)] sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-center text-xs text-red-800">{error}</div>}
            <div>
              <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-wider">Email</label>
              <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} maxLength={320} className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" placeholder="name@company.com" />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-wider">Password</label>
              <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
            </div>
            <button type="submit" disabled={loading || !email.trim() || !password} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Establishing session…</> : "Sign In"}
            </button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 font-mono text-muted">or</span></div></div>
          <button type="button" onClick={() => void handleGoogleSignIn()} disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong px-5 py-3 font-medium hover:bg-neutral-soft disabled:opacity-45">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign In with Google
          </button>
        </section>

        <div className="mt-8 text-center text-sm font-semibold"><button type="button" onClick={() => router.push("/register")} className="border-b border-transparent text-muted hover:border-foreground hover:text-foreground">Create Account</button></div>
      </div>
    </main>
  );
}
