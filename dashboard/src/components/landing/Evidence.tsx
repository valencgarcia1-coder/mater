import EvidencePin from "./EvidencePin";

// Real evidence, presented plainly: no bordered app-chrome, no crossfading —
// just the actual frames from a live property, large enough to read. Pinned
// as one block (heading, then the comparison frame) like every other beat.
export default function Evidence() {
  return (
    <div id="evidence">
      <EvidencePin
        eyebrow="Real footage"
        heading="This is a live property, running right now — not a mockup."
        beforeSrc="/landing/detect-frame.jpg"
        beforeAlt="A real daytime camera frame from a live property, with space occupancy detected and labeled"
        beforeLabel="Daytime — every space labeled"
        afterSrc="/landing/verify-frame.jpg"
        afterAlt="The same lot at night, with one space flagged as occupied past its allowed time"
        afterLabel="Night — a violation held long enough to confirm"
      />
    </div>
  );
}
