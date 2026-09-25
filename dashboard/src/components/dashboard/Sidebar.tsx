"use client";

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <path d="M4 12 12 4l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  feeds: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" />
      <path d="M21 9.5 17 12l4 2.5v-5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  violations: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" stroke="currentColor" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="12" cy="12" r="3" stroke="currentColor" />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"
        stroke="currentColor"
      />
    </svg>
  ),
};

type Item = {
  key: keyof typeof ICONS;
  label: string;
  active?: boolean;
  soon?: boolean;
};

const ITEMS: Item[] = [
  { key: "overview", label: "Overview", active: true },
  { key: "feeds", label: "Live Feeds", soon: true },
  { key: "violations", label: "Violations" },
  { key: "map", label: "Camera Map", soon: true },
  { key: "reports", label: "Reports", soon: true },
  { key: "settings", label: "Settings", soon: true },
];

export default function Sidebar({
  violationCount,
  connected,
}: {
  violationCount: number;
  connected: boolean;
}) {
  return (
    <aside className="flex w-56 flex-shrink-0 flex-col justify-between border-r border-white/10 px-3 py-5">
      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const badge = item.key === "violations" ? violationCount : null;
          const base =
            "flex items-center gap-3 rounded-xl px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors";
          if (item.soon) {
            return (
              <div
                key={item.key}
                title="Coming soon"
                className={`${base} cursor-default text-white/25`}
              >
                {ICONS[item.key]}
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <button
              key={item.key}
              className={`${base} text-left ${
                item.active
                  ? "bg-white/[0.06] text-white"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              {ICONS[item.key]}
              <span className="flex-1">{item.label}</span>
              {badge !== null && badge > 0 && (
                <span className="rounded-full bg-red-500/90 px-1.5 py-0.5 text-[9px] text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-white/50">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-white/20"}`} />
        {connected ? "System online" : "Connecting"}
      </div>
    </aside>
  );
}
