import { Github } from "lucide-react";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuroraBackground } from "@/components/layout/aurora-background";
import { LogoMark } from "@/components/layout/logo-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <>
      <AuroraBackground />
      <main className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <LogoMark className="h-10 w-10" />
            <CardTitle className="mt-3 text-2xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/auth/sign-in" method="post">
              <Button type="submit" size="lg" className="w-full">
                <Github />
                {t("continueWithGithub")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
