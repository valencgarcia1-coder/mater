"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30";
const labelClass = "font-mono text-[11px] uppercase tracking-wider text-white/40";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mater-mark.svg" alt="" className="h-6 w-auto" />
          <span className="font-serif text-lg">mater</span>
        </Link>

        <h1 className="font-serif text-4xl font-normal tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-3 text-sm font-light text-white/50">
          {mode === "signin"
            ? "Access your properties and review alerts."
            : "You'll be able to see a property once an admin adds you to it."}
        </p>

        {!supabaseConfigured ? (
          <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm font-light text-white/60">
            Sign-in isn&apos;t configured on this deployment yet.{" "}
            <Link href="/dashboard" className="text-white underline underline-offset-4">
              Open the dashboard
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            {mode === "signup" && (
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Name</span>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Email</span>
              <input
                className={inputClass}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Password</span>
              <input
                className={inputClass}
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-400">{notice}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-full bg-white px-6 py-3 font-mono text-xs uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="font-mono text-[11px] uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
            >
              {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
