"use client";

import { useEffect, useState } from "react";
import { getSpacesStatus, type SpacesStatus } from "@/lib/detector";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

const POLL_MS = 5000;

// The chrome (top bar + sidebar) shared by every /dashboard/* page. Pages
// under Overview poll the detector directly for the full live feed; this
// shell only needs a cheap poll to drive the "connected" dot and the
// violation-count badge so they stay right when you're not on Overview.
export default function Shell({
  children,
  connected: connectedOverride,
  violationCount: violationCountOverride,
}: {
  children: React.ReactNode;
  // A page that already polls the full feed (like Overview) passes its own
  // values instead of paying for a second poll here.
  connected?: boolean;
  violationCount?: number;
}) {
  const selfPoll = connectedOverride === undefined;
  const [spaces, setSpaces] = useState<SpacesStatus>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!selfPoll) return;
    let cancelled = false;
    async function poll() {
      try {
        const sp = await getSpacesStatus();
        if (cancelled) return;
        setSpaces(sp);
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
  }, [selfPoll]);

  const violationCount =
    violationCountOverride ??
    Object.values(spaces).filter((s) => s.state === "violation" || s.state === "tow_eligible").length;
  const isConnected = connectedOverride ?? connected;

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <TopBar connected={isConnected} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar violationCount={violationCount} connected={isConnected} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
