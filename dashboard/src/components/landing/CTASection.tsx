"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function CTASection() {
  return (
    <section id="contact" className="relative mx-auto w-full max-w-6xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-black px-8 py-16 text-center"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[100px]" />
        <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          See it watching a real lot, right now.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-neutral-400">
          No sales deck. The live dashboard is the same one running against a real camera feed
          today.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
          >
            Open the live dashboard
          </Link>
          <a
            href="mailto:hello@example.com"
            className="rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
          >
            Talk to us
          </a>
        </div>
      </motion.div>
    </section>
  );
}
