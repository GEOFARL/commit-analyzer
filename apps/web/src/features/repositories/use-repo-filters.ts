"use client";

import type { GithubRepo } from "@commit-analyzer/contracts";
import { useMemo, useState } from "react";

export type SortField = "name" | "pushedAt" | "stars";
export type VisibilityFilter = "all" | "public" | "private";

const PAGE_SIZES = [12, 24, 48] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export { PAGE_SIZES };

export type RepoFilterState = {
  search: string;
  sortBy: SortField;
  visibility: VisibilityFilter;
  showArchived: boolean;
  page: number;
  pageSize: PageSize;
};

export type UseRepoFiltersReturn = {
  state: RepoFilterState;
  setSearch: (v: string) => void;
  setSortBy: (v: SortField) => void;
  setVisibility: (v: VisibilityFilter) => void;
  setShowArchived: (v: boolean) => void;
  setPage: (v: number) => void;
  setPageSize: (v: PageSize) => void;
  filtered: GithubRepo[];
  paginated: GithubRepo[];
  totalFiltered: number;
  totalPages: number;
};

export function filterRepos(
  items: GithubRepo[],
  search: string,
  visibility: VisibilityFilter,
  showArchived: boolean,
): GithubRepo[] {
  let result = items;

  if (!showArchived) {
    result = result.filter((r) => !r.archived);
  }

  if (visibility !== "all") {
    const wantPrivate = visibility === "private";
    result = result.filter((r) => r.private === wantPrivate);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((r) => r.fullName.toLowerCase().includes(q));
  }

  return result;
}

export function sortRepos(items: GithubRepo[], sortBy: SortField): GithubRepo[] {
  const sorted = [...items];
  switch (sortBy) {
    case "name":
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
      break;
    case "pushedAt":
      sorted.sort((a, b) => {
        const da = a.pushedAt ?? "";
        const db = b.pushedAt ?? "";
        return db.localeCompare(da);
      });
      break;
    case "stars":
      sorted.sort((a, b) => b.stargazersCount - a.stargazersCount);
      break;
  }
  return sorted;
}

export function useRepoFilters(items: GithubRepo[]): UseRepoFiltersReturn {
  const [search, setSearchRaw] = useState("");
  const [sortBy, setSortByRaw] = useState<SortField>("name");
  const [visibility, setVisibilityRaw] = useState<VisibilityFilter>("all");
  const [showArchived, setShowArchivedRaw] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState<PageSize>(12);

  const setSearch = (v: string) => {
    setSearchRaw(v);
    setPage(1);
  };
  const setSortBy = (v: SortField) => {
    setSortByRaw(v);
    setPage(1);
  };
  const setVisibility = (v: VisibilityFilter) => {
    setVisibilityRaw(v);
    setPage(1);
  };
  const setShowArchived = (v: boolean) => {
    setShowArchivedRaw(v);
    setPage(1);
  };
  const setPageSize = (v: PageSize) => {
    setPageSizeRaw(v);
    setPage(1);
  };

  const filtered = useMemo(
    () => sortRepos(filterRepos(items, search, visibility, showArchived), sortBy),
    [items, search, sortBy, visibility, showArchived],
  );

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const clampedPage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => {
      const start = (clampedPage - 1) * pageSize;
      return filtered.slice(start, start + pageSize);
    },
    [filtered, clampedPage, pageSize],
  );

  return {
    state: {
      search,
      sortBy,
      visibility,
      showArchived,
      page: clampedPage,
      pageSize,
    },
    setSearch,
    setSortBy,
    setVisibility,
    setShowArchived,
    setPage,
    setPageSize,
    filtered,
    paginated,
    totalFiltered,
    totalPages,
  };
}
