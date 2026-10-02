"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

type AlertRow = {
  id: string;
  kind: "violation" | "tow_eligible";
  status: "open" | "acknowledged" | "dismissed" | "resolved";
  created_at: string;
  reviewed_at: string | null;
  spaces: { label: string } | null;
  properties: { name: string } | null;
};

const KIND_STYLE = {
  violation: { label: "Violation", classes: "border-orange-500/40 bg-orange-500/10 text-orange-400" },
  tow_eligible: { label: "Tow eligible", classes: "border-red-500/40 bg-red-500/10 text-red-400" },
} as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatMinutes(min: number) {
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toFixed(1)} hr`;
}

// Everything here is computed client-side from the same alerts rows
// AlertsPanel already reads — no new RPC, no new table. Fine at this scale;
// worth moving to a real query/view once there's enough alert volume for
// a 500-row fetch to actually matter.
export default function ReportsPage() {
  const [supabase] = useState(() => (supabaseConfigured ? createClient() : null));
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, kind, status, created_at, reviewed_at, spaces(label), properties(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) setError(error.message);
      else setAlerts(data as unknown as AlertRow[]);
    })();
  }, [supabase]);

  if (!supabaseConfigured) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-light text-white/50">
        Reports need Supabase configured on this deployment.
      </p>
    );
  }

  const total = alerts?.length ?? 0;
  const open = alerts?.filter((a) => a.status === "open" || a.status === "acknowledged").length ?? 0;
  const reviewed = alerts?.filter((a) => a.reviewed_at) ?? [];
  const avgReviewMinutes =
    reviewed.length > 0
      ? reviewed.reduce((sum, a) => sum + (new Date(a.reviewed_at!).getTime() - new Date(a.created_at).getTime()) / 60000, 0) /
        reviewed.length
      : null;

  const bySpace = new Map<string, number>();
  for (const a of alerts ?? []) {
    const key = `${a.properties?.name ?? "?"} · ${a.spaces?.label ?? "?"}`;
    bySpace.set(key, (bySpace.get(key) ?? 0) + 1);
  }
  const topSpaces = [...bySpace.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCount = topSpaces[0]?.[1] ?? 1;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-normal text-white">Reports</h1>
        <p className="mt-1 text-sm font-light text-white/40">
          Every alert raised across your properties — most recent 500, newest first.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {alerts === null && !error && <p className="text-sm font-light text-white/30">Loading…</p>}

      {alerts !== null && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Total alerts</p>
              <p className="mt-2 font-serif text-3xl text-white">{total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Open now</p>
              <p className="mt-2 font-serif text-3xl text-white">{open}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Avg time to review</p>
              <p className="mt-2 font-serif text-3xl text-white">
                {avgReviewMinutes === null ? "—" : formatMinutes(avgReviewMinutes)}
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Most flagged spaces</h2>
            <div className="mt-3 flex flex-col gap-2">
              {topSpaces.length === 0 && <p className="text-sm font-light text-white/30">No alerts yet.</p>}
              {topSpaces.map(([key, count]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-40 flex-shrink-0 truncate text-xs text-white/60">{key}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-orange-400/70"
                      style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 flex-shrink-0 text-right font-mono text-xs text-white/50">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Recent alerts</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {alerts.length === 0 && <p className="text-sm font-light text-white/30">Nothing yet.</p>}
              {alerts.slice(0, 50).map((a) => {
                const kind = KIND_STYLE[a.kind];
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white">P{a.spaces?.label ?? "?"}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${kind.classes}`}
                      >
                        {kind.label}
                      </span>
                      <span className="text-xs font-light text-white/40">{a.properties?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="font-mono text-[10px] text-white/30">{formatTime(a.created_at)}</span>
                      <span className="w-20 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/40">
                        {a.reviewed_at ? "Reviewed" : a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
