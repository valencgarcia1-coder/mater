"use client";

import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Property = { id: string; name: string; lat: number | null; lng: number | null };

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

// Esri's hosted "Dark Gray Canvas" basemap — free, no API key or account
// (unlike Google Maps/Mapbox, and unlike CARTO's basemaps, which now require
// signing in). Two layers: a base fill, then a reference layer for labels/
// borders drawn on top of it. Note the {z}/{y}/{x} order — Esri's REST tile
// scheme puts y before x, the reverse of most other providers.
const BASE_URL = "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const REFERENCE_URL = "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "&copy; Esri, HERE, Garmin, OpenStreetMap contributors";

export default function USMap({ properties }: { properties: Property[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: US_CENTER,
        zoom: US_ZOOM,
        maxZoom: 16,
        scrollWheelZoom: true,
      });
      L.tileLayer(BASE_URL, { attribution: ATTRIBUTION, maxZoom: 16 }).addTo(map);
      L.tileLayer(REFERENCE_URL, { maxZoom: 16 }).addTo(map);
      mapRef.current = map;

      const pinned = properties.filter(
        (p): p is Property & { lat: number; lng: number } => p.lat !== null && p.lng !== null,
      );
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid rgba(255,255,255,0.35);box-shadow:0 0 0 6px rgba(255,255,255,0.08)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      pinned.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        marker.bindTooltip(p.name, { direction: "top", offset: [0, -8] });
        marker.on("click", () => router.push(`/dashboard/properties/${p.id}`));
      });

      if (pinned.length === 1) {
        map.setView([pinned[0].lat, pinned[0].lng], 11);
      } else if (pinned.length > 1) {
        map.fitBounds(L.latLngBounds(pinned.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
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

  const pinnedCount = properties.filter((p) => p.lat !== null && p.lng !== null).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">All Properties</h3>
      <div ref={containerRef} className="mt-3 h-[420px] w-full overflow-hidden rounded-xl" />
      {pinnedCount === 0 && (
        <p className="mt-2 text-xs font-light text-white/30">
          No properties have coordinates yet — add lat/lng in Settings to place a pin.
        </p>
      )}
    </div>
  );
}
