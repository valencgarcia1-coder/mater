"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";

type Property = { id: string; name: string; lat: number | null; lng: number | null };

const US_CENTER: [number, number] = [-98.35, 39.5]; // MapLibre wants [lng, lat]
const US_ZOOM = 3.4;

// A from-scratch style over OpenFreeMap's free vector tiles (OpenMapTiles
// schema, no API key or account — unlike Google Maps/Mapbox, and unlike
// CARTO's raster basemaps, which now require signing in). Built by hand
// rather than borrowing one of OpenFreeMap's bundled themes (liberty/bright/
// positron — all light) so it actually matches the app's black/white
// palette, and deliberately sparse: no roads, buildings, or POIs, just
// coastline, borders, and place names, so it reads as a clean brand map
// rather than a road atlas.
const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    // OpenMapTiles has no single "land" polygon covering every continent —
    // land is implicitly whatever isn't drawn over, so the background color
    // itself is the land color, and water is a separate fill layer on top of
    // it. They need real contrast or the whole map reads as one flat color
    // (which is exactly what shipped the first time: both were near-black).
    { id: "bg", type: "background", paint: { "background-color": "#141414" } },
    {
      id: "landcover",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      paint: { "fill-color": "rgba(255,255,255,0.05)" },
    },
    {
      id: "water",
      type: "fill",
      source: "ofm",
      "source-layer": "water",
      paint: { "fill-color": "#000000" },
    },
    {
      id: "boundary-state",
      type: "line",
      source: "ofm",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 4],
      paint: { "line-color": "rgba(255,255,255,0.15)", "line-width": 0.6 },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "ofm",
      "source-layer": "boundary",
      filter: ["<=", ["get", "admin_level"], 2],
      paint: { "line-color": "rgba(255,255,255,0.4)", "line-width": 1 },
    },
    {
      id: "place-state",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "state"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
      },
      paint: { "text-color": "rgba(255,255,255,0.3)" },
    },
    {
      id: "place-city",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 5,
      filter: ["in", ["get", "class"], ["literal", ["city"]]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 10,
      },
      paint: { "text-color": "rgba(255,255,255,0.25)" },
    },
  ],
};

export default function USMap({ properties }: { properties: Property[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { Map, Marker, Popup, LngLatBounds, NavigationControl, setWorkerUrl } = await import(
        "maplibre-gl"
      );
      if (cancelled || !containerRef.current || mapRef.current) return;

      // MapLibre normally locates its worker script relative to its own
      // package file via import.meta.url — Turbopack can't resolve that for
      // a file deep in node_modules, which fails silently as "Worker failed
      // to load". Serving the same prebuilt worker as a static asset (copied
      // in at install time — see package.json's postinstall — along with the
      // shared chunk it imports internally, or it 404s on its own dependency
      // and fails the same way) and pointing at
      // it directly sidesteps that resolution entirely.
      setWorkerUrl("/maplibre-gl-worker.mjs");

      const map = new Map({
        container: containerRef.current,
        style: STYLE,
        center: US_CENTER,
        zoom: US_ZOOM,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      const pinned = properties.filter(
        (p): p is Property & { lat: number; lng: number } => p.lat !== null && p.lng !== null,
      );

      pinned.forEach((p) => {
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid rgba(255,255,255,0.35);box-shadow:0 0 0 6px rgba(255,255,255,0.08);cursor:pointer";
        const marker = new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        const popup = new Popup({ offset: 16, closeButton: false }).setText(p.name);
        el.addEventListener("mouseenter", () => marker.setPopup(popup).togglePopup());
        el.addEventListener("mouseleave", () => popup.remove());
        el.addEventListener("click", () => router.push(`/dashboard/properties/${p.id}`));
      });

      if (pinned.length === 1) {
        map.jumpTo({ center: [pinned[0].lng, pinned[0].lat], zoom: 9 });
      } else if (pinned.length > 1) {
        const bounds = pinned.reduce(
          (b, p) => b.extend([p.lng, p.lat]),
          new LngLatBounds([pinned[0].lng, pinned[0].lat], [pinned[0].lng, pinned[0].lat]),
        );
        map.fitBounds(bounds, { padding: 60 });
      }
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when the pin set changes, not on router identity
  }, [properties]);

  return <div ref={containerRef} className="h-full w-full" />;
}
