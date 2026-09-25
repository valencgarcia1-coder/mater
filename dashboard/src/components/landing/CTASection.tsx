import SectionReveal from "./SectionReveal";
import GetStartedButton from "./GetStartedButton";

export default function CTASection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-3xl px-8 py-32 text-center sm:px-12" id="contact">
      <h2 className="font-serif text-5xl font-semibold text-white sm:text-6xl">
        Let the lot watch itself.
      </h2>
      <p className="mt-5 text-white/60">
        Mater automates the work between detection and dispatch.
      </p>
      <GetStartedButton className="mt-9 mx-auto w-fit font-semibold" />
    </SectionReveal>
  );
}
