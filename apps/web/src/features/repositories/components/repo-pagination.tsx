"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PAGE_SIZES, type PageSize } from "../use-repo-filters";

type RepoPaginationProps = {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
};

export const RepoPagination = ({
  page,
  totalPages,
  pageSize,
  totalFiltered,
  onPageChange,
  onPageSizeChange,
}: RepoPaginationProps) => {
  const t = useTranslations("repositories.pagination");

  if (totalFiltered <= PAGE_SIZES[0]) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalFiltered);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <span className="text-sm text-muted-foreground">
        {t("showing", { from, to, total: totalFiltered })}
      </span>

      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t("perPage", { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
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
      </div>
    </div>
  );
};
