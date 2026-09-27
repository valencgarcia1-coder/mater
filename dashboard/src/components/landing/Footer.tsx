const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mater-mark.svg" alt="" className="h-7 w-auto" />
        <span className="font-serif text-2xl italic font-medium tracking-tight text-white">Mater</span>
      </div>
      <nav className="mt-6 flex flex-wrap gap-6">
        {LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="font-mono text-xs uppercase tracking-wider text-white/50 transition-colors hover:text-white"
          >
            {label}
          </a>
        ))}
      </nav>
      <p className="mt-8 font-mono text-xs uppercase tracking-wider text-white/30">© 2026 Mater</p>
    </footer>
  );
}
