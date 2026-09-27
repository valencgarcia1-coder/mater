import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import PipelineSection from "@/components/landing/PipelineSection";
import FullLoopSection from "@/components/landing/FullLoopSection";
import Features from "@/components/landing/Features";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full bg-black">
      <Nav />
      <Hero />
      <PipelineSection />
      <FullLoopSection />
      <Features />
      <CTASection />
      <Footer />
    </div>
  );
}
