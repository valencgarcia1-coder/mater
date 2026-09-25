"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import ToggleButtons from "./ToggleButtons";

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
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mater-mark.svg" alt="Mater" className="h-7 w-auto" />
          <div>
            <h1 className="font-serif text-lg text-white">Mater</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              Live lot operations
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-white/50">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-white/20"}`}
          />
          {connected ? "Connected to detector" : "Connecting…"}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <ToggleButtons />
          <LiveFeed />
          <StatsBar status={status} spaces={spaces} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
            Spaces
          </h2>
          <SpaceGrid spaces={spaces} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
          Recent activity
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
          <EventLog events={events} />
        </div>
      </div>
    </div>
  );
}
