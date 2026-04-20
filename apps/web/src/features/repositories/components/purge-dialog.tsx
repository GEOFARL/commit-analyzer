"use client";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  repo: ConnectedRepo | null;
  onClose: () => void;
  onConfirm: (repo: ConnectedRepo) => void;
};

export const PurgeDialog = ({ repo, onClose, onConfirm }: Props) => {
  const t = useTranslations("repositories");
  return (
    <AlertDialog
      open={repo !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="h-5 w-5 text-destructive"
            />
            {t("purgeDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("purgeDialog.description", { name: repo?.fullName ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("purgeDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (repo) onConfirm(repo);
            }}
            className="bg-destructive text-destructive-foreground hover:brightness-110"
          >
            {t("purgeDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
