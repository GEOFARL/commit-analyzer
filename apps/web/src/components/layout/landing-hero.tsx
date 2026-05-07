"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, Github, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { LogoMark } from "@/components/layout/logo-mark";
import { Button } from "@/components/ui/button";

import { LandingTerminal } from "./landing-terminal";

gsap.registerPlugin(useGSAP);

export const LandingHero = () => {
  const root = useRef<HTMLDivElement>(null);
  const t = useTranslations("landing");
  const [copied, setCopied] = useState(false);

  const titleWords = t("title").split(" ");

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
            return;
          }
          gsap.set(
            "[data-anim='eyebrow'], [data-anim='title-word'], [data-anim='subtitle'], [data-anim='trust'] > *, [data-anim='terminal']",
            { autoAlpha: 0, y: 16 },
          );
          gsap.set("[data-anim='cta-item']", { y: 16 });
          const tl = gsap.timeline({
            defaults: { ease: "power3.out", duration: 0.8 },
          });
          tl.to("[data-anim='eyebrow']", {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
          })
            .to(
              "[data-anim='title-word']",
              {
                autoAlpha: 1,
                y: 0,
                stagger: 0.07,
                ease: "expo.out",
                duration: 0.9,
              },
              "-=0.3",
            )
            .to(
              "[data-anim='subtitle']",
              { autoAlpha: 1, y: 0, duration: 0.6 },
              "-=0.5",
            )
            .to(
              "[data-anim='cta-item']",
              { y: 0, stagger: 0.1, duration: 0.55 },
              "-=0.3",
            )
            .to(
              "[data-anim='trust'] > *",
              { autoAlpha: 1, y: 0, stagger: 0.07, duration: 0.45 },
              "-=0.25",
            )
            .to(
              "[data-anim='terminal']",
              { autoAlpha: 1, y: 0, duration: 0.9 },
              "-=0.7",
            );
        },
      );
    },
    { scope: root },
  );

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(t("cliCommand"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => undefined);
  };

  return (
    <section
      ref={root}
      className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 pb-20 pt-28 sm:pt-32 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-40"
    >
      <div className="flex flex-col items-start gap-7">
        <div
          data-anim="eyebrow"
          className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary"
        >
          <LogoMark className="h-4 w-4" />
          <span className="uppercase tracking-widest">{t("appName")}</span>
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]">
          {titleWords.map((word, i) => (
            <span key={`${word}-${i}`} className="inline-block">
              <span
                data-anim="title-word"
                className="inline-block bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent"
              >
                {word}
              </span>
              {i < titleWords.length - 1 ? <span> </span> : null}
            </span>
          ))}
        </h1>
        <p
          data-anim="subtitle"
          className="max-w-xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          {t("tagline")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form
            data-anim="cta-item"
            action="/auth/sign-in"
            method="post"
          >
            <Button
              type="submit"
              size="lg"
              className="group h-12 rounded-full px-7 text-base shadow-lg shadow-primary/20"
            >
              <Github aria-hidden="true" />
              {t("cta")}
              <ArrowRight
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Button>
          </form>
          <Button
            data-anim="cta-item"
            type="button"
            variant="outline"
            size="lg"
            onClick={handleCopy}
            className="h-12 rounded-full px-6 font-mono text-sm"
          >
            <Terminal aria-hidden="true" />
            {copied ? t("copied") : t("cliCommand")}
          </Button>
        </div>
        <ul
          data-anim="trust"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
        >
          <li className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("trust.openSource")}
          </li>
          <li className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t("trust.models")}
          </li>
          <li className="inline-flex items-center gap-2">
            <Terminal className="size-4 text-primary" aria-hidden="true" />
            {t("trust.selfHostable")}
          </li>
        </ul>
      </div>
      <div className="relative flex min-h-[24rem] items-center justify-center lg:justify-end">
        <div
          aria-hidden="true"
          className="absolute -inset-12 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-transparent blur-3xl"
        />
        <LandingTerminal />
      </div>
    </section>
  );
};
