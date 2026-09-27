"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import {
  getEvents,
  getSpacesStatus,
  getStatus,
  type DetectorEvent,
  type DetectorStatus,
  type SpacesStatus,
} from "@/lib/detector";
import Shell from "./Shell";
import StatCards from "./StatCards";
import CameraPanel from "./CameraPanel";
import SpaceDetailTabs from "./SpaceDetailTabs";
import CameraGrid from "./CameraGrid";
import ActivityPanel from "./ActivityPanel";
import AlertsPanel from "./AlertsPanel";
import SpaceGrid from "../SpaceGrid";

type Space = { id: string; label: string; zone: string };
type Camera = { id: string; name: string; spaces: Space[] };
type Property = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  cameras: Camera[];
};
type Member = { user_id: string; role: string; full_name: string | null };

const TABS = ["overview", "reports"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  reports: "Reports",
};

const POLL_MS = 1500;

// This owns its own Shell (like the top-level Overview does) rather than
// being wrapped by the page, because it's the one page with a live camera
// feed to poll and Shell's connected-dot/violation-badge need that state.
//
// The detector is still single-tenant (one DETECTOR_URL, one camera) — this
// live view isn't actually scoped to *this* property yet, it's just the one
// feed that exists. When a second property gets its own camera, this needs
// to look up which detector endpoint belongs to which property.
export default function PropertyDetail({ propertyId }: { propertyId: string }) {
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<Tab>("overview");
  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<DetectorStatus | null>(null);
  const [spaces, setSpaces] = useState<SpacesStatus>({});
  const [events, setEvents] = useState<DetectorEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const [{ data: prop, error: propErr }, { data: membership }] = await Promise.all([
      supabase
        .from("properties")
        .select("id, name, address, timezone, cameras(id, name, spaces(id, label, zone))")
        .eq("id", propertyId)
        .maybeSingle(),
      supabase
        .from("property_members")
        .select("role")
        .eq("property_id", propertyId)
        .eq("user_id", userData.user.id)
        .maybeSingle(),
    ]);

    if (propErr) setError(propErr.message);
    setProperty((prop as unknown as Property) ?? null);
    setRole(membership?.role ?? null);
  }, [supabase, propertyId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Joined to profiles by hand — property_members has no direct foreign key
  // to profiles (both point at auth.users), so PostgREST can't embed it.
  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      const { data: rows, error } = await supabase
        .from("property_members")
        .select("user_id, role")
        .eq("property_id", propertyId);
      if (error || cancelled) {
        if (error) setError(error.message);
        return;
      }
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] };
      if (cancelled) return;
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setMembers(
        (rows ?? []).map((r) => ({
          user_id: r.user_id,
          role: r.role,
          full_name: nameById.get(r.user_id) ?? null,
        })),
      );
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [supabase, propertyId]);

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

  const violationCount = Object.values(spaces).filter(
    (s) => s.state === "violation" || s.state === "tow_eligible",
  ).length;

  if (!supabaseConfigured) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-light text-white/50">
        Properties need Supabase configured on this deployment.
      </p>
    );
  }

  return (
    <Shell connected={connected} violationCount={violationCount}>
      {property === undefined ? (
        <p className="text-sm font-light text-white/30">Loading…</p>
      ) : property === null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-light text-white/50">
            {error ?? "This property doesn't exist, or you don't have access to it."}
          </p>
          <Link href="/dashboard/properties" className="text-sm text-white underline underline-offset-4">
            Back to properties
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <Link
              href="/dashboard/properties"
              className="font-mono text-[10px] uppercase tracking-wider text-white/30 hover:text-white/60"
            >
              ← Properties
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-2xl font-normal text-white">{property.name}</h1>
              {role && (
                <span className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/60">
                  {role}
                </span>
              )}
            </div>
            {property.address && <p className="mt-1 text-sm font-light text-white/40">{property.address}</p>}
          </div>

          <div className="flex items-center gap-1 border-b border-white/10 pb-3">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  tab === t ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="flex flex-col gap-6">
              <StatCards status={status} spaces={spaces} />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                  <CameraPanel status={status} />
                  <SpaceDetailTabs spaces={spaces} selected={selectedSpace} />
                </div>
                <div className="flex flex-col gap-6">
                  <AlertsPanel propertyId={propertyId} />
                  <ActivityPanel events={events} />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Spaces</h2>
                <SpaceGrid spaces={spaces} selected={selectedSpace} onSelect={setSelectedSpace} />
              </div>

              <CameraGrid connected={connected} />

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Team</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {members === null && <p className="text-sm font-light text-white/30">Loading…</p>}
                  {members?.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                    >
                      <span className="text-sm text-white/80">{m.full_name ?? m.user_id}</span>
                      <span className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/60">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs font-light text-white/30">
                  Inviting members and changing roles from here isn&apos;t built yet — use the database
                  directly for now.
                </p>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <p className="text-sm font-light text-white/30">
              Historical reporting (violations over time, per-space utilization, false-positive rate) isn&apos;t
              built yet — it needs a query over the space_events history table.
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
