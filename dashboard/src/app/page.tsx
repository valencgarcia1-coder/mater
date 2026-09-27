import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Intro from "@/components/landing/Intro";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import WhoItsFor from "@/components/landing/WhoItsFor";
import Evidence from "@/components/landing/Evidence";
import About from "@/components/landing/About";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

// Section order matches the nav's left-to-right order (Product → How It
// Works → About), so jumping to any anchor scrolls forward, never back up
// the page.
export default function LandingPage() {
  return (
    <div
      className="landing-grid relative min-h-screen w-full overflow-x-hidden bg-black bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]"
    >
      <Nav />
      <Hero />
      <Intro />
      <Features />
      <HowItWorks />
      <WhoItsFor />
      <About />
      <Evidence />
      <CTASection />
      <Footer />
    </div>
  );
}
