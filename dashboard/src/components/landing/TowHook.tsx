type TowHookProps = {
  className?: string;
  cableLength?: number;
};

/** The recurring tow-hook motif: a braided cable dropping into a steel hook. */
export default function TowHook({ className, cableLength = 220 }: TowHookProps) {
  return (
    <svg
      className={className}
      width="90"
      height={cableLength + 100}
      viewBox={`0 0 90 ${cableLength + 100}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hookMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f2f2" />
          <stop offset="45%" stopColor="#9a9a9a" />
          <stop offset="55%" stopColor="#5a5a5a" />
          <stop offset="100%" stopColor="#242424" />
        </linearGradient>
        <filter id="hookShadow" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter="url(#hookShadow)">
        <line
          x1="32"
          y1="0"
          x2="32"
          y2={cableLength}
          stroke="url(#hookMetal)"
          strokeWidth="6.5"
          strokeLinecap="round"
        />

        <g transform={`translate(32 ${cableLength})`}>
          <circle cx="0" cy="7" r="9" fill="none" stroke="url(#hookMetal)" strokeWidth="5.5" />
          <path
            d="M 0 14
               L 0 50
               C 0 84, 40 86, 41 55
               C 41.5 35, 19 27, 17 44"
            fill="none"
            stroke="url(#hookMetal)"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
