"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

const initialsFor = (name: string | null, email: string | null): string => {
  const source = name ?? email ?? "";
  const parts = source.trim().split(/\s+/u);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
};

export const UserMenu = ({ email, name, avatarUrl }: UserMenuProps) => {
  const t = useTranslations("userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("signOut")}
        >
          <Avatar className="h-8 w-8">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={name ?? email ?? ""} />
            ) : null}
            <AvatarFallback>{initialsFor(name, email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-none">
            {name ?? t("unknown")}
          </span>
          {email ? (
            <span className="text-xs font-normal leading-none text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon /> {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/sign-out" method="post" className="contents">
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="w-full text-left text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut /> {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
