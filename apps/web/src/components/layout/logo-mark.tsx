import { cn } from "@/lib/utils";

export const LogoMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("h-8 w-8", className)}
  >
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--primary)" />
        <stop offset="100%" stopColor="oklch(0.7 0.22 330)" />
      </linearGradient>
    </defs>
    <rect
      x="1"
      y="1"
      width="38"
      height="38"
      rx="10"
      stroke="url(#logo-grad)"
      strokeWidth="2"
      style={{ ["--dash" as string]: "152" }}
      className="animate-draw-in"
    />
    <path
      d="M14 15 L9 20 L14 25"
      stroke="url(#logo-grad)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ["--dash" as string]: "30" }}
      className="animate-draw-in"
    />
    <path
      d="M26 15 L31 20 L26 25"
      stroke="url(#logo-grad)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ["--dash" as string]: "30" }}
      className="animate-draw-in"
    />
    <circle
      cx="20"
      cy="20"
      r="1.8"
      fill="url(#logo-grad)"
      className="animate-pulse-ring origin-center"
    />
  </svg>
);
