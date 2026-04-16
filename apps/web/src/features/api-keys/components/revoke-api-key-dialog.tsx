"use client";

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
  apiKeyId: string | null;
  apiKeyName: string;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

export const RevokeApiKeyDialog = ({
  apiKeyId,
  apiKeyName,
  onClose,
  onConfirm,
}: Props) => {
  const t = useTranslations("apiKeys.revokeDialog");

  return (
    <AlertDialog
      open={apiKeyId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { name: apiKeyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (apiKeyId) onConfirm(apiKeyId);
            }}
            className="bg-destructive text-destructive-foreground hover:brightness-110"
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
