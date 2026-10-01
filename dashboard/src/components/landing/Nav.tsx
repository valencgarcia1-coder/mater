import GetStartedButton from "./GetStartedButton";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Evidence", href: "#evidence" },
];

export default function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-10 py-8 sm:px-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mater-mark.svg" alt="Mater" className="h-11 w-auto" />
      <div className="flex items-center gap-9">
        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="font-mono text-xs uppercase tracking-wider text-white/70 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
        <GetStartedButton variant="outline" size="sm" />
      </div>
    </header>
  );
}
