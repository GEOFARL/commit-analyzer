import { GitBranch, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type ActionKey = "connect" | "generate" | "policies" | "llmKeys";

const ACTIONS: Array<{
  key: ActionKey;
  href: "/repositories" | "/generate" | "/policies" | "/settings/llm-keys";
  icon: typeof GitBranch;
  accent: string;
  iconTint: string;
}> = [
  {
    key: "connect",
    href: "/repositories",
    icon: GitBranch,
    accent: "bg-primary/10",
    iconTint: "text-primary",
  },
  {
    key: "generate",
    href: "/generate",
    icon: Sparkles,
    accent: "bg-fuchsia-500/10",
    iconTint: "text-fuchsia-500",
  },
  {
    key: "policies",
    href: "/policies",
    icon: ShieldCheck,
    accent: "bg-emerald-500/10",
    iconTint: "text-emerald-500",
  },
  {
    key: "llmKeys",
    href: "/settings/llm-keys",
    icon: KeyRound,
    accent: "bg-amber-500/10",
    iconTint: "text-amber-500",
  },
];

export const QuickActions = () => {
  const t = useTranslations("dashboard.quickActions");

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ACTIONS.map(({ key, href, icon: Icon, accent, iconTint }) => (
        <li key={key}>
          <Link
            href={href}
            className="group flex h-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent} ${iconTint}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{t(`${key}.title`)}</span>
              <span className="text-xs text-muted-foreground">
                {t(`${key}.description`)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
