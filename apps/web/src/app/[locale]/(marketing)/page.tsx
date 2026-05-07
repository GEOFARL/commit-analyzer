import { type Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { AuroraBackground } from "@/components/layout/aurora-background";
import { LandingCta } from "@/components/layout/landing-cta";
import { LandingFeatures } from "@/components/layout/landing-features";
import { LandingFooter } from "@/components/layout/landing-footer";
import { LandingHero } from "@/components/layout/landing-hero";
import { LandingStack } from "@/components/layout/landing-stack";
import { LandingWorkflow } from "@/components/layout/landing-workflow";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <AuroraBackground />
      <main id="main-content" className="relative flex min-h-screen flex-col">
        <LandingHero />
        <LandingStack />
        <LandingFeatures />
        <LandingWorkflow />
        <LandingCta />
        <LandingFooter />
      </main>
    </>
  );
}
