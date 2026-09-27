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
    <div className="relative min-h-screen w-full bg-black">
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
