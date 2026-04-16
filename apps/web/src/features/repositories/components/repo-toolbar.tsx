"use client";

import { Loader2, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onRefresh: () => void;
  isRefreshing: boolean;
};

export const RepoToolbar = ({
  state,
  onSearchChange,
  onSortChange,
  onVisibilityChange,
  onArchivedChange,
  onRefresh,
  isRefreshing,
}: RepoToolbarProps) => {
  const t = useTranslations("repositories.toolbar");
  const tActions = useTranslations("repositories.actions");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={state.sortBy}
          onValueChange={(v) => onSortChange(v as SortField)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("sort")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("sortName")}</SelectItem>
            <SelectItem value="pushedAt">{t("sortPushed")}</SelectItem>
            <SelectItem value="stars">{t("sortStars")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={state.visibility}
          onValueChange={(v) => onVisibilityChange(v as VisibilityFilter)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t("filterVisibility")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="public">{t("filterPublic")}</SelectItem>
            <SelectItem value="private">{t("filterPrivate")}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={state.showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => onArchivedChange(!state.showArchived)}
        >
          {t("showArchived")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRefreshing ? tActions("refreshing") : tActions("refresh")}
        </Button>
      </div>
    </div>
  );
};
