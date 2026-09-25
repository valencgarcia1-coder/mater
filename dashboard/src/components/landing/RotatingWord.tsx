"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const WORDS = [
  "easier",
  "faster",
  "with Mater.",
  "quicker",
  "smoother",
  "smarter",
  "simpler",
  "with Mater.",
  "effortless",
  "instant",
  "seamless",
  "automatic",
];

export default function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="relative inline-grid pr-3 align-bottom"
      style={{ overflowX: "visible", overflowY: "hidden" }}
    >
      <AnimatePresence>
        <motion.span
          key={WORDS[index]}
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          className="col-start-1 row-start-1 whitespace-nowrap font-serif italic"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
