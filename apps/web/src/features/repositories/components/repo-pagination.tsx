"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { DEFAULT_PAGE_SIZE } from "../use-repo-filters";

type RepoPaginationProps = {
  page: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
};

export const RepoPagination = ({
  page,
  totalPages,
  totalFiltered,
  onPageChange,
}: RepoPaginationProps) => {
  const t = useTranslations("repositories.pagination");

  if (totalFiltered <= DEFAULT_PAGE_SIZE) return null;

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("prev")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        {t("page", { current: page, total: totalPages })}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("next")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
