"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/layout/logo-mark";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePathname } from "@/i18n/navigation";

export const MobileSidebar = () => {
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tNav("openMenu")}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col p-0">
        <SheetHeader>
          <LogoMark />
          <SheetTitle>{tCommon("appName")}</SheetTitle>
        </SheetHeader>
        <SheetDescription className="sr-only">
          {tNav("openMenu")}
        </SheetDescription>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/50">
          {tCommon("version")}
        </div>
      </SheetContent>
    </Sheet>
  );
};
