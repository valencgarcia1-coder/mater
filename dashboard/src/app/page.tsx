import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import DetectSection from "@/components/landing/DetectSection";
import VerifySection from "@/components/landing/VerifySection";
import DispatchSection from "@/components/landing/DispatchSection";
import FullLoopSection from "@/components/landing/FullLoopSection";
import Features from "@/components/landing/Features";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full bg-black">
      <Nav />
      <Hero />
      <DetectSection />
      <VerifySection />
      <DispatchSection />
      <FullLoopSection />
      <Features />
      <CTASection />
      <Footer />
    </div>
  );
}
