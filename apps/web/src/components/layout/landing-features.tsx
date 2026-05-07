"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BarChart3,
  KeyRound,
  ListChecks,
  Lock,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ComponentType } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type FeatureKey =
  | "generate"
  | "analytics"
  | "policies"
  | "cli"
  | "providers"
  | "security";

const ICONS: Record<FeatureKey, ComponentType<{ className?: string }>> = {
  generate: Sparkles,
  analytics: BarChart3,
  policies: ListChecks,
  cli: TerminalSquare,
  providers: KeyRound,
  security: Lock,
};

const FEATURES: FeatureKey[] = [
  "generate",
  "analytics",
  "policies",
  "cli",
  "providers",
  "security",
];

export const LandingFeatures = () => {
  const root = useRef<HTMLElement>(null);
  const t = useTranslations("landing.features");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (ctx.conditions?.reduce) {
            gsap.set("[data-feature-card], [data-feature-heading]", {
              autoAlpha: 1,
              y: 0,
            });
            return;
          }
          gsap.set("[data-feature-card]", { autoAlpha: 0, y: 32 });
          gsap.set("[data-feature-heading]", { autoAlpha: 0, y: 20 });

          gsap.to("[data-feature-heading]", {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: "[data-feature-heading]",
              start: "top 85%",
              once: true,
            },
          });

          ScrollTrigger.batch("[data-feature-card]", {
            start: "top 85%",
            once: true,
            onEnter: (els) => {
              gsap.to(els, {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: "power3.out",
                stagger: 0.1,
                overwrite: true,
              });
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
      id="features"
      className="relative mx-auto w-full max-w-7xl px-6 py-24"
    >
      <div data-feature-heading className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {t("heading")}
        </h2>
        <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
          {t("subheading")}
        </p>
      </div>
      <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((key, i) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              data-feature-card
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold tracking-tight">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`items.${key}.body`)}
              </p>
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span
                aria-hidden="true"
                className="absolute right-5 top-5 font-mono text-xs text-muted-foreground/60"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
