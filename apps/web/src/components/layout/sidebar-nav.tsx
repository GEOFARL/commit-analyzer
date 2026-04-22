"use client";

import {
  GitBranch,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: "/dashboard" | "/repositories" | "/generate" | "/policies" | "/settings";
  icon: LucideIcon;
  labelKey: "dashboard" | "repositories" | "generate" | "policies" | "settings";
  isActive: (pathname: string) => boolean;
};

// A nested policies subtree (/repositories/:id/policies[/:policyId]) belongs to
// the Policies nav entry, not Repositories.
const policyPathRe = /(^|\/)policies(\/|$)/;
const repoPathRe = /^\/repositories(\/|$)/;

const startsWithMatcher = (href: string) => (p: string) =>
  p === href || p.startsWith(`${href}/`);

const items: NavItem[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    labelKey: "dashboard",
    isActive: startsWithMatcher("/dashboard"),
  },
  {
    href: "/repositories",
    icon: GitBranch,
    labelKey: "repositories",
    isActive: (p) => repoPathRe.test(p) && !policyPathRe.test(p),
  },
  {
    href: "/generate",
    icon: Sparkles,
    labelKey: "generate",
    isActive: startsWithMatcher("/generate"),
  },
  {
    href: "/policies",
    icon: ShieldCheck,
    labelKey: "policies",
    isActive: (p) => policyPathRe.test(p),
  },
  {
    href: "/settings",
    icon: Settings,
    labelKey: "settings",
    isActive: startsWithMatcher("/settings"),
  },
];

export const SidebarNav = () => {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map(({ href, icon: Icon, labelKey, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active &&
                "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-[opacity,transform]",
                active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0",
              )}
              aria-hidden="true"
            />
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};
