import { loadServerEnv } from "@commit-analyzer/shared-types/env";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const FORWARD_PATH = "/v1/generate";

const { API_URL, WEB_ORIGIN } = loadServerEnv();
const FORWARD_URL = `${API_URL.replace(/\/$/u, "")}${FORWARD_PATH}`;

export const POST = async (req: NextRequest): Promise<Response> => {
  if (req.headers.get("origin") !== WEB_ORIGIN) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const body = await req.text();
  const forwardHeaders = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) forwardHeaders.set("content-type", contentType);
  const auth = req.headers.get("authorization");
  if (auth) forwardHeaders.set("authorization", auth);
  const cookie = req.headers.get("cookie");
  if (cookie) forwardHeaders.set("cookie", cookie);
  // Upstream only serves SSE on this route; force the accept header so a
  // misconfigured client does not negotiate something else.
  forwardHeaders.set("accept", "text/event-stream");

  let upstream: Response;
  try {
    upstream = await fetch(FORWARD_URL, {
      method: "POST",
      headers: forwardHeaders,
      body,
      // Abort the upstream fetch when the client disconnects so the SSE
      // session terminates promptly (cancel button, tab close).
      signal: req.signal,
    });
  } catch (err) {
    if (req.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNREACHABLE",
          message: err instanceof Error ? err.message : "upstream fetch failed",
        },
      },
      { status: 502 },
    );
  }

  // Error envelopes come back as buffered JSON; pass them through untouched.
  if (upstream.status !== 200 || !upstream.body) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  }

  // Stream the SSE body straight through. Buffering here would defeat the
  // < 2 s TTFT acceptance criterion. `X-Accel-Buffering: no` keeps upstream
  // proxies from coalescing chunks; `no-cache, no-transform` keeps browsers
  // and edge caches from holding frames.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ??
        "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
};
