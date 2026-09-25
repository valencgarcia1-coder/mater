"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function TopBar({ connected }: { connected: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/10 px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mater-mark.svg" alt="Mater" className="h-6 w-auto" />
          <span className="font-serif text-lg text-white">mater</span>
        </Link>
        <span className="h-5 w-px bg-white/10" />
        {/* Only one real camera source exists right now, so this is a label,
            not a functioning multi-property switcher — honest about that
            rather than faking a dropdown with fabricated properties. */}
        <span className="font-mono text-xs uppercase tracking-wider text-white/50">
          Test Lot
        </span>
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-white/50">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-white/20"}`}
          />
          {connected ? "Live" : "Connecting"}
        </div>
        {now && (
          <div className="text-right font-mono text-xs text-white/50">
            <div>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        )}
      </div>
    </header>
  );
}
