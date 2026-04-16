"use client";

import { Github, Loader2 } from "lucide-react";
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
        {pending ? <Loader2 className="animate-spin" /> : <Github />}
        {t("cta")}
      </Button>
    </form>
  );
};
