import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import GlowBackground from "@/components/landing/GlowBackground";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <GlowBackground />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <HowItWorks />
        <Features />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
