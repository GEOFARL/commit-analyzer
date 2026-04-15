import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/layout/logo-mark";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export const Sidebar = async () => {
  const t = await getTranslations("common");

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <LogoMark />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          {t("appName")}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>
      <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/50">
        {t("version")}
      </div>
    </aside>
  );
};
