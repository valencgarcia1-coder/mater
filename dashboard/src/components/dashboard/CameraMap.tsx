"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

type Space = { id: string; label: string; zone: string };
type Camera = { id: string; name: string; spaces: Space[] };
type Row = {
  properties: { id: string; name: string; cameras: Camera[] } | null;
};

export default function CameraMap() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("property_members")
      .select("properties(id, name, cameras(id, name, spaces(id, label, zone)))")
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
        Camera map needs Supabase configured on this deployment.
      </p>
    );
  }

  const cameras = (rows ?? []).flatMap((r) =>
    r.properties ? r.properties.cameras.map((c) => ({ ...c, propertyId: r.properties!.id, propertyName: r.properties!.name })) : [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-white">Camera Map</h1>
        <p className="mt-1 text-sm font-light text-white/40">
          Every camera across every property you can see, and the spaces configured on it.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows === null && !error && <p className="text-sm font-light text-white/30">Loading…</p>}
      {rows?.length === 0 && (
        <p className="text-sm font-light text-white/30">You&apos;re not a member of any property yet.</p>
      )}
      {rows && rows.length > 0 && cameras.length === 0 && (
        <p className="text-sm font-light text-white/30">No cameras configured yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {cameras.map((cam) => (
          <div key={cam.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/70">{cam.name}</h3>
              <Link
                href={`/dashboard/properties/${cam.propertyId}`}
                className="font-mono text-[10px] uppercase tracking-wider text-white/30 hover:text-white/60"
              >
                {cam.propertyName} →
              </Link>
            </div>
            {cam.spaces.length === 0 ? (
              <p className="mt-2 text-xs font-light text-white/30">No spaces configured on this camera.</p>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {cam.spaces.map((s) => (
                  <div
                    key={s.id}
                    title={s.zone}
                    className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] py-2"
                  >
                    <span className="font-mono text-xs text-white">P{s.label}</span>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-white/30">
                      {s.zone.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {cameras.length > 0 && (
        <p className="text-xs font-light text-white/30">
          A visual layout over each camera&apos;s actual frame (instead of this grid) isn&apos;t built yet.
        </p>
      )}
    </div>
  );
}
