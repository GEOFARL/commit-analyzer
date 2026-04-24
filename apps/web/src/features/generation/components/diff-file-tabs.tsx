"use client";

import type { DiffFileTab } from "@commit-analyzer/diff-parser";
import {
  ArrowRightLeft,
  FileDiff,
  FileDigit,
  FileMinus2,
  FilePlus2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  tabs: DiffFileTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  tabListId: string;
  panelId: string;
};

const ICON_BY_KIND = {
  added: FilePlus2,
  modified: FileDiff,
  deleted: FileMinus2,
  renamed: ArrowRightLeft,
  binary: FileDigit,
} as const;

const ICON_CLASS_BY_KIND = {
  added: "text-emerald-600 dark:text-emerald-400",
  modified: "text-sky-600 dark:text-sky-400",
  deleted: "text-rose-600 dark:text-rose-400",
  renamed: "text-amber-600 dark:text-amber-400",
  binary: "text-muted-foreground",
} as const;

function tabLabel(tab: DiffFileTab): string {
  if (tab.previousPath && tab.previousPath !== tab.path) {
    return `${tab.previousPath} → ${tab.path}`;
  }
  return tab.path;
}

export const DiffFileTabs = ({
  tabs,
  activeIndex,
  onSelect,
  tabListId,
  panelId,
}: Props) => {
  const t = useTranslations("generate.diff.viewer");
  const listRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const safeActive = useMemo(() => {
    if (tabs.length === 0) return 0;
    if (activeIndex < 0) return 0;
    if (activeIndex >= tabs.length) return tabs.length - 1;
    return activeIndex;
  }, [activeIndex, tabs.length]);

  useEffect(() => {
    const btn = buttonsRef.current[safeActive];
    if (!btn) return;
    btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [safeActive]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [tabs.length]);

  const focusTab = useCallback((index: number) => {
    const btn = buttonsRef.current[index];
    btn?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (tabs.length === 0) return;
      let next = -1;
      switch (event.key) {
        case "ArrowRight":
          next = (safeActive + 1) % tabs.length;
          break;
        case "ArrowLeft":
          next = (safeActive - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        default:
          return;
      }
      if (next < 0) return;
      event.preventDefault();
      onSelect(next);
      focusTab(next);
    },
    [focusTab, onSelect, safeActive, tabs.length],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative min-w-0 flex-1">
        {canScrollLeft ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/60 via-muted/20 to-transparent"
          />
        ) : null}
        {canScrollRight ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-muted/60 via-muted/20 to-transparent"
          />
        ) : null}
        <div
          ref={listRef}
          id={tabListId}
          role="tablist"
          aria-orientation="horizontal"
          aria-label={t("tabs.listLabel")}
          onKeyDown={handleKeyDown}
          className="flex items-stretch gap-1 overflow-x-auto whitespace-nowrap px-1 py-1 scrollbar-thin"
        >
          {tabs.map((tab, idx) => {
            const Icon = ICON_BY_KIND[tab.changeKind];
            const iconClass = ICON_CLASS_BY_KIND[tab.changeKind];
            const isActive = idx === safeActive;
            const tabId = `${tabListId}-tab-${idx}`;
            return (
              <Tooltip key={`${tab.path}-${idx}`}>
                <TooltipTrigger asChild>
                  <button
                    ref={(el) => {
                      buttonsRef.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    id={tabId}
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onSelect(idx)}
                    data-kind={tab.changeKind}
                    className={cn(
                      "group relative flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "border border-transparent",
                      isActive
                        ? "bg-background text-foreground shadow-sm border-border after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary after:content-['']"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("size-3.5 shrink-0", iconClass)}
                    />
                    <span
                      dir="rtl"
                      className="max-w-[16rem] truncate text-left font-mono"
                    >
                      {tab.path}
                    </span>
                    {!tab.isBinary &&
                    (tab.additions > 0 || tab.deletions > 0) ? (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{tab.additions}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400">
                          -{tab.deletions}
                        </span>
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px]">
                      {tabLabel(tab)}
                    </span>
                    <span className="text-muted-foreground">
                      {tab.changeKind === "added" && t("tabs.added")}
                      {tab.changeKind === "modified" && t("tabs.modified")}
                      {tab.changeKind === "deleted" && t("tabs.deleted")}
                      {tab.changeKind === "renamed" && t("tabs.renamed")}
                      {tab.changeKind === "binary" && t("tabs.binary")}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};
