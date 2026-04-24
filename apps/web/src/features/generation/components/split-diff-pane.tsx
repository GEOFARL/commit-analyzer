"use client";

import {
  HighlightStyle,
  StreamLanguage,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import {
  extensionToLanguageKey,
  type ParsedFile,
} from "@commit-analyzer/diff-parser";
import {
  buildStrippedSplitDocs,
  syncScroll,
  type SplitLineSignal,
} from "@commit-analyzer/diff-parser/split-view";
import { classHighlighter, tags as t } from "@lezer/highlight";
import { githubDark } from "@uiw/codemirror-theme-github";
import { FileDigit } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

import { loadLanguageExtension } from "../resolve-language";

type Props = {
  file: ParsedFile;
  binaryPlaceholder: string;
  emptyPlaceholder: string;
  leftAriaLabel: string;
  rightAriaLabel: string;
};

const paneTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.55",
    minHeight: "220px",
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-line": { padding: "0 8px" },
  ".cm-line.cm-diff-add": {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  ".cm-line.cm-diff-del": {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
  },
  ".cm-line.cm-diff-empty": {
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  ".cm-line.cm-diff-header": {
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  "&.cm-dark .cm-line.cm-diff-add": {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  "&.cm-dark .cm-line.cm-diff-del": {
    backgroundColor: "rgba(244, 63, 94, 0.2)",
  },
  "&.cm-dark .cm-line.cm-diff-empty": {
    backgroundColor: "rgba(148, 163, 184, 0.14)",
  },
});

const diffAccentLight = HighlightStyle.define([
  { tag: t.heading, color: "#0f172a", fontWeight: "600" },
  { tag: t.meta, color: "#64748b" },
]);

const diffAccentDark = HighlightStyle.define([
  { tag: t.heading, color: "#f1f5f9", fontWeight: "600" },
  { tag: t.meta, color: "#94a3b8" },
]);

const diffLanguage = StreamLanguage.define(diff);

const SIGNAL_CLASS: Record<SplitLineSignal, string | null> = {
  context: null,
  add: "cm-diff-add",
  del: "cm-diff-del",
  empty: "cm-diff-empty",
  header: "cm-diff-header",
};

function buildLineDecorations(
  doc: string,
  signals: readonly SplitLineSignal[],
): Extension {
  const builder = new RangeSetBuilder<Decoration>();
  let pos = 0;
  for (const sig of signals) {
    const cls = SIGNAL_CLASS[sig];
    if (cls) {
      builder.add(pos, pos, Decoration.line({ class: cls }));
    }
    const nl = doc.indexOf("\n", pos);
    if (nl < 0) break;
    pos = nl + 1;
  }
  return EditorView.decorations.of(builder.finish());
}

export default function SplitDiffPane({
  file,
  binaryPlaceholder,
  emptyPlaceholder,
  leftAriaLabel,
  rightAriaLabel,
}: Props) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const leftViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);
  const themeCompartmentLeft = useRef(new Compartment());
  const themeCompartmentRight = useRef(new Compartment());
  const ariaCompartmentLeft = useRef(new Compartment());
  const ariaCompartmentRight = useRef(new Compartment());
  const langCompartmentLeft = useRef(new Compartment());
  const langCompartmentRight = useRef(new Compartment());
  const decoCompartmentLeft = useRef(new Compartment());
  const decoCompartmentRight = useRef(new Compartment());

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const stripped = useMemo(() => {
    if (file.isBinary) {
      return {
        leftDoc: binaryPlaceholder,
        rightDoc: binaryPlaceholder,
        lineCount: 0,
        leftSignals: [] as SplitLineSignal[],
        rightSignals: [] as SplitLineSignal[],
      };
    }
    return buildStrippedSplitDocs(file);
  }, [file, binaryPlaceholder]);

  const { leftDoc, rightDoc, leftSignals, rightSignals } = stripped;
  const languageKey = useMemo(
    () => (file.isBinary ? null : extensionToLanguageKey(file.path)),
    [file.isBinary, file.path],
  );

  useEffect(() => {
    const leftParent = leftRef.current;
    const rightParent = rightRef.current;
    if (!leftParent || !rightParent) return;

    const themeExtFor = (dark: boolean) =>
      dark
        ? [githubDark, syntaxHighlighting(diffAccentDark)]
        : [
            syntaxHighlighting(defaultHighlightStyle),
            syntaxHighlighting(diffAccentLight),
          ];
    const ariaExtFor = (label: string) =>
      EditorView.contentAttributes.of({ "aria-label": label });

    const commonExtensions = [
      lineNumbers(),
      paneTheme,
      syntaxHighlighting(classHighlighter),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ];

    const leftState = EditorState.create({
      doc: leftDoc,
      extensions: [
        ...commonExtensions,
        langCompartmentLeft.current.of(diffLanguage),
        decoCompartmentLeft.current.of(
          buildLineDecorations(leftDoc, leftSignals),
        ),
        themeCompartmentLeft.current.of(themeExtFor(isDark)),
        ariaCompartmentLeft.current.of(ariaExtFor(leftAriaLabel)),
      ],
    });
    const rightState = EditorState.create({
      doc: rightDoc,
      extensions: [
        ...commonExtensions,
        langCompartmentRight.current.of(diffLanguage),
        decoCompartmentRight.current.of(
          buildLineDecorations(rightDoc, rightSignals),
        ),
        themeCompartmentRight.current.of(themeExtFor(isDark)),
        ariaCompartmentRight.current.of(ariaExtFor(rightAriaLabel)),
      ],
    });

    const leftView = new EditorView({ state: leftState, parent: leftParent });
    const rightView = new EditorView({ state: rightState, parent: rightParent });
    leftViewRef.current = leftView;
    rightViewRef.current = rightView;

    const cleanup = syncScroll(leftView.scrollDOM, rightView.scrollDOM);

    return () => {
      cleanup();
      leftView.destroy();
      rightView.destroy();
      leftViewRef.current = null;
      rightViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lv = leftViewRef.current;
    const rv = rightViewRef.current;
    if (!lv || !rv) return;
    const currentLeft = lv.state.doc.toString();
    const currentRight = rv.state.doc.toString();
    if (currentLeft !== leftDoc) {
      lv.dispatch({
        changes: { from: 0, to: currentLeft.length, insert: leftDoc },
      });
    }
    if (currentRight !== rightDoc) {
      rv.dispatch({
        changes: { from: 0, to: currentRight.length, insert: rightDoc },
      });
    }
    lv.dispatch({
      effects: decoCompartmentLeft.current.reconfigure(
        buildLineDecorations(leftDoc, leftSignals),
      ),
    });
    rv.dispatch({
      effects: decoCompartmentRight.current.reconfigure(
        buildLineDecorations(rightDoc, rightSignals),
      ),
    });
  }, [leftDoc, rightDoc, leftSignals, rightSignals]);

  useEffect(() => {
    let cancelled = false;
    const lv = leftViewRef.current;
    const rv = rightViewRef.current;
    if (!lv || !rv) return;
    if (!languageKey) {
      lv.dispatch({
        effects: langCompartmentLeft.current.reconfigure(diffLanguage),
      });
      rv.dispatch({
        effects: langCompartmentRight.current.reconfigure(diffLanguage),
      });
      return;
    }
    void loadLanguageExtension(languageKey).then((ext) => {
      if (cancelled) return;
      const lvNow = leftViewRef.current;
      const rvNow = rightViewRef.current;
      if (lvNow) {
        lvNow.dispatch({
          effects: langCompartmentLeft.current.reconfigure(ext),
        });
      }
      if (rvNow) {
        rvNow.dispatch({
          effects: langCompartmentRight.current.reconfigure(ext),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [languageKey]);

  useEffect(() => {
    const themeExtFor = (dark: boolean) =>
      dark
        ? [githubDark, syntaxHighlighting(diffAccentDark)]
        : [
            syntaxHighlighting(defaultHighlightStyle),
            syntaxHighlighting(diffAccentLight),
          ];
    const lv = leftViewRef.current;
    const rv = rightViewRef.current;
    if (lv) {
      lv.dispatch({
        effects: themeCompartmentLeft.current.reconfigure(themeExtFor(isDark)),
      });
    }
    if (rv) {
      rv.dispatch({
        effects: themeCompartmentRight.current.reconfigure(themeExtFor(isDark)),
      });
    }
  }, [isDark]);

  useEffect(() => {
    const ariaExtFor = (label: string) =>
      EditorView.contentAttributes.of({ "aria-label": label });
    const lv = leftViewRef.current;
    const rv = rightViewRef.current;
    if (lv) {
      lv.dispatch({
        effects: ariaCompartmentLeft.current.reconfigure(ariaExtFor(leftAriaLabel)),
      });
    }
    if (rv) {
      rv.dispatch({
        effects: ariaCompartmentRight.current.reconfigure(ariaExtFor(rightAriaLabel)),
      });
    }
  }, [leftAriaLabel, rightAriaLabel]);

  const hasContent = leftDoc.length > 0 || rightDoc.length > 0;

  if (file.isBinary) {
    return (
      <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-b-lg border border-t-0 bg-muted/20 p-6 text-sm text-muted-foreground">
        <FileDigit aria-hidden="true" className="size-4" />
        <span>{binaryPlaceholder}</span>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-b-lg border border-t-0 bg-muted/20 p-6 text-sm text-muted-foreground">
        {emptyPlaceholder}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 divide-x overflow-hidden rounded-b-lg border border-t-0 bg-card">
      <div
        ref={leftRef}
        data-testid="split-diff-left"
        className={cn("min-w-0 bg-rose-50/20 dark:bg-rose-950/10")}
      />
      <div
        ref={rightRef}
        data-testid="split-diff-right"
        className={cn("min-w-0 bg-emerald-50/20 dark:bg-emerald-950/10")}
      />
    </div>
  );
}
