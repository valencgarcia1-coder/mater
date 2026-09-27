"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UserMenu() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [supabase]);

  async function signOut() {
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
