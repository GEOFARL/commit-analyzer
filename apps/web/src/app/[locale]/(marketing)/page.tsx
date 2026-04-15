import { ArrowRight, Github, Sparkles } from "lucide-react";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuroraBackground } from "@/components/layout/aurora-background";
import { LogoMark } from "@/components/layout/logo-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <>
      <AuroraBackground />
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Commit Analyzer
            </span>
          </div>
          <Badge variant="default" className="gap-1.5">
            <Sparkles className="h-3 w-3" /> Phase 1 · beta
          </Badge>
          <h1 className="max-w-3xl bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("tagline")}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <form action="/auth/sign-in" method="post">
              <Button type="submit" size="lg">
                <Github />
                {t("cta")}
                <ArrowRight />
              </Button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
