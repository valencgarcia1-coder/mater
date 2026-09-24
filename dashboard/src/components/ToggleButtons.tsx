"use client";

import { useEffect, useState } from "react";
import { getToggles, setToggle, type Toggles } from "@/lib/detector";

// Only the two the operator actually asked for — read_plates exists on the
// detector too, but wasn't requested here and stays off by default (it's
// the CPU-heavy one), so it's left out of this control surface for now.
const BUTTONS: { key: keyof Toggles; label: string }[] = [
  { key: "show_vehicles", label: "Vehicle detection" },
  { key: "show_spaces", label: "Parking detection" },
];

export default function ToggleButtons() {
  const [toggles, setToggles] = useState<Toggles | null>(null);

  useEffect(() => {
    getToggles()
      .then(setToggles)
      .catch(() => {});
  }, []);

  async function flip(key: keyof Toggles) {
    if (!toggles) return;
    const optimistic = { ...toggles, [key]: !toggles[key] };
    setToggles(optimistic);
    try {
      const result = await setToggle(key, optimistic[key]);
      setToggles(result);
    } catch {
      setToggles(toggles); // revert on failure
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {BUTTONS.map(({ key, label }) => {
        const on = toggles?.[key] ?? false;
        return (
          <button
            key={key}
            onClick={() => flip(key)}
            disabled={!toggles}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              on
                ? "border-emerald-700 bg-emerald-950/50 text-emerald-400 hover:bg-emerald-950/70"
                : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
            }`}
          >
            {label}: {toggles ? (on ? "On" : "Off") : "…"}
          </button>
        );
      })}
    </div>
  );
}
