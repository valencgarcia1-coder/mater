"use client";

import Link from "next/link";
import { useState } from "react";

// A schematic (not survey-accurate) continental-US outline: a small set of
// border points run through the same linear projection used for property
// pins, so the outline and the pins always agree with each other even though
// neither is geographically precise. This is a brand map, not a GIS one.
const VIEW_W = 960;
const VIEW_H = 500;
const LNG_MIN = -125;
const LNG_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 49;

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * VIEW_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return [x, y];
}

const BORDER: [number, number][] = [
  [48.4, -124.7], [43.0, -124.4], [38.5, -123.2], [34.0, -119.7], [32.7, -117.2],
  [31.3, -111.0], [31.8, -106.5], [29.0, -104.5], [29.3, -101.0], [27.5, -99.5],
  [25.9, -97.1], [28.0, -96.0], [29.2, -89.9], [30.0, -85.5], [25.1, -80.5],
  [30.3, -81.4], [32.0, -80.9], [35.2, -75.5], [39.3, -74.4], [41.0, -72.0],
  [41.7, -70.0], [44.8, -66.9], [47.3, -68.4], [45.0, -83.5], [46.5, -84.5],
  [48.0, -89.5], [49.0, -95.2], [49.0, -110.0], [49.0, -123.0],
];

const OUTLINE = BORDER.map(([lat, lng], i) => {
  const [x, y] = project(lat, lng);
  return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(" ") + " Z";

type Property = { id: string; name: string; lat: number | null; lng: number | null };

export default function USMap({ properties }: { properties: Property[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const pinned = properties.filter(
    (p): p is Property & { lat: number; lng: number } => p.lat !== null && p.lng !== null,
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">All Properties</h3>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-3 w-full" role="img" aria-label="Map of properties">
        <path d={OUTLINE} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
        {pinned.map((p) => {
          const [x, y] = project(p.lat, p.lng);
          return (
            <Link key={p.id} href={`/dashboard/properties/${p.id}`}>
              <g
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                className="cursor-pointer"
              >
                <circle cx={x} cy={y} r={10} fill="rgba(255,255,255,0.08)" className="transition-opacity" />
                <circle cx={x} cy={y} r={4.5} fill="white" />
                {hovered === p.id && (
                  <text
                    x={x}
                    y={y - 16}
                    textAnchor="middle"
                    className="font-mono"
                    style={{ fill: "white", fontSize: 13 }}
                  >
                    {p.name}
                  </text>
                )}
              </g>
            </Link>
          );
        })}
      </svg>
      {pinned.length === 0 && (
        <p className="mt-2 text-xs font-light text-white/30">
          No properties have coordinates yet — add lat/lng in Settings to place a pin.
        </p>
      )}
    </div>
  );
}
