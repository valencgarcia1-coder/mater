import SectionReveal from "./SectionReveal";

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
    desc: "Identify vehicles violating configured rules.",
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

export default function Features() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12" id="product">
      <h2
        data-reveal-item
        className="font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
      >
        One system for the entire parking operation.
      </h2>
      <div className="mt-14 grid gap-10 border-t border-neutral-900 pt-10 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.name} data-reveal-item className="flex flex-col gap-3">
            <IconWrap>{item.icon}</IconWrap>
            <h3 className="text-sm font-medium text-white">{item.name}</h3>
            <p className="text-sm text-white/50">{item.desc}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
