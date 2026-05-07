"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STACK = [
  "Next.js 16",
  "NestJS 11",
  "TypeORM",
  "Supabase",
  "Postgres + RLS",
  "Redis",
  "BullMQ",
  "Socket.IO",
  "ts-rest",
  "Zod",
  "Vercel AI SDK",
  "Tailwind CSS 4",
  "shadcn/ui",
  "Recharts",
  "Commander.js",
  "Vitest",
  "Playwright",
  "axe-core",
] as const;

export const LandingStack = () => {
  const root = useRef<HTMLElement>(null);
  const t = useTranslations("landing.stack");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (ctx.conditions?.reduce) return;
          const track = root.current?.querySelector(
            "[data-marquee-track]",
          ) as HTMLElement | null;
          if (!track) return;
          const half = track.scrollWidth / 2;
          gsap.to(track, {
            x: -half,
            duration: 40,
            ease: "none",
            repeat: -1,
            modifiers: {
              x: (value: string) => `${parseFloat(value) % -half}px`,
            },
          });
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="stack"
      className="relative w-full overflow-hidden border-y border-border/40 bg-muted/30 py-12"
    >
      <p className="mx-auto mb-8 max-w-2xl px-6 text-center text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        {t("heading")}
      </p>
      <div
        className="relative [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]"
        aria-hidden="true"
      >
        <div data-marquee-track className="flex w-max gap-3">
          {[...STACK, ...STACK].map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-4 py-2 font-mono text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
