"use client";

import { useState } from "react";
import type { SpacesStatus } from "@/lib/detector";
import { STATE_STYLES, formatDuration } from "../SpaceCard";

export default function SpaceDetailTabs({
  spaces,
  selected,
}: {
  spaces: SpacesStatus;
  selected: string | null;
}) {
  const [tab, setTab] = useState<"details" | "evidence">("details");
  const status = selected ? spaces[selected] : null;
  const style = status ? STATE_STYLES[status.state] : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1 border-b border-white/10 pb-3">
        {(["details", "evidence"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === t ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "details" ? "Space Details" : "Evidence"}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === "details" ? (
          status && style ? (
            <div className="flex flex-wrap items-start gap-8">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl text-white">P{selected}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${style.classes}`}>
                    {style.label}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 font-mono text-xs">
                  <dt className="text-white/30">Zone</dt>
                  <dd className="text-white/70">{status.zone.replace("_", " ")}</dd>
                  <dt className="text-white/30">Stationary for</dt>
                  <dd className="text-white/70">
                    {status.elapsed !== null ? formatDuration(status.elapsed) : "—"}
                  </dd>
                </dl>
              </div>
              <p className="max-w-xs text-xs font-light text-white/30">
                Per-vehicle records (plate, color, thumbnail) aren&apos;t built yet — this reflects
                the real space state from the detector, not a specific vehicle.
              </p>
            </div>
          ) : (
            <p className="text-sm font-light text-white/30">
              Select a space below to see its real-time detail.
            </p>
          )
        ) : (
          <p className="text-sm font-light text-white/30">
            Evidence capture (snapshots per violation) isn&apos;t built yet.
          </p>
        )}
      </div>
    </div>
  );
}
