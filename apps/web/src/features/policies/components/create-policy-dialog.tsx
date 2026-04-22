"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<string | null>;
};

export const CreatePolicyDialog = ({ open, onClose, onSubmit }: Props) => {
  const t = useTranslations("policies.create");
  const tErr = useTranslations("policies.errors");

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setSubmitting(false);
    setError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(tErr("nameRequired"));
      return;
    }
    if (trimmed.length > 100) {
      setError(tErr("nameTooLong"));
      return;
    }
    setError(null);
    setSubmitting(true);
    const created = await onSubmit(trimmed);
    setSubmitting(false);
    if (created) {
      reset();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="policy-name" className="text-sm font-medium">
              {t("nameLabel")}
            </label>
            <Input
              id="policy-name"
              name="policy-name"
              autoComplete="off"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("namePlaceholder")}
              maxLength={100}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? "policy-name-error" : undefined}
            />
            {error && (
              <p
                id="policy-name-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || submitting}
            >
              {submitting && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {submitting ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
