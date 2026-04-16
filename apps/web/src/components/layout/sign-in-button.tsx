import { ArrowRight, Github } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export const SignInButton = async () => {
  const t = await getTranslations("landing");
  return (
    <Button asChild size="lg">
      <Link href="/login">
        <Github aria-hidden="true" />
        {t("cta")}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
};
