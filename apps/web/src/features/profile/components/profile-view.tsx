"use client";

import { LogOut, Trash2, User as UserIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ProfilePageData } from "../types";

import { DeleteAccountDialog } from "./delete-account-dialog";

const initialsFor = (name: string | null, email: string | null): string => {
  const source = name ?? email ?? "";
  const parts = source.trim().split(/\s+/u);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
};

export const ProfileView = ({ user }: ProfilePageData) => {
  const t = useTranslations("profile");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const toastedRef = useRef<string | null>(null);

  useEffect(() => {
    if (errorParam === "delete_failed" && toastedRef.current !== errorParam) {
      toastedRef.current = errorParam;
      toast.error(t("toast.deleteError"));
    }
  }, [errorParam, t]);

  const handleConfirmDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      const res = await fetch("/auth/delete-account", { method: "POST" });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) {
        toast.error(t("toast.deleteError"));
      }
    } catch {
      toast.error(t("toast.deleteError"));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
          <UserIcon className="h-5 w-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-14 w-14">
            {user.avatarUrl ? (
              <AvatarImage
                src={user.avatarUrl}
                alt={user.name ?? user.email ?? ""}
              />
            ) : null}
            <AvatarFallback className="text-base">
              {initialsFor(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">
              {user.name ?? t("unknownName")}
            </CardTitle>
            <CardDescription>{t("identityHint")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("fields.githubLogin")}
              </dt>
              <dd className="text-sm">
                {user.name ?? <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("fields.email")}
              </dt>
              <dd className="text-sm">
                {user.email ?? <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("session.title")}</CardTitle>
          <CardDescription>{t("session.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="outline">
              <LogOut />
              {t("session.signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            {t("danger.title")}
          </CardTitle>
          <CardDescription>{t("danger.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 />
            {t("danger.deleteAccount")}
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={deleteOpen}
        loading={deleting}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </div>
  );
};
