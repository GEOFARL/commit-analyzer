"use client";

import type { AuditEventDto, AuditEventType } from "@commit-analyzer/contracts";
import { Activity, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useAuditListQuery } from "@/features/audit/hooks";
import type { ActivityPageData } from "@/features/audit/types";
import { useRouter } from "@/i18n/navigation";

import { ActivityRow } from "./activity-row";
import { EventTypeFilter } from "./event-type-filter";

interface PageState {
  cursor: string | null;
  items: AuditEventDto[];
  nextCursor: string | null;
}

export const ActivityView = ({
  initial,
  initialEventType,
}: ActivityPageData) => {
  const t = useTranslations("settings.activity");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [eventType, setEventType] = useState<AuditEventType | null>(
    initialEventType,
  );

  const [pages, setPages] = useState<PageState[]>(() => [
    {
      cursor: null,
      items: initial.items,
      nextCursor: initial.nextCursor,
    },
  ]);

  const activeCursor = pages[pages.length - 1]?.cursor ?? null;

  const initialEnvelope = useMemo(
    () =>
      activeCursor === null && eventType === initialEventType
        ? {
            status: 200 as const,
            body: { items: initial.items, nextCursor: initial.nextCursor },
            headers: new Headers(),
          }
        : undefined,
    [activeCursor, eventType, initialEventType, initial.items, initial.nextCursor],
  );

  const query = useAuditListQuery({
    cursor: activeCursor,
    eventType,
    initial: initialEnvelope,
  });

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

  const writeFilterToUrl = useCallback(
    (next: AuditEventType | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next) sp.set("eventType", next);
      else sp.delete("eventType");
      const qs = sp.toString();
      router.replace(qs ? `/settings/activity?${qs}` : "/settings/activity", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const handleFilterChange = useCallback(
    (next: AuditEventType | null) => {
      setEventType(next);
      setPages([{ cursor: null, items: [], nextCursor: null }]);
      writeFilterToUrl(next);
    },
    [writeFilterToUrl],
  );

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

  const filterId = "audit-event-type-filter";
  const isFiltered = eventType !== null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
          <Activity className="h-5 w-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={filterId}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {t("filter.label")}
        </label>
        <EventTypeFilter
          id={filterId}
          value={eventType}
          onChange={handleFilterChange}
        />
      </div>

      {query.isError && items.length === 0 ? (
        <ErrorState
          title={t("error.load")}
          onRetry={() => {
            void query.refetch();
          }}
          retryDisabled={query.isFetching}
        />
      ) : items.length === 0 && !query.isFetching ? (
        isFiltered ? (
          <EmptyState
            icon={<Activity className="h-6 w-6" aria-hidden="true" />}
            title={t("empty.filtered.title")}
            description={t("empty.filtered.description")}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleFilterChange(null)}
              >
                {t("empty.filtered.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Activity className="h-6 w-6" aria-hidden="true" />}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        )
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("title")}>
          {items.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}

          {tailNextCursor ? (
            <li className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={query.isFetching}
              >
                {query.isFetching ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    {t("loadingMore")}
                  </>
                ) : (
                  t("loadMore")
                )}
              </Button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
};
