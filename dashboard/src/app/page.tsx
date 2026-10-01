import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Intro from "@/components/landing/Intro";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Evidence from "@/components/landing/Evidence";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

// A single story, front to back: hook (Hero) → the industry problem (Intro)
// → what we do (Features, now including who it's for) → how it solves it
// (HowItWorks) → proof it's real (Evidence, pinned) → close (CTASection,
// now carrying the mission line that used to be its own About section).
// Nav anchors match this order so jumping forward never scrolls backward.
export default function LandingPage() {
  return (
    <div
      className="landing-grid landing-noise relative min-h-screen w-full overflow-x-hidden bg-black bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]"
    >
      <Nav />
      <Hero />
      <Intro />
      <Features />
      <HowItWorks />
      <Evidence />
      <CTASection />
      <Footer />
    </div>
  );
}
