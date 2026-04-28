"use client";

import type { HistoryEntry } from "@commit-analyzer/contracts";
import { History as HistoryIcon, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  useHistoryEntryQuery,
  useHistoryListQuery,
} from "@/features/history/hooks";
import type { HistoryPageData } from "@/features/history/types";
import { Link, useRouter } from "@/i18n/navigation";

import { HistoryDetailDrawer } from "./history-detail-drawer";
import { HistoryRow } from "./history-row";

interface PageState {
  cursor: string | null;
  items: HistoryEntry[];
  nextCursor: string | null;
}

export const HistoryView = ({
  initialItems,
  initialNextCursor,
}: HistoryPageData) => {
  const t = useTranslations("history");
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [pages, setPages] = useState<PageState[]>(() => [
    {
      cursor: null,
      items: initialItems,
      nextCursor: initialNextCursor,
    },
  ]);

  const activeCursor = pages[pages.length - 1]?.cursor ?? null;

  const initial = useMemo(
    () =>
      activeCursor === null
        ? {
            status: 200 as const,
            body: {
              items: initialItems,
              nextCursor: initialNextCursor,
            },
            headers: new Headers(),
          }
        : undefined,
    [activeCursor, initialItems, initialNextCursor],
  );

  const query = useHistoryListQuery({ cursor: activeCursor, initial });

  useEffect(() => {
    if (query.data?.status !== 200) return;
    const body = query.data.body;
    setPages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.cursor !== activeCursor) return prev;
      if (
        last.items.length === body.items.length &&
        last.nextCursor === body.nextCursor &&
        last.items.every((row, i) => row.id === body.items[i]?.id)
      ) {
        return prev;
      }
      const next = prev.slice(0, prev.length - 1);
      next.push({
        cursor: last.cursor,
        items: body.items,
        nextCursor: body.nextCursor,
      });
      return next;
    });
  }, [query.data, activeCursor]);

  const items = useMemo(() => pages.flatMap((p) => p.items), [pages]);
  const tailNextCursor = pages[pages.length - 1]?.nextCursor ?? null;

  const handleSelect = useCallback(
    (id: string) => {
      router.replace(`/history?id=${id}`, { scroll: false });
    },
    [router],
  );

  const handleClose = useCallback(() => {
    router.replace("/history", { scroll: false });
  }, [router]);

  const handleLoadMore = useCallback(() => {
    setPages((prev) => {
      const last = prev[prev.length - 1];
      if (!last?.nextCursor) return prev;
      return [
        ...prev,
        { cursor: last.nextCursor, items: [], nextCursor: null },
      ];
    });
  }, []);

  const cachedSelected = idParam
    ? items.find((entry) => entry.id === idParam) ?? null
    : null;
  const detailQuery = useHistoryEntryQuery(
    idParam && !cachedSelected ? idParam : null,
  );
  const selected =
    cachedSelected ??
    (detailQuery.data?.status === 200 ? detailQuery.data.body : null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
          <HistoryIcon className="h-5 w-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {query.isError && items.length === 0 ? (
        <ErrorState
          title={t("error.load")}
          onRetry={() => { void query.refetch(); }}
          retryDisabled={query.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-6 w-6" aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/generate">{t("empty.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              onSelect={handleSelect}
            />
          ))}

          <div className="flex justify-center pt-2">
            {tailNextCursor ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={query.isFetching}
              >
                {query.isFetching ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    {t("pagination.loading")}
                  </>
                ) : (
                  t("pagination.loadMore")
                )}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("pagination.noMore")}
              </p>
            )}
          </div>
        </div>
      )}

      <HistoryDetailDrawer
        entry={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      />
    </div>
  );
};
