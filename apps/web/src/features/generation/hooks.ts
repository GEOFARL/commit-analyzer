"use client";

import {
  doneFrameSchema,
  errorFrameSchema,
  suggestionFrameSchema,
} from "@commit-analyzer/contracts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { resolveBrowserToken, tsr } from "@/lib/api/tsr";

import { generationQueryKeys } from "./queries";
import type { GenerateInput, StreamState } from "./types";

const GENERATE_PROXY_URL = "/api/generate-proxy";

const INITIAL: StreamState = {
  status: "idle",
  suggestions: [],
  error: null,
  done: null,
};

export const usePoliciesForRepoQuery = (repoId: string | null) =>
  tsr.policies.list.useQuery({
    queryKey: [...generationQueryKeys.policies(repoId ?? "none")],
    // The query never fires when `repoId` is null (see `enabled`), so the
    // placeholder path param is dead weight but keeps the types happy.
    queryData: { params: { repoId: repoId ?? "__disabled__" } },
    enabled: Boolean(repoId),
    staleTime: 30_000,
    retry: 0,
  });

type Frame = { event: string; data: string };

// Minimal SSE frame parser. Splits the rolling buffer on `\n\n` which
// terminates a frame per the SSE spec, ignores `: ping` heartbeat comments,
// and collects `event:` / `data:` field lines. The API emits single-line
// `data:` payloads, so we don't concatenate multi-line data here.
function extractFrames(buffer: string): { frames: Frame[]; rest: string } {
  const frames: Frame[] = [];
  let rest = buffer;
  let idx = rest.indexOf("\n\n");
  while (idx !== -1) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue; // heartbeat / comment
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length > 0) frames.push({ event, data: dataLines.join("\n") });
    idx = rest.indexOf("\n\n");
  }
  return { frames, rest };
}

export const useGenerateStream = () => {
  const [state, setState] = useState<StreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream when the owning component unmounts so the
  // upstream provider call terminates promptly on navigation instead of
  // running until completion in the background.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const start = useCallback(async (input: GenerateInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: "streaming",
      suggestions: [],
      error: null,
      done: null,
    });

    const token = await resolveBrowserToken();

    let res: Response;
    try {
      res = await window.fetch(GENERATE_PROXY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        setState((s) => ({ ...s, status: "cancelled" }));
        return;
      }
      setState((s) => ({
        ...s,
        status: "error",
        error: {
          code: "NETWORK",
          message: err instanceof Error ? err.message : "network error",
        },
      }));
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      const envelope = parseErrorEnvelope(text);
      setState((s) => ({
        ...s,
        status: "error",
        error: {
          code: envelope.code ?? `HTTP_${res.status}`,
          message: envelope.message ?? res.statusText ?? "request failed",
        },
      }));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = extractFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          applyFrame(frame, setState);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setState((s) => ({ ...s, status: "cancelled" }));
        return;
      }
      setState((s) => ({
        ...s,
        status: "error",
        error: {
          code: "STREAM",
          message: err instanceof Error ? err.message : "stream error",
        },
      }));
      return;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }

    setState((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { state, start, cancel };
};

function applyFrame(
  frame: Frame,
  setState: Dispatch<SetStateAction<StreamState>>,
) {
  const parsed = safeJson(frame.data);
  if (!parsed) return;

  if (frame.event === "suggestion") {
    const result = suggestionFrameSchema.safeParse(parsed);
    if (!result.success) return;
    const suggestion = result.data;
    setState((s) => ({
      ...s,
      suggestions: mergeSuggestion(s.suggestions, suggestion),
    }));
    return;
  }
  if (frame.event === "done") {
    const result = doneFrameSchema.safeParse(parsed);
    if (!result.success) return;
    setState((s) => ({
      ...s,
      status: s.status === "streaming" ? "done" : s.status,
      done: result.data,
    }));
    return;
  }
  if (frame.event === "error") {
    const result = errorFrameSchema.safeParse(parsed);
    if (!result.success) return;
    setState((s) => ({ ...s, status: "error", error: result.data }));
  }
}

// Providers may re-emit a suggestion at the same index (rare, but the
// contract allows it); keep the latest so the card reflects the final state.
function mergeSuggestion(
  list: StreamState["suggestions"],
  incoming: StreamState["suggestions"][number],
): StreamState["suggestions"] {
  const existing = list.findIndex((s) => s.index === incoming.index);
  if (existing === -1) return [...list, incoming];
  const copy = list.slice();
  copy[existing] = incoming;
  return copy;
}

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Narrow the JSON-parsed envelope to the {code,message} shape without tripping
// the strict `Record<string,unknown>` return of safeJson.
function parseErrorEnvelope(text: string): {
  code?: string;
  message?: string;
} {
  const parsed = safeJson(text);
  if (!parsed) return {};
  const errorField = (parsed as { error?: unknown }).error;
  if (errorField && typeof errorField === "object") {
    const e = errorField as { code?: unknown; message?: unknown };
    return {
      ...(typeof e.code === "string" ? { code: e.code } : {}),
      ...(typeof e.message === "string" ? { message: e.message } : {}),
    };
  }
  return {};
}

