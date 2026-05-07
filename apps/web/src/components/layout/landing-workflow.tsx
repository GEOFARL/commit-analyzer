"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GitBranch, Rocket, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ComponentType } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type StepKey = "connect" | "generate" | "ship";
const ICONS: Record<StepKey, ComponentType<{ className?: string }>> = {
  connect: GitBranch,
  generate: Sparkles,
  ship: Rocket,
};
const STEPS: StepKey[] = ["connect", "generate", "ship"];

export const LandingWorkflow = () => {
  const root = useRef<HTMLElement>(null);
  const t = useTranslations("landing.workflow");

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
            gsap.set("[data-step], [data-workflow-heading]", {
              autoAlpha: 1,
              y: 0,
            });
            gsap.set("[data-progress]", { scaleY: 1 });
            return;
          }
          gsap.set("[data-step]", { autoAlpha: 0, y: 40 });
          gsap.set("[data-workflow-heading]", { autoAlpha: 0, y: 20 });
          gsap.set("[data-progress]", { scaleY: 0, transformOrigin: "top" });

          gsap.to("[data-workflow-heading]", {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: "[data-workflow-heading]",
              start: "top 85%",
              once: true,
            },
          });

          gsap.to("[data-step]", {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.18,
            scrollTrigger: {
              trigger: "[data-steps-list]",
              start: "top 80%",
              once: true,
            },
          });

          gsap.to("[data-progress]", {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-steps-list]",
              start: "top 70%",
              end: "bottom 60%",
              scrub: 0.8,
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
      id="workflow"
      className="relative mx-auto w-full max-w-6xl px-6 py-24"
    >
      <div data-workflow-heading className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {t("heading")}
        </h2>
      </div>
      <ol
        data-steps-list
        className="relative mt-16 grid gap-6 md:grid-cols-3"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary/0 via-border to-primary/0 md:block"
        />
        <span
          aria-hidden="true"
          data-progress
          className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary via-primary/70 to-transparent md:block"
        />
        {STEPS.map((key, i) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              data-step
              className="relative rounded-2xl border border-border/60 bg-card/70 p-7 backdrop-blur-sm"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="font-mono text-sm text-muted-foreground/70">
                  {t("stepLabel", { n: i + 1 })}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold tracking-tight">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`steps.${key}.body`)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
