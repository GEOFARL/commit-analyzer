"use client";

import type { GithubRepo } from "@commit-analyzer/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type SortField = "name" | "pushedAt" | "stars";
export type VisibilityFilter = "all" | "public" | "private";

export const DEFAULT_PAGE_SIZE = 12;

export type RepoFilterState = {
  search: string;
  sortBy: SortField;
  visibility: VisibilityFilter;
  showArchived: boolean;
  page: number;
};

type UseRepoFiltersReturn = {
  state: RepoFilterState;
  setSearch: (v: string) => void;
  setSortBy: (v: SortField) => void;
  setVisibility: (v: VisibilityFilter) => void;
  setShowArchived: (v: boolean) => void;
  setPage: (v: number) => void;
  reset: () => void;
  filtered: GithubRepo[];
  paginated: GithubRepo[];
  totalFiltered: number;
  totalPages: number;
};

function filterRepos(
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

function sortRepos(items: GithubRepo[], sortBy: SortField): GithubRepo[] {
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const sortBy = (searchParams.get("sort") as SortField | null) ?? "name";
  const visibility =
    (searchParams.get("vis") as VisibilityFilter | null) ?? "all";
  const showArchived = searchParams.get("archived") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === null) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setSearch = useCallback(
    (v: string) => updateParams({ search: v || null, page: null }),
    [updateParams],
  );
  const setSortBy = useCallback(
    (v: SortField) =>
      updateParams({ sort: v === "name" ? null : v, page: null }),
    [updateParams],
  );
  const setVisibility = useCallback(
    (v: VisibilityFilter) =>
      updateParams({ vis: v === "all" ? null : v, page: null }),
    [updateParams],
  );
  const setShowArchived = useCallback(
    (v: boolean) => updateParams({ archived: v ? "1" : null, page: null }),
    [updateParams],
  );
  const setPage = useCallback(
    (v: number) => updateParams({ page: v === 1 ? null : String(v) }),
    [updateParams],
  );
  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const filtered = useMemo(
    () => sortRepos(filterRepos(items, search, visibility, showArchived), sortBy),
    [items, search, sortBy, visibility, showArchived],
  );

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / DEFAULT_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (clampedPage - 1) * DEFAULT_PAGE_SIZE;
    return filtered.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filtered, clampedPage]);

  return {
    state: {
      search,
      sortBy,
      visibility,
      showArchived,
      page: clampedPage,
    },
    setSearch,
    setSortBy,
    setVisibility,
    setShowArchived,
    setPage,
    reset,
    filtered,
    paginated,
    totalFiltered,
    totalPages,
  };
}
