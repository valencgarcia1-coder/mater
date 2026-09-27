import SectionReveal from "./SectionReveal";

const AUDIENCES = [
  {
    name: "Property managers",
    desc: "Stop relying on tenants to report violations. Every space is watched, every violation is timestamped, and nothing gets towed without your review.",
  },
  {
    name: "Tow operators",
    desc: "Know which lots have towable vehicles before you drive there. Every case comes with evidence attached, so there's no dispute at the curb.",
  },
  {
    name: "HOAs & gated communities",
    desc: "Enforce the rules you already have — fire lanes, guest parking, permit zones — without hiring someone to walk the lot.",
  },
];

export default function WhoItsFor() {
  return (
    <SectionReveal className="relative mx-auto w-full max-w-6xl px-8 py-24 sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[360px] w-[600px] -translate-y-1/4 translate-x-1/4 rounded-full bg-sky-500/10 blur-[110px]"
      />
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">Who it&apos;s for</p>
      <h2 className="mt-4 font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
        Built for whoever&apos;s on the hook when a lot goes unenforced.
      </h2>
      <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
        {AUDIENCES.map((a) => (
          <div key={a.name} className="flex flex-col gap-3">
            <h3 className="text-lg font-medium text-white">{a.name}</h3>
            <p className="text-sm text-white/50">{a.desc}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
