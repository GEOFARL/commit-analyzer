"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Github } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const LandingCta = () => {
  const root = useRef<HTMLElement>(null);
  const t = useTranslations("landing.finalCta");

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
            gsap.set("[data-cta]", { autoAlpha: 1, y: 0 });
            return;
          }
          gsap.set("[data-cta]", { autoAlpha: 0, y: 30 });
          gsap.to("[data-cta]", {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: {
              trigger: root.current,
              start: "top 80%",
              once: true,
            },
          });
          gsap.to("[data-glow]", {
            backgroundPosition: "200% center",
            duration: 8,
            ease: "none",
            repeat: -1,
          });
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="cta"
      className="relative mx-auto w-full max-w-6xl px-6 py-28"
    >
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 px-8 py-16 text-center shadow-2xl shadow-primary/10 sm:px-16">
        <span
          aria-hidden="true"
          data-glow
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "linear-gradient(120deg, transparent 0%, oklch(0.72 0.2 295 / 0.18) 25%, oklch(0.72 0.2 330 / 0.18) 55%, transparent 90%)",
            backgroundSize: "200% 100%",
          }}
        />
        <h2
          data-cta
          className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
        >
          {t("heading")}
        </h2>
        <p
          data-cta
          className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          {t("body")}
        </p>
        <div
          data-cta
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <form action="/auth/sign-in" method="post">
            <Button
              type="submit"
              size="lg"
              className="group h-12 rounded-full px-8 text-base shadow-lg shadow-primary/20"
            >
              <Github aria-hidden="true" />
              {t("primary")}
              <ArrowRight
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Button>
          </form>
          <code className="rounded-full border border-border/60 bg-background/60 px-5 py-3 font-mono text-sm text-muted-foreground">
            {t("secondary")}
          </code>
        </div>
      </div>
    </section>
  );
};
