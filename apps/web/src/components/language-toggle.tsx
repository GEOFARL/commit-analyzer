"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageToggle() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: (typeof routing.locales)[number]) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <nav aria-label={t("language")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          disabled={l === locale || isPending}
          onClick={() => switchTo(l)}
        >
          {t(`switchTo.${l}`)}
        </button>
      ))}
    </nav>
  );
}
