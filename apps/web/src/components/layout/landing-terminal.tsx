"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export const LandingTerminal = ({ className }: { className?: string }) => {
  const root = useRef<HTMLDivElement>(null);
  const t = useTranslations("landing.terminal");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const reduce = ctx.conditions?.reduce;
          gsap.set("[data-line]", { autoAlpha: 0, y: 8 });
          if (reduce) {
            gsap.set("[data-line]", { autoAlpha: 1, y: 0 });
            return;
          }
          const tl = gsap.timeline({
            defaults: { ease: "power2.out" },
            delay: 0.6,
          });
          tl.to("[data-line='cmd']", {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
          })
            .to(
              "[data-line='diff']",
              { autoAlpha: 1, y: 0, duration: 0.45 },
              "+=0.3",
            )
            .to(
              "[data-line='thinking']",
              { autoAlpha: 1, y: 0, duration: 0.45 },
              "+=0.3",
            )
            .to(
              "[data-line='r1'], [data-line='r2'], [data-line='r3']",
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                stagger: 0.25,
              },
              "+=0.3",
            );

          gsap.to("[data-line='thinking'] [data-dot]", {
            autoAlpha: 0.2,
            duration: 0.4,
            ease: "sine.inOut",
            stagger: { each: 0.18, repeat: -1, yoyo: true },
          });
        },
      );
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      data-anim="terminal"
      className={cn(
        "relative isolate w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-2xl shadow-primary/10 backdrop-blur",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">
          {t("title")}
        </span>
      </div>
      <div className="space-y-2 p-5 font-mono text-sm leading-relaxed">
        <p data-line="cmd" className="text-foreground">
          <span className="text-primary">{t("prompt")}</span>{" "}
          <span className="text-muted-foreground">{t("command")}</span>{" "}
          <span className="text-foreground">{t("subcommand")}</span>{" "}
          <span className="text-muted-foreground">{t("flag")}</span>
          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
        </p>
        <p data-line="diff" className="text-muted-foreground">
          <span className="text-emerald-500">{t("plus")}</span> {t("diff")}
        </p>
        <p
          data-line="thinking"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          {t("thinking")}
          <span className="inline-flex gap-1">
            <span data-dot className="h-1 w-1 rounded-full bg-primary/70" />
            <span data-dot className="h-1 w-1 rounded-full bg-primary/70" />
            <span data-dot className="h-1 w-1 rounded-full bg-primary/70" />
          </span>
        </p>
        <p data-line="r1" className="text-foreground">
          <span className="text-emerald-500">{t("arrow")}</span> {t("result1")}
        </p>
        <p data-line="r2" className="text-foreground">
          <span className="text-emerald-500">{t("arrow")}</span> {t("result2")}
        </p>
        <p data-line="r3" className="text-foreground">
          <span className="text-emerald-500">{t("arrow")}</span> {t("result3")}
        </p>
      </div>
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
    </div>
  );
};
