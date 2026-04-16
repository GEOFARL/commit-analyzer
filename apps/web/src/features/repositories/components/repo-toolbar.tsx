"use client";

import { SlidersHorizontal, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  RepoFilterState,
  SortField,
  VisibilityFilter,
} from "../use-repo-filters";

type RepoToolbarProps = {
  state: RepoFilterState;
  onSearchChange: (v: string) => void;
  onSortChange: (v: SortField) => void;
  onVisibilityChange: (v: VisibilityFilter) => void;
  onArchivedChange: (v: boolean) => void;
};

export const RepoToolbar = ({
  state,
  onSearchChange,
  onSortChange,
  onVisibilityChange,
  onArchivedChange,
}: RepoToolbarProps) => {
  const t = useTranslations("repositories.toolbar");

  const hasActiveFilters =
    state.sortBy !== "name" ||
    state.visibility !== "all" ||
    state.showArchived;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("search")}
          value={state.search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t("filters")}
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {Number(state.sortBy !== "name") +
                  Number(state.visibility !== "all") +
                  Number(state.showArchived)}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("sort")}</p>
            <Select
              value={state.sortBy}
              onValueChange={(v) => onSortChange(v as SortField)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("sortName")}</SelectItem>
                <SelectItem value="pushedAt">{t("sortPushed")}</SelectItem>
                <SelectItem value="stars">{t("sortStars")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("filterVisibility")}</p>
            <Select
              value={state.visibility}
              onValueChange={(v) => onVisibilityChange(v as VisibilityFilter)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAll")}</SelectItem>
                <SelectItem value="public">{t("filterPublic")}</SelectItem>
                <SelectItem value="private">{t("filterPrivate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-sm font-medium">{t("showArchived")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.showArchived}
              onClick={() => onArchivedChange(!state.showArchived)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${
                state.showArchived ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                  state.showArchived ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
};
