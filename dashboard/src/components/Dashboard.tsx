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
import StatCards from "./dashboard/StatCards";
import ActivityPanel from "./dashboard/ActivityPanel";
import AlertsPanel from "./dashboard/AlertsPanel";
import USMap from "./dashboard/USMap";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 1500;

type PropertyRow = { id: string; name: string; lat: number | null; lng: number | null };

// The cross-property landing page: a map of everywhere Mater watches, plus
// aggregate stats and updates. Stats/activity still come from the one
// detector connection that exists today — see the comment in
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

  return (
    <Shell connected={connected} violationCount={violationCount}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif text-2xl font-normal text-white">Overview</h1>
          <p className="mt-1 text-sm font-light text-white/40">Every property, at a glance.</p>
        </div>

        <StatCards status={status} spaces={spaces} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <USMap properties={properties} />
          </div>
          <div className="flex flex-col gap-6">
            {supabaseConfigured && <AlertsPanel />}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Properties</h3>
              <div className="mt-3 flex flex-col gap-1.5">
                {properties.length === 0 ? (
                  <p className="text-sm font-light text-white/30">None yet.</p>
                ) : (
                  properties.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/properties/${p.id}`}
                      className="rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                      {p.name}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <ActivityPanel events={events} />
      </div>
    </Shell>
  );
}
