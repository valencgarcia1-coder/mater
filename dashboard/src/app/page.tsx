import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Intro from "@/components/landing/Intro";
import Features from "@/components/landing/Features";
import Evidence from "@/components/landing/Evidence";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

// A single story, front to back: hook + how it solves it (Hero — the video
// shrinks into a framed clip and the "how it works" steps fill in beside
// it, one continuous pinned sequence, no second section) → the industry
// problem (Intro) → what we do (Features, including who it's for) → proof
// it's real (Evidence, pinned) → close (CTASection, carrying the mission
// line that used to be its own About section).
// Nav anchors match this order so jumping forward never scrolls backward.
export default function LandingPage() {
  return (
    <div
      className="landing-grid landing-noise relative min-h-screen w-full overflow-x-hidden bg-[#0a0a0c] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"
    >
      <Nav />
      <Hero />
      <Intro />
      <Features />
      <Evidence />
      <CTASection />
      <Footer />
    </div>
  );
}
