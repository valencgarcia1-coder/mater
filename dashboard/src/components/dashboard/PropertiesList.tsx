"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

type Row = {
  role: "admin" | "reviewer" | "viewer";
  properties: {
    id: string;
    name: string;
    address: string | null;
    timezone: string;
    cameras: { id: string }[];
  } | null;
};

const ROLE_STYLE: Record<Row["role"], string> = {
  admin: "border-white/20 text-white/70",
  reviewer: "border-sky-500/30 text-sky-400",
  viewer: "border-white/10 text-white/40",
};

export default function PropertiesList() {
  // supabaseConfigured is checked before calling createClient() (not just
  // before rendering below) — Next prerenders this route at build time even
  // though it's a client component, and createClient() throws immediately
  // if the URL/key env vars aren't set, which would fail the build.
  const [supabase] = useState(() => (supabaseConfigured ? createClient() : null));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("property_members")
      .select("role, properties(id, name, address, timezone, cameras(id))")
      .eq("user_id", userData.user.id);
    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as Row[]);
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!supabaseConfigured) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-light text-white/50">
        Properties need Supabase configured on this deployment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-white">Properties</h1>
        <p className="mt-1 text-sm font-light text-white/40">
          Every property you&apos;re a member of. Open one for its cameras, live status, and settings.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows === null && !error && <p className="text-sm font-light text-white/30">Loading…</p>}
      {rows?.length === 0 && (
        <p className="text-sm font-light text-white/30">
          You&apos;re not a member of any property yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows?.map(
          (r) =>
            r.properties && (
              <Link
                key={r.properties.id}
                href={`/dashboard/properties/${r.properties.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg text-white">{r.properties.name}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${ROLE_STYLE[r.role]}`}
                  >
                    {r.role}
                  </span>
                </div>
                {r.properties.address && (
                  <p className="text-xs font-light text-white/40">{r.properties.address}</p>
                )}
                <div className="mt-1 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-white/30">
                  <span>{r.properties.cameras.length} camera{r.properties.cameras.length === 1 ? "" : "s"}</span>
                  <span>{r.properties.timezone}</span>
                </div>
              </Link>
            ),
        )}
      </div>
    </div>
  );
}
