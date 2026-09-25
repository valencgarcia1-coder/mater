"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Watch",
    body: "Every vehicle is detected and tracked with a pixel-accurate silhouette outline — not a loose rectangle that spills into the space next door.",
  },
  {
    n: "02",
    title: "Confirm",
    body: "A vehicle only counts as parked once its own movement, not just its position, proves it's actually stopped — a car still backing in doesn't start the clock.",
  },
  {
    n: "03",
    title: "Prove",
    body: "Every violation builds a continuous, timestamped evidence trail for as long as the zone's rule requires — before anything is flagged as actionable.",
  },
  {
    n: "04",
    title: "Escalate",
    body: "Only a vehicle that's genuinely overstayed, under that zone's own rule, ever becomes tow-eligible. Everything else is just a parked car.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mb-14 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Detection and enforcement, kept deliberately separate.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
          The vision layer only answers one question — what&apos;s in this space, and for how
          long. Whether that counts as a violation is a rule, not a guess, and the rule can
          change without retraining anything.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-5"
          >
            <span className="font-mono text-xs text-neutral-600">{step.n}</span>
            <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
