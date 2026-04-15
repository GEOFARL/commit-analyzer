"use client";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
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

export const DisconnectDialog = ({ repo, onClose, onConfirm }: Props) => {
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
          <AlertDialogTitle>{t("disconnectDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("disconnectDialog.description", {
              name: repo?.fullName ?? "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("disconnectDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (repo) onConfirm(repo);
            }}
            className="bg-destructive text-destructive-foreground hover:brightness-110"
          >
            {t("disconnectDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
