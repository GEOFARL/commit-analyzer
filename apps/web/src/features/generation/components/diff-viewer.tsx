"use client";

import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  parseAllFiles,
  parseDiffFileTabs,
  type DiffFileTab,
  type ParsedFile,
} from "@commit-analyzer/diff-parser";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DiffFileTabs } from "./diff-file-tabs";

type DiffViewMode = "unified" | "split";

const STORAGE_KEY = "generate.diffViewMode";

const DiffEditor = dynamic(() => import("./diff-editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-b-lg border border-t-0 bg-card p-0">
      <Skeleton className="h-[220px] w-full rounded-b-lg" />
    </div>
  ),
});

const SplitDiffPane = dynamic(() => import("./split-diff-pane"), {
  ssr: false,
  loading: () => (
    <div className="rounded-b-lg border border-t-0 bg-card p-0">
      <Skeleton className="h-[220px] w-full rounded-b-lg" />
    </div>
  ),
});

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  editorId?: string;
  ariaLabel?: string;
};

function readStoredMode(): DiffViewMode {
  if (typeof window === "undefined") return "split";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "split" || v === "unified") return v;
  } catch {
    // localStorage may be disabled (privacy mode, SSR) — fall back silently.
  }
  return "split";
}

function writeStoredMode(mode: DiffViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export const DiffViewer = ({
  value,
  onChange,
  disabled,
  placeholder,
  editorId,
  ariaLabel,
}: Props) => {
  const t = useTranslations("generate.diff.viewer");
  const [mode, setMode] = useState<DiffViewMode>("unified");
  const [hydrated, setHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const editorViewRef = useRef<EditorView | null>(null);
  const unifiedRadioRef = useRef<HTMLButtonElement | null>(null);
  const splitRadioRef = useRef<HTMLButtonElement | null>(null);
  const tabListId = useId();
  const panelId = useId();
  const toggleId = useId();

  useEffect(() => {
    setMode(readStoredMode());
    setHydrated(true);
  }, []);

  const parsed = useMemo<{ tabs: DiffFileTab[]; files: ParsedFile[] }>(() => {
    const tabs = parseDiffFileTabs(value);
    if (tabs.length === 0) return { tabs, files: [] };
    return { tabs, files: parseAllFiles(value) };
  }, [value]);
  const tabs = parsed.tabs;
  const parsedFiles = parsed.files;

  useEffect(() => {
    if (activeIndex >= tabs.length && tabs.length > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, tabs.length]);

  const setModePersist = useCallback((next: DiffViewMode) => {
    setMode(next);
    writeStoredMode(next);
  }, []);

  const handleRadioKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next: DiffViewMode = mode === "unified" ? "split" : "unified";
      setModePersist(next);
      const targetRef = next === "unified" ? unifiedRadioRef : splitRadioRef;
      targetRef.current?.focus();
    },
    [mode, setModePersist],
  );

  const handleSelectTab = useCallback(
    (idx: number) => {
      setActiveIndex(idx);
      if (mode === "unified") {
        const view = editorViewRef.current;
        const tab = tabs[idx];
        if (view && tab) {
          const totalLines = view.state.doc.lines;
          const line = Math.min(Math.max(tab.rangeStart, 1), totalLines);
          const pos = view.state.doc.line(line).from;
          view.dispatch({
            selection: EditorSelection.cursor(pos),
            effects: [],
            scrollIntoView: true,
          });
          view.focus();
        }
      }
    },
    [mode, tabs],
  );

  const handleViewReady = useCallback((view: EditorView | null) => {
    editorViewRef.current = view;
  }, []);

  const showTabs = tabs.length > 0;
  const activeTab = tabs[activeIndex];
  const activeFile = parsedFiles[activeIndex];

  return (
    <div className="flex flex-col">
      {showTabs ? (
        <div className="flex flex-col gap-0">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-b-0 bg-muted/20 px-2 py-1">
            <DiffFileTabs
              tabs={tabs}
              activeIndex={activeIndex}
              onSelect={handleSelectTab}
              tabListId={tabListId}
              panelId={panelId}
            />
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {value.length > 0 && !disabled ? (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  aria-label={t("clear")}
                  title={t("clear")}
                  className={cn(
                    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors",
                    "hover:text-foreground hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            {hydrated ? (
              <div
                role="radiogroup"
                aria-label={t("viewMode.label")}
                id={toggleId}
                onKeyDown={handleRadioKeyDown}
                className="inline-flex shrink-0 overflow-hidden rounded-md border bg-background p-0.5 text-xs"
              >
                <button
                  ref={unifiedRadioRef}
                  type="button"
                  role="radio"
                  aria-checked={mode === "unified"}
                  tabIndex={mode === "unified" ? 0 : -1}
                  onClick={() => setModePersist("unified")}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === "unified"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("unified")}
                </button>
                <button
                  ref={splitRadioRef}
                  type="button"
                  role="radio"
                  aria-checked={mode === "split"}
                  tabIndex={mode === "split" ? 0 : -1}
                  onClick={() => setModePersist("split")}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === "split"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("split")}
                </button>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="inline-flex h-7 w-[7.5rem] shrink-0 animate-pulse rounded-md border bg-muted/40"
              />
            )}
            </div>
          </div>
        </div>
      ) : null}

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={
          showTabs && activeTab
            ? `${tabListId}-tab-${activeIndex}`
            : undefined
        }
        className={cn(
          "flex min-w-0 flex-col",
          !showTabs && "rounded-lg",
        )}
      >
        {mode === "unified" || !showTabs ? (
          <DiffEditor
            id={editorId}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            onViewReady={handleViewReady}
            className={cn(
              "min-h-[220px] bg-card",
              showTabs
                ? "rounded-b-lg border border-t-0"
                : "rounded-lg border",
            )}
          />
        ) : activeFile ? (
          <SplitDiffPane
            key={`${activeIndex}-${activeFile.path}`}
            file={activeFile}
            binaryPlaceholder={t("binary")}
            emptyPlaceholder={t("empty")}
            leftAriaLabel={t("splitPane.leftAria")}
            rightAriaLabel={t("splitPane.rightAria")}
          />
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-b-lg border border-t-0 bg-muted/20 p-6 text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </div>
    </div>
  );
};
