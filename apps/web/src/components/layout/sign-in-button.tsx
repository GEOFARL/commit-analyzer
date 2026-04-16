"use client";

import { ArrowRight, Github, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export const SignInButton = () => {
  const t = useTranslations("landing");
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/auth/sign-in"
      method="post"
      onSubmit={() => setPending(true)}
    >
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Github aria-hidden="true" />}
        {t("cta")}
        {!pending && <ArrowRight aria-hidden="true" />}
      </Button>
    </form>
  );
};
