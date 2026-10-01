import PinnedSection from "./PinnedSection";
import RevealText from "./RevealText";
import TiltCard from "./TiltCard";

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60">
      {children}
    </div>
  );
}

const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.6, className: "h-4 w-4" } as const;

const ITEMS = [
  {
    name: "Automated enforcement",
    desc: "Identify vehicles violating configured rules, around the clock, without someone watching a monitor.",
    big: true,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Evidence",
    desc: "Time-stamped visual evidence for every event.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" />
        <circle cx="12" cy="13" r="3.5" stroke="currentColor" />
        <path d="M8 6 9.5 3.5h5L16 6" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Dispatch",
    desc: "Automatically create and route tow requests.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 16V7a1 1 0 0 1 1-1h9v10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 10h4.4a1 1 0 0 1 .9.55L20 14v2h-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7.5" cy="17" r="1.8" stroke="currentColor" />
        <circle cx="16.5" cy="17" r="1.8" stroke="currentColor" />
      </svg>
    ),
  },
  {
    name: "Fleet intelligence",
    desc: "Understand truck locations and job assignments.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" />
      </svg>
    ),
  },
  {
    name: "Parking analytics",
    desc: "Occupancy, dwell time, and activity over time.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeLinecap="round" />
        <path d="M3 20h18" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
  },
];

const AUDIENCES = [
  {
    name: "Property managers",
    desc: "Every space watched and timestamped — nothing gets towed without your review.",
  },
  {
    name: "Tow operators",
    desc: "Know which lots have towable vehicles, with evidence attached, before you drive there.",
  },
  {
    name: "HOAs & gated communities",
    desc: "Enforce fire lanes, guest parking, and permit zones without hiring someone to walk the lot.",
  },
];

export default function Features() {
  return (
    <PinnedSection
      runwayVh={190}
      id="product"
      className="relative isolate mx-auto w-full max-w-6xl px-8 py-12 sm:px-12"
    >
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[380px] w-[680px]"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-sky-400/15 blur-[95px]"
          style={{ animationDelay: "-9s" }}
        />
      </div>
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-0 bottom-0 -z-10 h-[320px] w-[560px] translate-y-1/3"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-violet-400/12 blur-[90px]"
          style={{ animationDelay: "-16s" }}
        />
      </div>
      <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
        Product
      </p>
      <h2 className="mt-3 font-sans text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
        <RevealText scrubbed text="One system for the entire parking operation." />
      </h2>
      <div className="mt-8 grid gap-3 border-t border-neutral-900 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <TiltCard
            key={item.name}
            data-reveal-item
            className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${
              item.big ? "sm:col-span-2 lg:col-span-2" : ""
            }`}
          >
            <IconWrap>{item.icon}</IconWrap>
            <h3 className={`font-medium text-white ${item.big ? "text-base" : "text-sm"}`}>{item.name}</h3>
            <p className={`text-white/50 ${item.big ? "max-w-sm text-sm" : "text-xs"}`}>{item.desc}</p>
          </TiltCard>
        ))}
      </div>

      <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
        <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40 sm:col-span-3">
          Who it&apos;s for
        </p>
        {AUDIENCES.map((a) => (
          <div key={a.name} data-reveal-item className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-white">{a.name}</h3>
            <p className="text-xs text-white/50">{a.desc}</p>
          </div>
        ))}
      </div>
    </PinnedSection>
  );
}
