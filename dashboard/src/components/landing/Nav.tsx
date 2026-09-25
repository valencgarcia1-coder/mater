import Link from "next/link";

const LINKS = ["Product", "Fleet", "Pricing", "About"];

export default function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-8 py-7 sm:px-12">
      <span className="font-serif text-2xl tracking-tight text-white">mater</span>
      <nav className="hidden items-center gap-9 md:flex">
        {LINKS.map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            className="text-sm text-white/80 transition-colors hover:text-white"
          >
            {label}
          </a>
        ))}
      </nav>
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.03]"
      >
        Get Started <span aria-hidden="true">→</span>
      </Link>
    </header>
  );
}
