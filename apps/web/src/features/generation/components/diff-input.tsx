"use client";

import { ClipboardPaste, FileCode2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

const MAX_BYTES = 1_000_000;

export const DiffInput = ({ value, onChange, disabled }: Props) => {
  const t = useTranslations("generate.diff");
  const textareaId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error(t("pasteEmpty"));
        return;
      }
      onChange(text);
      setFileName(null);
      toast.success(t("pasteSuccess"));
    } catch {
      toast.error(t("pasteError"));
    }
  }, [onChange, t]);

  const readFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error(t("fileTooLarge"));
        return;
      }
      const text = await file.text();
      onChange(text);
      setFileName(file.name);
    },
    [onChange, t],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      void readFile(file);
    },
    [readFile],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={textareaId} className="text-sm font-medium">
          {t("label")}
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".patch,.diff,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="cursor-pointer"
          >
            <FileCode2 aria-hidden="true" />
            <span className="hidden sm:inline">{t("uploadFile")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handlePaste()}
            disabled={disabled}
            className="cursor-pointer"
          >
            <ClipboardPaste aria-hidden="true" />
            <span className="hidden sm:inline">{t("paste")}</span>
          </Button>
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border bg-card transition-colors",
          dragOver && "border-primary ring-2 ring-primary/30",
        )}
      >
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFileName(null);
          }}
          disabled={disabled}
          spellCheck={false}
          placeholder={t("placeholder")}
          className={cn(
            "block min-h-[220px] w-full resize-y rounded-lg bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-foreground",
            "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fileName ? t("fromFile", { name: fileName }) : t("hint")}</span>
        <span>{t("chars", { count: value.length })}</span>
      </div>
    </div>
  );
};
