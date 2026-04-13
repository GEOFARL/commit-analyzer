import { loadServerEnv } from "@commit-analyzer/shared-types/env";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const FORWARD_PATH = "/v1/generate";

const { API_URL, WEB_ORIGIN } = loadServerEnv();
const FORWARD_URL = `${API_URL.replace(/\/$/u, "")}${FORWARD_PATH}`;

export const POST = async (req: NextRequest): Promise<NextResponse> => {
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

  const upstream = await fetch(FORWARD_URL, {
    method: "POST",
    headers: forwardHeaders,
    body,
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
};
