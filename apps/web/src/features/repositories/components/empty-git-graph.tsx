import { cn } from "@/lib/utils";

export const EmptyGitGraph = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 96 96"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("h-14 w-14", className)}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="empty-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--primary)" />
        <stop offset="100%" stopColor="oklch(0.7 0.22 330)" />
      </linearGradient>
    </defs>
    <g
      stroke="url(#empty-grad)"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    >
      <path
        d="M24 16 V80"
        style={{ ["--dash" as string]: "64" }}
        className="animate-draw-in"
      />
      <path
        d="M24 40 C40 40, 40 56, 56 56 L72 56"
        style={{
          ["--dash" as string]: "64",
          animationDelay: "0.3s",
        }}
        className="animate-draw-in"
      />
      <path
        d="M72 56 V80"
        style={{
          ["--dash" as string]: "24",
          animationDelay: "0.9s",
        }}
        className="animate-draw-in"
      />
    </g>
    <g fill="url(#empty-grad)">
      <circle cx="24" cy="16" r="4" />
      <circle cx="24" cy="40" r="4" />
      <circle cx="24" cy="64" r="4" />
      <circle cx="72" cy="56" r="4" />
      <circle cx="72" cy="80" r="4" />
    </g>
  </svg>
);
