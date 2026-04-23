"use client";

import type { LlmProviderName } from "@commit-analyzer/contracts";
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
  provider: LlmProviderName | null;
  onClose: () => void;
  onConfirm: (provider: LlmProviderName) => void;
};

export const DeleteLlmKeyDialog = ({ provider, onClose, onConfirm }: Props) => {
  const t = useTranslations("llmKeys.deleteDialog");
  const tProviders = useTranslations("llmKeys.providers");

  return (
    <AlertDialog
      open={provider !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", {
              provider: provider ? tProviders(provider) : "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (provider) onConfirm(provider);
            }}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:brightness-110"
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
