"use client";

import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "Silhouette-accurate detection",
    body: "Real segmentation masks trace each vehicle's actual shape, not a rectangle that can spill into the space next door.",
  },
  {
    title: "Per-zone rules",
    body: "A fire lane, a handicap spot, and a standard space each get their own timing rule — changing policy is an edit, not a redeploy.",
  },
  {
    title: "Defensible by design",
    body: "Every violation holds for a continuous evidentiary window before it's ever flagged — built to survive a dispute, not just a demo.",
  },
  {
    title: "A real state machine",
    body: "Empty, arriving, parked, violation, tow-eligible — every space has an explicit status, not a single ambiguous “occupied” flag.",
  },
  {
    title: "Calibrated to real distance",
    body: "Movement is measured in real meters via a ground-plane calibration, not raw pixels that mean something different near the camera than far from it.",
  },
  {
    title: "Built for property managers",
    body: "The pitch is defensibility, not volume — the goal is never to tow more cars, it's to make sure every tow was actually justified.",
  },
];

export default function Features() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mb-14 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Built from the ground up to be trusted.
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="bg-black p-6"
          >
            <h3 className="text-sm font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
