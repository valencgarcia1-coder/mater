import Link from "next/link";

type Props = {
  variant?: "solid" | "outline";
  size?: "sm" | "lg";
  className?: string;
};

/**
 * The "spin and invert" hover: a circle scales up from nothing and rotates
 * into place, flipping the button from light-on-dark to dark-on-light (or
 * back) as it sweeps across — rather than a flat color transition.
 */
export default function GetStartedButton({ variant = "solid", size = "lg", className = "" }: Props) {
  const isSolid = variant === "solid";
  const base = isSolid ? "bg-white text-black" : "border border-white/40 text-white";
  const fill = isSolid ? "bg-black" : "bg-white";
  const hoverText = isSolid ? "group-hover:text-white" : "group-hover:text-black";
  const padding = size === "lg" ? "px-6 py-3 text-xs" : "px-4 py-2 text-xs";

  return (
    <Link
      href="/dashboard"
      className={`group relative isolate inline-flex items-center gap-1.5 overflow-hidden rounded-full font-mono uppercase tracking-wider ${base} ${padding} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:scale-100 group-hover:rotate-180 ${fill}`}
      />
      <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-300 ${hoverText}`}>
        Get Started <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
