"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30";
const labelClass = "font-mono text-[11px] uppercase tracking-wider text-white/40";

type PropertyRow = { id: string; name: string };

export default function SettingsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("America/Denver");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);

  const loadProperties = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("property_members")
      .select("properties(id, name)")
      .eq("user_id", userData.user.id);
    setProperties(
      (data ?? [])
        .map((r) => (r as unknown as { properties: PropertyRow | null }).properties)
        .filter((p): p is PropertyRow => p !== null),
    );
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(loadProperties, 0);
    return () => clearTimeout(t);
  }, [loadProperties]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_property", {
      p_name: name,
      p_address: address || null,
      p_timezone: timezone,
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const propertyId = data as string;
    // create_property doesn't take coordinates (it predates the map), so the
    // pin is set as a follow-up update — safe because the RPC already made
    // this user that property's admin, and admins can update it.
    if (lat.trim() && lng.trim()) {
      const { error: coordError } = await supabase
        .from("properties")
        .update({ lat: Number(lat), lng: Number(lng) })
        .eq("id", propertyId);
      if (coordError) {
        setBusy(false);
        setError(`Property created, but saving coordinates failed: ${coordError.message}`);
        return;
      }
    }
    setBusy(false);
    router.push(`/dashboard/properties/${propertyId}`);
  }

  if (!supabaseConfigured) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-light text-white/50">
        Settings need Supabase configured on this deployment.
      </p>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-normal text-white">Settings</h1>
        <p className="mt-1 text-sm font-light text-white/40">
          Set up a new property. Cameras and spaces for it are added separately, from the detector&apos;s
          seed script.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/50">New property</h2>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Name</span>
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Address</span>
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Latitude</span>
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="40.5975"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Longitude</span>
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="-111.5835"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </label>
        </div>
        <p className="-mt-2 text-xs font-light text-white/30">
          Places a pin on the Overview map. Leave blank to add it later.
        </p>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Timezone</span>
          <input className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name}
          className="mt-1 self-start rounded-full bg-white px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create property"}
        </button>
      </form>

      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-white/40">Your properties</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {properties === null && <p className="text-sm font-light text-white/30">Loading…</p>}
          {properties?.length === 0 && <p className="text-sm font-light text-white/30">None yet.</p>}
          {properties?.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/properties/${p.id}`}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:text-white"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
