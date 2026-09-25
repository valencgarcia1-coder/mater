import Link from "next/link";

export default function Nav() {
  return (
    <nav className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black text-xs font-bold">
          M
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">Mater</span>
      </div>
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 transition-colors hover:text-white"
        >
          Live dashboard
        </Link>
        <a
          href="#contact"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          Get in touch
        </a>
      </div>
    </nav>
  );
}
