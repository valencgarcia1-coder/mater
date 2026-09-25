import Link from "next/link";
import HeroVisual from "./HeroVisual";
import TowHook from "./TowHook";

export default function Hero() {
  return (
    <section className="relative h-screen min-h-[720px] w-full overflow-hidden bg-black">
      <HeroVisual />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />

      <TowHook
        className="pointer-events-none absolute left-[62%] top-0 scale-150 sm:scale-[1.8]"
        cableLength={170}
      />

      <div className="relative z-20 flex h-full flex-col justify-center px-8 sm:px-12">
        <p className="text-xs font-medium tracking-[0.25em] text-white/70">
          AI-POWERED TOWING INFRASTRUCTURE
        </p>
        <h1 className="mt-4 max-w-xl font-serif text-6xl font-semibold leading-[1.05] text-white sm:text-7xl">
          Towing shouldn&apos;t require a phone call.
        </h1>
        <p className="mt-6 max-w-sm text-base text-white/75">
          Mater automatically detects vehicles that need to be towed and dispatches the nearest
          available truck.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
        >
          Get Started <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="absolute right-8 top-24 z-20 hidden w-72 items-start gap-3 rounded-2xl border border-white/15 bg-black/50 p-3 backdrop-blur-sm sm:flex">
        <div className="relative flex h-14 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-poster.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="white"
            className="relative drop-shadow"
          >
            <path d="M4 2.5v11l9-5.5-9-5.5z" />
          </svg>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
            Recorded footage
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Not a live feed — this is a recorded video used for detection and analysis.
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-8 py-6 sm:px-12">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[11px] font-medium tracking-wide text-white/70 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          RECORDED FOOTAGE
        </div>
        <p className="hidden text-xs text-white/50 sm:block">Scroll to explore ↓</p>
      </div>
    </section>
  );
}
