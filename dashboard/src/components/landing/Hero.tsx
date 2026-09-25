import HeroVisual from "./HeroVisual";
import RotatingWord from "./RotatingWord";
import GetStartedButton from "./GetStartedButton";

export default function Hero() {
  return (
    <section className="relative h-screen min-h-[720px] w-full overflow-hidden bg-black">
      <HeroVisual />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />

      <div className="relative z-20 flex h-full flex-col justify-center px-10 sm:px-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
          AI-Powered Towing Infrastructure
        </p>
        <h1 className="mt-6 font-sans text-6xl font-normal leading-[1.08] tracking-tight text-white sm:text-7xl">
          Towing should be
          <br />
          <RotatingWord />
        </h1>
        <p className="mt-8 max-w-sm text-base font-light text-white/60">
          Mater automatically detects vehicles that need to be towed and dispatches the nearest
          available truck.
        </p>
        <GetStartedButton className="mt-10 w-fit" />
      </div>
    </section>
  );
}
