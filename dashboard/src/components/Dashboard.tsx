"use client";

import { useEffect, useState } from "react";
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
import CameraPanel from "./dashboard/CameraPanel";
import ActivityPanel from "./dashboard/ActivityPanel";
import AlertsPanel from "./dashboard/AlertsPanel";
import { supabaseConfigured } from "@/lib/supabase/config";
import SpaceDetailTabs from "./dashboard/SpaceDetailTabs";
import CameraGrid from "./dashboard/CameraGrid";
import SpaceGrid from "./SpaceGrid";

const POLL_MS = 1500;

export default function Dashboard() {
  const [status, setStatus] = useState<DetectorStatus | null>(null);
  const [spaces, setSpaces] = useState<SpacesStatus>({});
  const [events, setEvents] = useState<DetectorEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [s, sp, ev] = await Promise.all([
          getStatus(),
          getSpacesStatus(),
          getEvents(20),
        ]);
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

  return (
    <Shell connected={connected} violationCount={violationCount}>
      <div className="flex flex-col gap-6">
        <StatCards status={status} spaces={spaces} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <CameraPanel status={status} />
            <SpaceDetailTabs spaces={spaces} selected={selectedSpace} />
          </div>
          <div className="flex flex-col gap-6">
            {supabaseConfigured && <AlertsPanel />}
            <ActivityPanel events={events} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
            Spaces
          </h2>
          <SpaceGrid spaces={spaces} selected={selectedSpace} onSelect={setSelectedSpace} />
        </div>

        <CameraGrid connected={connected} />
      </div>
    </Shell>
  );
}
