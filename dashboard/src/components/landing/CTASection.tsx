import Link from "next/link";
import SectionReveal from "./SectionReveal";

export default function CTASection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-3xl px-8 py-32 text-center sm:px-12" id="contact">
      <h2 className="font-serif text-5xl font-semibold text-white sm:text-6xl">
        Let the lot watch itself.
      </h2>
      <p className="mt-5 text-white/60">
        Mater automates the work between detection and dispatch.
      </p>
      <Link
        href="/dashboard"
        className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
      >
        Get started <span aria-hidden="true">→</span>
      </Link>
    </SectionReveal>
  );
}
