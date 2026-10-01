const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Product", href: "#product" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Evidence", href: "#evidence" },
    ],
  },
  {
    heading: "Account",
    links: [{ label: "Log In", href: "/login" }],
  },
];

// Only columns/links to pages that actually exist — no Resources, Legal, or
// social row, since there's no blog, docs, terms/privacy pages, or social
// accounts to point to yet. No separate Company/About column either — the
// mission line now lives inline in the closing section, not as its own
// destination. Add a column back once the thing it links to is real.
export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mater-mark.svg" alt="" className="h-7 w-auto" />
            <span className="font-serif text-2xl italic font-medium tracking-tight text-white">Mater</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/65">
            Camera-based detection and human-reviewed enforcement for private parking lots.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-xs uppercase tracking-wider text-white/55">{col.heading}</h3>
            <nav className="mt-4 flex flex-col gap-3">
              {col.links.map(({ label, href }) => (
                <a key={label} href={href} className="text-sm text-white/72 transition-colors hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-col gap-3 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs uppercase tracking-wider text-white/45">
          © 2026 Mater. All rights reserved.
        </p>
        <p className="font-mono text-xs uppercase tracking-wider text-white/45">AI-powered towing infrastructure</p>
      </div>
    </footer>
  );
}
