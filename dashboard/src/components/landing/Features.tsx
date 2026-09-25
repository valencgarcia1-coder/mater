import SectionReveal from "./SectionReveal";

const ITEMS = [
  { name: "Automated enforcement", desc: "Identify vehicles violating configured rules." },
  { name: "Evidence", desc: "Time-stamped visual evidence for every event." },
  { name: "Dispatch", desc: "Automatically create and route tow requests." },
  { name: "Fleet intelligence", desc: "Understand truck locations and job assignments." },
  { name: "Parking analytics", desc: "Occupancy, dwell time, and activity over time." },
];

export default function Features() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12" id="product">
      <h2 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
        One system for the entire parking operation.
      </h2>
      <div className="mt-14 grid gap-8 border-t border-neutral-900 pt-10 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.name}>
            <h3 className="text-sm font-medium text-white">{item.name}</h3>
            <p className="mt-2 text-sm text-white/50">{item.desc}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
