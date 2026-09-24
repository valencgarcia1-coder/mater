"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSpaces,
  saveSpaces,
  streamUrl,
  type Space,
  type Zone,
} from "@/lib/detector";

const ZONES: Zone[] = ["standard", "fire_lane", "handicap", "loading_zone"];

// This overlays the space editor directly on the LIVE stream — not a
// separate page against a frozen snapshot (that's what the detector's own
// /editor page does). Traffic keeps moving underneath while you place
// points, and saving applies immediately to the running detector: the
// Flask side already calls pipeline.set_spaces() on POST /api/spaces, no
// restart involved.
export default function LiveFeed() {
  const [editing, setEditing] = useState(false);
  const [spaces, setSpacesState] = useState<Space[]>([]);
  const [current, setCurrent] = useState<number[][]>([]);
  const [zone, setZone] = useState<Zone>("standard");
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    getSpaces()
      .then(setSpacesState)
      .catch(() => setSpacesState([]));
    setCurrent([]);
  }, [editing]);

  function nextLabel(): string {
    const nums = spaces.map((s) => parseInt(s.label, 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editing || !containerRef.current || !naturalSize) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * naturalSize.w);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * naturalSize.h);
    setCurrent((c) => [...c, [x, y]]);
  }

  function finishSpace() {
    if (current.length < 3) return;
    setSpacesState((s) => [...s, { label: nextLabel(), polygon: current, zone }]);
    setCurrent([]);
  }

  function removeSpace(label: string) {
    setSpacesState((s) => s.filter((sp) => sp.label !== label));
  }

  async function handleSave() {
    setSaveStatus("saving");
    try {
      await saveSpaces(spaces);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative overflow-hidden rounded-lg border border-neutral-800 bg-black ${
          editing ? "cursor-crosshair" : ""
        }`}
      >
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-neutral-200 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- MJPEG multipart stream, not a static image Next's optimizer can handle */}
        <img
          ref={imgRef}
          src={streamUrl()}
          alt="Live annotated camera feed"
          className="w-full h-auto block select-none"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
        />
        {editing && naturalSize && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
            preserveAspectRatio="none"
          >
            {spaces.map((s) => {
              const points = s.polygon.map((p) => p.join(",")).join(" ");
              const [lx, ly] = s.polygon[0];
              return (
                <g key={s.label}>
                  <polygon
                    points={points}
                    className="fill-cyan-400/10 stroke-cyan-400"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text x={lx + 6} y={ly + 18} className="fill-cyan-300 text-[16px] font-mono">
                    P{s.label}
                    {s.zone !== "standard" ? ` ${s.zone}` : ""}
                  </text>
                </g>
              );
            })}
            {current.length > 0 && (
              <>
                <polyline
                  points={current.map((p) => p.join(",")).join(" ")}
                  className="stroke-amber-400 fill-none"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                {current.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={6} className="fill-amber-400" />
                ))}
              </>
            )}
          </svg>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <p className="text-xs text-neutral-500">
            Click corners on the live feed above (3+ points), pick a zone, then &quot;Finish
            space&quot;. Nothing changes on the detector until you hit Save.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as Zone)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <button
              onClick={finishSpace}
              disabled={current.length < 3}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
            >
              Finish space
            </button>
            <button
              onClick={() => setCurrent((c) => c.slice(0, -1))}
              disabled={current.length === 0}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
            >
              Undo point
            </button>
            <button
              onClick={() => setCurrent([])}
              disabled={current.length === 0}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
            >
              Clear current
            </button>
            <button
              onClick={handleSave}
              className="rounded-md border border-blue-700 bg-blue-950/50 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-950/80"
            >
              Save
            </button>
            {saveStatus === "saving" && <span className="text-xs text-neutral-500">saving…</span>}
            {saveStatus === "saved" && <span className="text-xs text-emerald-400">saved ✓</span>}
            {saveStatus === "error" && <span className="text-xs text-red-400">save failed</span>}
          </div>
          {spaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {spaces.map((s) => (
                <span
                  key={s.label}
                  className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300"
                >
                  P{s.label} ({s.zone})
                  <button
                    onClick={() => removeSpace(s.label)}
                    className="text-neutral-500 hover:text-red-400"
                    aria-label={`Remove space ${s.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setEditing((v) => !v)}
        className={`self-start rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          editing
            ? "border-amber-700 bg-amber-950/50 text-amber-400 hover:bg-amber-950/80"
            : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
        }`}
      >
        {editing ? "Done editing spaces" : "Adjust parking spaces"}
      </button>
    </div>
  );
}
