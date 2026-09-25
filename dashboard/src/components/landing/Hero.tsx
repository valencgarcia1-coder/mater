"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import DetectionGrid from "./DetectionGrid";

export default function Hero() {
  return (
    <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-24 pt-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-400 backdrop-blur"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Actively watching a live lot right now
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="max-w-3xl text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl"
      >
        Parking enforcement that{" "}
        <span className="bg-gradient-to-r from-white via-neutral-300 to-neutral-500 bg-clip-text text-transparent">
          never blinks.
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mt-6 max-w-xl text-balance text-lg text-neutral-400"
      >
        Mater watches every space around the clock, builds a timestamped case for every
        violation, and only calls a truck once it&apos;s certain. No patrols. No guesswork.
        No bad tows.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="mt-9 flex items-center gap-3"
      >
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
        >
          Watch it live
        </Link>
        <a
          href="#how-it-works"
          className="rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
        >
          How it works
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="relative mt-20 w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 shadow-[0_0_80px_-20px_rgba(255,255,255,0.15)] backdrop-blur"
      >
        <DetectionGrid />
        <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-neutral-500">
          <Legend color="#10b981" label="Parked" />
          <Legend color="#f59e0b" label="Violation" />
          <Legend color="#ef4444" label="Tow eligible" />
        </div>
      </motion.div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
