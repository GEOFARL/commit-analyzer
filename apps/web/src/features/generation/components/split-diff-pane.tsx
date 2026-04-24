"use client";

import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { ParsedFile } from "@commit-analyzer/diff-parser";
import { buildSplitDocs, syncScroll } from "@commit-analyzer/diff-parser/split-view";
import { tags as t } from "@lezer/highlight";
import { FileDigit } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

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
});

const lightHighlight = HighlightStyle.define([
  { tag: t.inserted, color: "#15803d" },
  { tag: t.deleted, color: "#b91c1c" },
  { tag: t.heading, color: "#0f172a", fontWeight: "600" },
  { tag: t.meta, color: "#64748b" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: t.inserted, color: "#86efac" },
  { tag: t.deleted, color: "#fca5a5" },
  { tag: t.heading, color: "#f1f5f9", fontWeight: "600" },
  { tag: t.meta, color: "#94a3b8" },
]);

const diffLanguage = StreamLanguage.define(diff);

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

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { leftDoc, rightDoc } = file.isBinary
    ? { leftDoc: binaryPlaceholder, rightDoc: binaryPlaceholder }
    : buildSplitDocs(file);

  useEffect(() => {
    const leftParent = leftRef.current;
    const rightParent = rightRef.current;
    if (!leftParent || !rightParent) return;

    const themeExtFor = (dark: boolean) =>
      dark
        ? [oneDark, syntaxHighlighting(darkHighlight)]
        : [syntaxHighlighting(lightHighlight)];

    const leftState = EditorState.create({
      doc: leftDoc,
      extensions: [
        lineNumbers(),
        diffLanguage,
        paneTheme,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ "aria-label": leftAriaLabel }),
        EditorView.lineWrapping,
        themeCompartmentLeft.current.of(themeExtFor(isDark)),
      ],
    });
    const rightState = EditorState.create({
      doc: rightDoc,
      extensions: [
        lineNumbers(),
        diffLanguage,
        paneTheme,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ "aria-label": rightAriaLabel }),
        EditorView.lineWrapping,
        themeCompartmentRight.current.of(themeExtFor(isDark)),
      ],
    });

    const leftView = new EditorView({ state: leftState, parent: leftParent });
    const rightView = new EditorView({ state: rightState, parent: rightParent });
    leftViewRef.current = leftView;
    rightViewRef.current = rightView;

    const leftScroller = leftView.scrollDOM;
    const rightScroller = rightView.scrollDOM;
    const cleanup = syncScroll(leftScroller, rightScroller);

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
      lv.dispatch({ changes: { from: 0, to: currentLeft.length, insert: leftDoc } });
    }
    if (currentRight !== rightDoc) {
      rv.dispatch({ changes: { from: 0, to: currentRight.length, insert: rightDoc } });
    }
  }, [leftDoc, rightDoc]);

  useEffect(() => {
    const themeExtFor = (dark: boolean) =>
      dark
        ? [oneDark, syntaxHighlighting(darkHighlight)]
        : [syntaxHighlighting(lightHighlight)];
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
        className={cn("min-w-0 bg-rose-50/30 dark:bg-rose-950/20")}
        aria-label={leftAriaLabel}
      />
      <div
        ref={rightRef}
        className={cn("min-w-0 bg-emerald-50/30 dark:bg-emerald-950/20")}
        aria-label={rightAriaLabel}
      />
    </div>
  );
}
