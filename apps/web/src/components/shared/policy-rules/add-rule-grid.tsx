"use client";

import {
  policyRuleTypes,
  type PolicyRuleTypeName,
} from "@commit-analyzer/contracts";
import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  usedKinds: ReadonlySet<PolicyRuleTypeName>;
  onAdd: (kind: PolicyRuleTypeName) => void;
};

export const AddRuleGrid = ({ usedKinds, onAdd }: Props) => {
  const t = useTranslations("policies.editor");
  const tKinds = useTranslations("policies.kinds");

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
      aria-labelledby="add-rule-title"
    >
      <div>
        <h3
          id="add-rule-title"
          className="text-sm font-semibold tracking-tight"
        >
          {t("addRuleTitle")}
        </h3>
        <p className="text-xs text-muted-foreground text-pretty">
          {t("addRuleHelp")}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" role="list">
        {policyRuleTypes.map((kind) => {
          const added = usedKinds.has(kind);
          const label = tKinds(`${kind}.label`);
          const description = tKinds(`${kind}.description`);
          return (
            <li key={kind}>
              <button
                type="button"
                onClick={added ? undefined : () => onAdd(kind)}
                disabled={added}
                aria-label={
                  added
                    ? t("ruleAddedAria", { label })
                    : t("addRuleAria", { label })
                }
                className={cn(
                  "flex h-full w-full flex-col items-start gap-1.5 rounded-lg border bg-background p-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  added
                    ? "cursor-not-allowed opacity-60"
                    : "hover:border-primary/40 hover:bg-accent/40",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold leading-none">
                    {label}
                  </span>
                  {added ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {t("ruleAdded")}
                    </Badge>
                  ) : (
                    <Plus
                      className="h-4 w-4 shrink-0 opacity-60"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-xs text-muted-foreground text-pretty">
                  {description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
