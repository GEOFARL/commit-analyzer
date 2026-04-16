import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("dashboard") };
}

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-balance bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          {t("welcome")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("welcomeHelper")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="group relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-transform motion-safe:group-hover:scale-110"
          />
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="mt-3 text-balance">{t("cards.repositories")}</CardTitle>
            <CardDescription>{t("cards.repositoriesHelper")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/repositories">
                {t("ctaRepositories")}
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="group relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-2xl transition-transform motion-safe:group-hover:scale-110"
          />
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="mt-3 text-balance">{t("cards.generate")}</CardTitle>
            <CardDescription>{t("cards.generateHelper")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button size="sm" variant="outline" disabled>
                    {t("cards.comingSoon")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("cards.comingSoonTooltip")}
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
