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
import LiveFeed from "./LiveFeed";
import StatsBar from "./StatsBar";
import SpaceGrid from "./SpaceGrid";
import EventLog from "./EventLog";

const POLL_MS = 1500;

export default function Dashboard() {
  const [status, setStatus] = useState<DetectorStatus | null>(null);
  const [spaces, setSpaces] = useState<SpacesStatus>({});
  const [events, setEvents] = useState<DetectorEvent[]>([]);
  const [connected, setConnected] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black text-sm font-bold">
            M
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-neutral-100">
              Mater
            </h1>
            <p className="text-xs text-neutral-500">Live lot operations</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600"}`}
          />
          {connected ? "Connected to detector" : "Connecting…"}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <LiveFeed />
          <StatsBar status={status} spaces={spaces} />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Spaces
          </h2>
          <SpaceGrid spaces={spaces} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Recent activity
        </h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2">
          <EventLog events={events} />
        </div>
      </div>
    </div>
  );
}
