"use client";

import type { GithubRepo } from "@commit-analyzer/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function readParams(searchParams: URLSearchParams): RepoFilterState {
  return {
    search: searchParams.get("search") ?? "",
    sortBy: (searchParams.get("sort") as SortField | null) ?? "name",
    visibility:
      (searchParams.get("vis") as VisibilityFilter | null) ?? "all",
    showArchived: searchParams.get("archived") === "1",
    page: Math.max(1, Number(searchParams.get("page") ?? "1")),
  };
}

function buildQuery(state: RepoFilterState): string {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.sortBy !== "name") params.set("sort", state.sortBy);
  if (state.visibility !== "all") params.set("vis", state.visibility);
  if (state.showArchived) params.set("archived", "1");
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

const SEARCH_DEBOUNCE_MS = 300;

export function useRepoFilters(items: GithubRepo[]): UseRepoFiltersReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<RepoFilterState>(() =>
    readParams(searchParams),
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync URL → local state when user navigates back/forward
  const prevSearchParams = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current !== prevSearchParams.current) {
      prevSearchParams.current = current;
      setState(readParams(searchParams));
    }
  }, [searchParams]);

  // Debounced URL sync for search, immediate for other filters
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const syncUrl = useCallback(
    (next: RepoFilterState) => {
      const qs = buildQuery(next);
      prevSearchParams.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setSearch = useCallback(
    (v: string) => {
      const next: RepoFilterState = {
        ...stateRef.current,
        search: v,
        page: 1,
      };
      setState(next);
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(
        () => syncUrl(next),
        SEARCH_DEBOUNCE_MS,
      );
    },
    [syncUrl],
  );

  const setSortBy = useCallback(
    (v: SortField) => {
      const next = { ...stateRef.current, sortBy: v, page: 1 };
      setState(next);
      syncUrl(next);
    },
    [syncUrl],
  );

  const setVisibility = useCallback(
    (v: VisibilityFilter) => {
      const next = { ...stateRef.current, visibility: v, page: 1 };
      setState(next);
      syncUrl(next);
    },
    [syncUrl],
  );

  const setShowArchived = useCallback(
    (v: boolean) => {
      const next = { ...stateRef.current, showArchived: v, page: 1 };
      setState(next);
      syncUrl(next);
    },
    [syncUrl],
  );

  const setPage = useCallback(
    (v: number) => {
      const next = { ...stateRef.current, page: v };
      setState(next);
      syncUrl(next);
    },
    [syncUrl],
  );

  const reset = useCallback(() => {
    const next: RepoFilterState = {
      search: "",
      sortBy: "name",
      visibility: "all",
      showArchived: false,
      page: 1,
    };
    clearTimeout(searchTimerRef.current);
    setState(next);
    prevSearchParams.current = "";
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  const filtered = useMemo(
    () =>
      sortRepos(
        filterRepos(items, state.search, state.visibility, state.showArchived),
        state.sortBy,
      ),
    [items, state.search, state.sortBy, state.visibility, state.showArchived],
  );

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / DEFAULT_PAGE_SIZE));
  const clampedPage = Math.min(state.page, totalPages);

  const paginated = useMemo(() => {
    const start = (clampedPage - 1) * DEFAULT_PAGE_SIZE;
    return filtered.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filtered, clampedPage]);

  return {
    state: {
      ...state,
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
