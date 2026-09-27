"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getEvents,
  getSpacesStatus,
  getStatus,
  type DetectorEvent,
  type DetectorStatus,
  type SpacesStatus,
} from "@/lib/detector";
import Shell from "./dashboard/Shell";
import ActivityPanel from "./dashboard/ActivityPanel";
import AlertsPanel from "./dashboard/AlertsPanel";
import USMap from "./dashboard/USMap";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 1500;
const overlayCard = "rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md";

type PropertyRow = { id: string; name: string; lat: number | null; lng: number | null };

// The cross-property landing page: a full-bleed map of everywhere Mater
// watches, with stats/alerts/activity floating over it instead of sitting in
// a separate column — see Shell's fullBleed prop. Stats/activity still come
// from the one detector connection that exists today; see the comment in
// PropertyDetail.tsx about the single-tenant reality that'll need fixing
// once there's a second camera.
export default function Dashboard() {
  const [status, setStatus] = useState<DetectorStatus | null>(null);
  const [spaces, setSpaces] = useState<SpacesStatus>({});
  const [events, setEvents] = useState<DetectorEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [s, sp, ev] = await Promise.all([getStatus(), getSpacesStatus(), getEvents(20)]);
        if (cancelled) return;
        setStatus(s);
        setSpaces(sp);
        setEvents(ev);
        setConnected(true);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const [supabase] = useState(() => (supabaseConfigured ? createClient() : null));
  const loadProperties = useCallback(async () => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("property_members")
      .select("properties(id, name, lat, lng)")
      .eq("user_id", userData.user.id);
    setProperties(
      (data ?? [])
        .map((r) => (r as unknown as { properties: PropertyRow | null }).properties)
        .filter((p): p is PropertyRow => p !== null),
    );
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(loadProperties, 0);
    return () => clearTimeout(t);
  }, [loadProperties]);

  const violationCount = Object.values(spaces).filter(
    (s) => s.state === "violation" || s.state === "tow_eligible",
  ).length;
  const pinnedCount = properties.filter((p) => p.lat !== null && p.lng !== null).length;

  return (
    <Shell connected={connected} violationCount={violationCount} fullBleed>
      <div className="absolute inset-0">
        <USMap properties={properties} />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col p-4">
        {pinnedCount === 0 && properties.length > 0 && (
          <div className={`${overlayCard} pointer-events-auto max-w-sm self-start px-4 py-3`}>
            <p className="text-xs font-light text-white/40">
              No properties have coordinates yet — add lat/lng in Settings to place a pin.
            </p>
          </div>
        )}

        <div className="pointer-events-none flex flex-1 items-end justify-end">
          <div
            className={`${overlayCard} pointer-events-auto flex w-72 flex-shrink-0 flex-col gap-3 overflow-y-auto p-3`}
          >
            <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-white/35">
              <span>{status?.active_tracks ?? "—"} active</span>
              <span>{violationCount} violations</span>
              <span>{status ? status.fps_estimate.toFixed(1) : "—"} fps</span>
            </div>
            <div className="h-px bg-white/10" />
            {supabaseConfigured && <AlertsPanel />}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Properties</h3>
              <div className="mt-3 flex flex-col gap-1.5">
                {properties.length === 0 ? (
                  <p className="text-sm font-light text-white/30">None yet.</p>
                ) : (
                  properties.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/properties/${p.id}`}
                      className="rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      {p.name}
                    </Link>
                  ))
                )}
              </div>
            </div>
            <ActivityPanel events={events} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
