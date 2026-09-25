const LINKS = ["Product", "Fleet", "Pricing", "About"];

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <span className="font-serif text-2xl text-white">mater</span>
      <nav className="mt-6 flex flex-wrap gap-6">
        {LINKS.map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
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
