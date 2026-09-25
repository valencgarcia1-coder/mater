const CARS: { x: number; y: number; w: number; rot: number; color: string; label: string }[] = [
  { x: 8, y: 78, w: 7.5, rot: -6, color: "#e64ac0", label: "#41" },
  { x: 17, y: 82, w: 7, rot: -4, color: "#e0c23a", label: "#5" },
  { x: 27, y: 85, w: 7, rot: -2, color: "#3ac2e0", label: "#4" },
  { x: 37, y: 74, w: 7, rot: -3, color: "#e0673a", label: "#3" },
  { x: 46, y: 68, w: 6.5, rot: -1, color: "#3ae06b", label: "#9" },
  { x: 55, y: 63, w: 6.5, rot: 1, color: "#3a6be0", label: "#11" },
  { x: 64, y: 60, w: 6.5, rot: 2, color: "#e0e03a", label: "#15" },
  { x: 73, y: 63, w: 6.5, rot: 3, color: "#3ae0c2", label: "#27" },
  { x: 81, y: 68, w: 6.5, rot: 4, color: "#c23ae0", label: "#23" },
  { x: 89, y: 74, w: 7, rot: 5, color: "#8a8ae0", label: "#10" },
  { x: 30, y: 92, w: 7.5, rot: -1, color: "#e03a3a", label: "#1" },
  { x: 40, y: 90, w: 7, rot: 0, color: "#e0d43a", label: "#2" },
  { x: 60, y: 88, w: 7, rot: 1, color: "#3ae0a8", label: "#6" },
  { x: 70, y: 90, w: 7, rot: -1, color: "#e08a3a", label: "#8" },
];

/**
 * Stylized stand-in for the hero shot: a vector scene evoking the real
 * annotated lot footage (mountains, asphalt, outlined vehicles) without
 * claiming to be a photo. Swapped for a real clip via HeroVisual once one
 * is cleared for public use.
 */
export default function HeroIllustration() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d1b2a]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#243a52" />
            <stop offset="55%" stopColor="#3c5872" />
            <stop offset="100%" stopColor="#5c7a8f" />
          </linearGradient>
          <linearGradient id="lot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2f33" />
            <stop offset="100%" stopColor="#1a1c1f" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="100" height="62" fill="url(#sky)" />

        <polygon
          points="0,48 12,30 22,40 34,24 48,42 58,28 70,38 82,26 92,40 100,32 100,52 0,52"
          fill="#5c7a94"
          opacity="0.55"
        />
        <polygon
          points="0,52 15,36 28,46 42,32 55,48 68,34 80,44 92,34 100,44 100,55 0,55"
          fill="#3f5a70"
          opacity="0.75"
        />
        <rect x="0" y="53" width="100" height="4" fill="#26363f" />

        <polygon points="0,100 100,100 100,50 0,68" fill="url(#lot)" />

        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line
            key={i}
            x1={50 + (i - 4) * 5.4}
            y1="58"
            x2={50 + (i - 4) * 16}
            y2="100"
            stroke="#e8b23a"
            strokeWidth="0.35"
            opacity="0.5"
          />
        ))}
      </svg>

      {CARS.map((car) => (
        <div
          key={car.label}
          className="absolute flex flex-col items-center"
          style={{ left: `${car.x}%`, top: `${car.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <span
            className="mb-1 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none text-black shadow-sm"
            style={{ backgroundColor: car.color }}
          >
            {car.label}
          </span>
          <div
            className="rounded-[3px]"
            style={{
              width: `${car.w}vw`,
              height: `${car.w * 0.55}vw`,
              border: `1.5px solid ${car.color}`,
              transform: `rotate(${car.rot}deg)`,
              background: "rgba(20,20,24,0.35)",
            }}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
    </div>
  );
}
