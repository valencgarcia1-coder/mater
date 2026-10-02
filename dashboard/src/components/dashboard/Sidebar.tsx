"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <path d="M4 12 12 4l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  properties: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
      <rect x="3" y="4" width="8" height="8" rx="1.5" stroke="currentColor" />
      <rect x="13" y="4" width="8" height="8" rx="1.5" stroke="currentColor" />
      <rect x="3" y="14" width="8" height="6" rx="1.5" stroke="currentColor" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" stroke="currentColor" />
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
  href: string;
  soon?: boolean;
};

// The Overview page itself is the property map now, so there's no separate
// Camera Map nav item — Properties/[id] carries each property's own cameras.
const ITEMS: Item[] = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "properties", label: "Properties", href: "/dashboard/properties" },
  { key: "reports", label: "Reports", href: "/dashboard/reports" },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
];

export default function Sidebar({ violationCount }: { violationCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-white/10 px-3 py-5">
      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const badge = item.key === "overview" ? violationCount : null;
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
          const active =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${base} ${
                active
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
