"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const ThemeToggle = () => {
  const { setTheme } = useTheme();
  const t = useTranslations("userMenu");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("theme")}
          aria-hidden={!mounted}
          tabIndex={mounted ? undefined : -1}
        >
          <Sun className="rotate-0 scale-100 transition-[transform] dark:-rotate-90 dark:scale-0" aria-hidden="true" />
          <Moon className="absolute rotate-90 scale-0 transition-[transform] dark:rotate-0 dark:scale-100" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      {mounted ? (
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun /> {t("themeLight")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon /> {t("themeDark")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor /> {t("themeSystem")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
};
