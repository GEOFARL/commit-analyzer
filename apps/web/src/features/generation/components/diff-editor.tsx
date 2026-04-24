"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type WindowWithDiffEditorView = Window & {
  __DIFF_EDITOR_VIEW?: EditorView;
};

export type DiffEditorProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  onViewReady?: (view: EditorView | null) => void;
};

const USER_EVENT_KINDS = [
  "input",
  "delete",
  "move",
  "select",
  "undo",
  "redo",
] as const;

const diffLanguage = StreamLanguage.define(diff);

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.55",
    minHeight: "220px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 25%, transparent)" },
  ".cm-content": { caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0 8px" },
});

const lightDiffHighlight = HighlightStyle.define([
  { tag: t.inserted, color: "#15803d" },
  { tag: t.deleted, color: "#b91c1c" },
  { tag: t.heading, color: "#0f172a", fontWeight: "600" },
  { tag: t.meta, color: "#64748b" },
]);

const darkDiffHighlight = HighlightStyle.define([
  { tag: t.inserted, color: "#86efac" },
  { tag: t.deleted, color: "#fca5a5" },
  { tag: t.heading, color: "#f1f5f9", fontWeight: "600" },
  { tag: t.meta, color: "#94a3b8" },
]);


export default function DiffEditor({
  value,
  onChange,
  disabled,
  placeholder,
  id,
  ariaLabel,
  className,
  onViewReady,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const editableCompartmentRef = useRef(new Compartment());
  const placeholderCompartmentRef = useRef(new Compartment());
  const contentAttrsCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const contentAttrsExt = (labelId?: string, label?: string) =>
    EditorView.contentAttributes.of({
      ...(labelId ? { id: labelId } : {}),
      ...(label ? { "aria-label": label } : {}),
    });

  const placeholderExtFor = (text?: string) =>
    text ? placeholderExt(text) : [];

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        diffLanguage,
        bracketMatching(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        baseTheme,
        themeCompartmentRef.current.of(
          isDark
            ? [oneDark, syntaxHighlighting(darkDiffHighlight)]
            : [syntaxHighlighting(lightDiffHighlight)],
        ),
        editableCompartmentRef.current.of(EditorState.readOnly.of(!!disabled)),
        placeholderCompartmentRef.current.of(placeholderExtFor(placeholder)),
        contentAttrsCompartmentRef.current.of(contentAttrsExt(id, ariaLabel)),
        EditorView.updateListener.of((v) => {
          if (!v.docChanged) return;
          const isUser = v.transactions.some((tr) =>
            USER_EVENT_KINDS.some((kind) => tr.isUserEvent(kind)),
          );
          if (!isUser) return;
          onChangeRef.current(v.state.doc.toString());
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onViewReady?.(view);
    if (typeof window !== "undefined") {
      (window as WindowWithDiffEditorView).__DIFF_EDITOR_VIEW = view;
    }

    return () => {
      if (
        typeof window !== "undefined" &&
        (window as WindowWithDiffEditorView).__DIFF_EDITOR_VIEW === view
      ) {
        delete (window as WindowWithDiffEditorView).__DIFF_EDITOR_VIEW;
      }
      onViewReady?.(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        isDark
          ? [oneDark, syntaxHighlighting(darkDiffHighlight)]
          : [syntaxHighlighting(lightDiffHighlight)],
      ),
    });
  }, [isDark]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(!!disabled),
      ),
    });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartmentRef.current.reconfigure(
        placeholderExtFor(placeholder),
      ),
    });
  }, [placeholder]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: contentAttrsCompartmentRef.current.reconfigure(
        contentAttrsExt(id, ariaLabel),
      ),
    });
  }, [id, ariaLabel]);

  return (
    <div
      ref={containerRef}
      aria-readonly={disabled || undefined}
      className={cn(
        "overflow-hidden rounded-lg bg-transparent",
        disabled && "opacity-60",
        className,
      )}
    />
  );
}
