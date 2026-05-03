import { ArrowRight, Github } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export const SignInButton = async () => {
  const t = await getTranslations("landing");
  return (
    <form action="/auth/sign-in" method="post">
      <Button type="submit" size="lg">
        <Github aria-hidden="true" />
        {t("cta")}
        <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
};
