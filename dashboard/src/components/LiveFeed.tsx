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
// Save replaces the ENTIRE space list on the detector — there is no partial
// update. That makes "did the initial load actually succeed" a real data-
// safety question, not a cosmetic one: if it silently failed and left the
// local list empty, hitting Save would wipe every real space with nothing.
// This is exactly what happened once already, so loadStatus exists
// specifically to make that failure mode impossible to click through.
type LoadStatus = "loading" | "loaded" | "error";

export default function LiveFeed() {
  const [editing, setEditing] = useState(false);
  const [spaces, setSpacesState] = useState<Space[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [current, setCurrent] = useState<number[][]>([]);
  const [zone, setZone] = useState<Zone>("standard");
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function loadSpaces() {
    setLoadStatus("loading");
    getSpaces()
      .then((s) => {
        setSpacesState(s);
        setLoadStatus("loaded");
      })
      .catch(() => {
        // Deliberately NOT setSpacesState([]) — an empty list here reads to
        // the rest of this component as "the lot really has zero spaces,
        // safe to save," which is exactly the wrong thing to believe when
        // the load just failed. Leave whatever's currently in state alone
        // and make it impossible to save until a load actually succeeds.
        setLoadStatus("error");
      });
  }

  useEffect(() => {
    if (!editing) return;
    loadSpaces();
    setCurrent([]);
  }, [editing]);

  // An MJPEG multipart stream's <img> doesn't reliably fire `load` the way
  // a normal static image does — in some browsers it never fires at all
  // after the first part arrives, which silently blocked every click (the
  // click handler required naturalSize to already be set). Poll the image
  // element directly instead of trusting the event; this also self-heals
  // if the stream reconnects.
  useEffect(() => {
    const id = setInterval(() => {
      const img = imgRef.current;
      if (img && img.naturalWidth && img.naturalHeight) {
        setNaturalSize((prev) =>
          prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight
            ? prev
            : { w: img.naturalWidth, h: img.naturalHeight },
        );
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  function nextLabel(): string {
    const nums = spaces.map((s) => parseInt(s.label, 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editing || !containerRef.current) return;
    // Read live from the element rather than trusting state that a flaky
    // `onLoad` may never have set — see the polling effect above.
    const naturalW = imgRef.current?.naturalWidth;
    const naturalH = imgRef.current?.naturalHeight;
    if (!naturalW || !naturalH) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * naturalW);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * naturalH);
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
    if (loadStatus !== "loaded") return; // belt and suspenders — button is also disabled
    if (spaces.length === 0) {
      const ok = window.confirm(
        "This will save ZERO spaces, deleting every space on the detector. Are you sure?",
      );
      if (!ok) return;
    }
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
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black ${
          editing ? "cursor-crosshair" : ""
        }`}
      >
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          Live
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- MJPEG multipart stream, not a static image Next's optimizer can handle */}
        <img
          ref={imgRef}
          src={streamUrl()}
          alt="Live annotated camera feed"
          className="w-full h-auto block select-none"
          draggable={false}
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

      {editing && !naturalSize && (
        <p className="font-mono text-xs text-amber-400">
          Waiting on the video stream before clicks can be placed — give it a second.
        </p>
      )}

      {editing && loadStatus === "loading" && (
        <p className="font-mono text-xs text-white/40">Loading existing spaces…</p>
      )}

      {editing && loadStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          <span>
            Couldn&apos;t load the existing spaces from the detector — saving is disabled until this
            succeeds, so nothing gets overwritten by accident.
          </span>
          <button
            onClick={loadSpaces}
            className="shrink-0 rounded-full border border-red-700 px-3 py-1 font-mono text-[11px] uppercase tracking-wider hover:bg-red-950/60"
          >
            Retry
          </button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-light text-white/50">
            Click corners on the live feed above (3+ points), pick a zone, then &quot;Finish
            space&quot;. Nothing changes on the detector until you hit Save.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as Zone)}
              className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/70"
            >
              {ZONES.map((z) => (
                <option key={z} value={z} className="bg-black">
                  {z}
                </option>
              ))}
            </select>
            <button
              onClick={finishSpace}
              disabled={current.length < 3}
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/70 hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              Finish space
            </button>
            <button
              onClick={() => setCurrent((c) => c.slice(0, -1))}
              disabled={current.length === 0}
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/70 hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              Undo point
            </button>
            <button
              onClick={() => setCurrent([])}
              disabled={current.length === 0}
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/70 hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              Clear current
            </button>
            <button
              onClick={handleSave}
              disabled={loadStatus !== "loaded"}
              title={loadStatus !== "loaded" ? "Waiting on the existing spaces to load first" : undefined}
              className="rounded-full border border-blue-700 bg-blue-950/50 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-blue-300 hover:bg-blue-950/80 disabled:opacity-40 disabled:hover:bg-blue-950/50"
            >
              Save
            </button>
            {saveStatus === "saving" && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
                saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                saved ✓
              </span>
            )}
            {saveStatus === "error" && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-red-400">
                save failed
              </span>
            )}
          </div>
          {spaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {spaces.map((s) => (
                <span
                  key={s.label}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-white/60"
                >
                  P{s.label} ({s.zone})
                  <button
                    onClick={() => removeSpace(s.label)}
                    className="text-white/40 hover:text-red-400"
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
        className={`self-start rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          editing
            ? "border-amber-700 bg-amber-950/50 text-amber-400 hover:bg-amber-950/80"
            : "border-white/15 bg-white/[0.03] text-white/50 hover:border-white/30 hover:text-white/80"
        }`}
      >
        {editing ? "Done editing spaces" : "Adjust parking spaces"}
      </button>
    </div>
  );
}
