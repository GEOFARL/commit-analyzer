export const AuroraBackground = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
  >
    <svg
      className="absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
    >
      <defs>
        <radialGradient id="aurora-a" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aurora-b" cx="0.75" cy="0.65" r="0.55">
          <stop offset="0%" stopColor="oklch(0.72 0.2 330)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.72 0.2 330)" stopOpacity="0" />
        </radialGradient>
        <pattern
          id="aurora-grid"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 48 0 L 0 0 0 48"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.04"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect
        width="1200"
        height="800"
        fill="url(#aurora-grid)"
        className="text-foreground"
      />
      <g className="animate-aurora">
        <ellipse cx="360" cy="240" rx="520" ry="320" fill="url(#aurora-a)" />
      </g>
      <g className="animate-aurora" style={{ animationDelay: "-9s" }}>
        <ellipse cx="900" cy="520" rx="520" ry="320" fill="url(#aurora-b)" />
      </g>
    </svg>
  </div>
);
