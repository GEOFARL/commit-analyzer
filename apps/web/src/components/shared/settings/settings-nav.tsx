"use client";

import {
  Activity,
  KeyRound,
  KeySquare,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Item = {
  href:
    | "/settings"
    | "/settings/api-keys"
    | "/settings/llm-keys"
    | "/settings/default-policy"
    | "/settings/activity";
  labelKey: "profile" | "apiKeys" | "llmKeys" | "defaultPolicy" | "activity";
  icon: LucideIcon;
  exact: boolean;
};

const items: Item[] = [
  { href: "/settings", labelKey: "profile", icon: User, exact: true },
  {
    href: "/settings/api-keys",
    labelKey: "apiKeys",
    icon: KeySquare,
    exact: false,
  },
  {
    href: "/settings/llm-keys",
    labelKey: "llmKeys",
    icon: KeyRound,
    exact: false,
  },
  {
    href: "/settings/default-policy",
    labelKey: "defaultPolicy",
    icon: ShieldCheck,
    exact: false,
  },
  {
    href: "/settings/activity",
    labelKey: "activity",
    icon: Activity,
    exact: false,
  },
];

export const SettingsNav = () => {
  const pathname = usePathname();
  const t = useTranslations("settings.nav");

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1"
    >
      {items.map(({ href, labelKey, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};
