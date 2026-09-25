"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

// Not stock animation — this cycles through the actual five states the
// real detector's state machine uses (empty/arriving/parked/violation/
// tow_eligible), same colors as the live dashboard. Abstract, not real
// footage: the Brighton test feed is restricted to internal testing, not
// for redistribution, so nothing real is shown here — just the honest
// shape of what the system does.
const COLORS: Record<string, string> = {
  empty: "#1f1f1f",
  arriving: "#525252",
  parked: "#10b981",
  violation: "#f59e0b",
  tow_eligible: "#ef4444",
};

const SEQUENCE = [
  "empty",
  "arriving",
  "parked",
  "parked",
  "parked",
  "violation",
  "tow_eligible",
  "empty",
] as const;

export default function DetectionGrid({ cellCount = 48 }: { cellCount?: number }) {
  const cells = useMemo(
    () =>
      Array.from({ length: cellCount }, (_, i) => ({
        id: i,
        delay: (i * 37) % 11, // deterministic pseudo-randomness, stable across server/client render
        duration: 7 + ((i * 13) % 9),
      })),
    [cellCount],
  );

  return (
    <div className="grid grid-cols-8 gap-2 sm:gap-3">
      {cells.map((cell) => (
        <motion.div
          key={cell.id}
          className="aspect-square rounded-md"
          initial={{ backgroundColor: COLORS.empty }}
          animate={{ backgroundColor: SEQUENCE.map((s) => COLORS[s]) }}
          transition={{
            duration: cell.duration,
            delay: cell.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
