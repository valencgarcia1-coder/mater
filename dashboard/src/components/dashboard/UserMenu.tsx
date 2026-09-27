"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

// UserMenu is only ever rendered behind a supabaseConfigured check by its
// callers, but guarding createClient() here too (rather than only trusting
// the caller) means it stays safe even if that changes — see the same note
// in AlertsPanel.tsx, PropertiesList.tsx, PropertyDetail.tsx, SettingsPage.tsx.
export default function UserMenu() {
  const router = useRouter();
  const [supabase] = useState(() => (supabaseConfigured ? createClient() : null));
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      {email && <span className="hidden text-white/40 sm:inline">{email}</span>}
      <button
        onClick={signOut}
        className="uppercase tracking-wider text-white/50 transition-colors hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
