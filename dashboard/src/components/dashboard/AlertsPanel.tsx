"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

type Alert = {
  id: string;
  kind: "violation" | "tow_eligible";
  status: "open" | "acknowledged";
  created_at: string;
  evidence_path: string | null;
  spaces: { label: string; zone: string } | null;
  properties: { name: string } | null;
};

const KIND_STYLE = {
  violation: { label: "Violation", classes: "border-orange-500/40 bg-orange-500/10 text-orange-400" },
  tow_eligible: { label: "Tow eligible", classes: "border-red-500/40 bg-red-500/10 text-red-400" },
} as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Alerts raised when a space goes past its violation / tow threshold. A person
// reviews each one (acknowledge or dismiss) — nothing here dispatches a tow.
// Rows come straight from the database, so row-level security decides what
// this user can see; the buttons are hidden for viewers, but the database
// refuses their review calls regardless.
export default function AlertsPanel({ propertyId }: { propertyId?: string } = {}) {
  // supabaseConfigured is checked before calling createClient() (not just
  // before rendering below) — Next prerenders routes at build time even for
  // client components, and createClient() throws immediately if the URL/key
  // env vars aren't set, which would fail the build.
  const [supabase] = useState(() => (supabaseConfigured ? createClient() : null));
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    let query = supabase
      .from("alerts")
      .select("id, kind, status, created_at, evidence_path, spaces(label, zone), properties(name)")
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setAlerts(data as unknown as Alert[]);
    }
  }, [supabase, propertyId]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase; // narrowed non-null for the closure below
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 30_000);
    const channel = client
      .channel("alerts-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void load())
      .subscribe();
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [supabase, load]);

  // Evidence lives in a private bucket, so each photo needs its own signed
  // URL (scoped by the same property-membership check as everything else) —
  // fetched lazily per alert instead of baked into the initial select.
  useEffect(() => {
    if (!supabase || !alerts) return;
    const client = supabase;
    const missing = alerts
      .map((a) => a.evidence_path)
      .filter((path): path is string => !!path && !(path in evidenceUrls));
    if (missing.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        missing.map(async (path) => {
          const { data } = await client.storage.from("evidence").createSignedUrl(path, 3600);
          return [path, data?.signedUrl ?? ""] as const;
        }),
      );
      const fresh = Object.fromEntries(entries.filter(([, signedUrl]) => signedUrl));
      if (Object.keys(fresh).length > 0) setEvidenceUrls((prev) => ({ ...prev, ...fresh }));
    })();
  }, [supabase, alerts, evidenceUrls]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase; // narrowed non-null for the closure below
    async function loadRole() {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return;
      let query = client.from("property_members").select("role").eq("user_id", userData.user.id);
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data } = await query;
      setCanReview((data ?? []).some((m) => m.role === "admin" || m.role === "reviewer"));
    }
    void loadRole();
  }, [supabase, propertyId]);

  async function review(id: string, status: "acknowledged" | "dismissed") {
    if (!supabase) return;
    setBusyId(id);
    const { error } = await supabase.rpc("review_alert", { p_alert_id: id, p_status: status });
    if (error) setError(error.message);
    await load();
    setBusyId(null);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Alerts to review</h3>
        {alerts && alerts.length > 0 && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">{alerts.length}</span>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {alerts === null && !error && <p className="text-sm font-light text-white/30">Loading…</p>}
        {alerts?.length === 0 && <p className="text-sm font-light text-white/30">Nothing needs review.</p>}
        {alerts?.map((a) => {
          const kind = KIND_STYLE[a.kind];
          return (
            <div key={a.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">P{a.spaces?.label ?? "?"}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${kind.classes}`}>
                    {kind.label}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-white/30">{formatTime(a.created_at)}</span>
              </div>
              {a.properties?.name && <p className="mt-1 text-xs font-light text-white/40">{a.properties.name}</p>}

              {a.evidence_path && evidenceUrls[a.evidence_path] && (
                <a
                  href={evidenceUrls[a.evidence_path]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block overflow-hidden rounded-lg border border-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidenceUrls[a.evidence_path]}
                    alt={`Evidence for space ${a.spaces?.label ?? "?"}`}
                    className="h-28 w-full object-cover"
                  />
                </a>
              )}

              {a.status === "acknowledged" && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/40">Acknowledged</p>
              )}
              {canReview && (
                <div className="mt-3 flex gap-2">
                  {a.status === "open" && (
                    <button
                      disabled={busyId === a.id}
                      onClick={() => review(a.id, "acknowledged")}
                      className="rounded-full bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    disabled={busyId === a.id}
                    onClick={() => review(a.id, "dismissed")}
                    className="rounded-full border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/70 transition-colors hover:text-white disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
