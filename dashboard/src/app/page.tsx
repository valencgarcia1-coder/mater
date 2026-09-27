import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Intro from "@/components/landing/Intro";
import WhoItsFor from "@/components/landing/WhoItsFor";
import HowItWorks from "@/components/landing/HowItWorks";
import Evidence from "@/components/landing/Evidence";
import Features from "@/components/landing/Features";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen w-full bg-black bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]"
    >
      <Nav />
      <Hero />
      <Intro />
      <WhoItsFor />
      <HowItWorks />
      <Evidence />
      <Features />
      <CTASection />
      <Footer />
    </div>
  );
}
