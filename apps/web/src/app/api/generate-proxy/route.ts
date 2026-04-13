import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const FORWARD_PATH = "/v1/generate";

const readWebOrigin = (): string => {
  const value = process.env.WEB_ORIGIN;
  if (!value) {
    throw new Error("WEB_ORIGIN is not configured");
  }
  return value;
};

const readApiUrl = (): string => {
  const value = process.env.API_URL;
  if (!value) {
    throw new Error("API_URL is not configured");
  }
  return value.replace(/\/$/u, "");
};

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const origin = req.headers.get("origin");
  const expected = readWebOrigin();

  if (origin !== expected) {
    return NextResponse.json(
      { error: "forbidden_origin" },
      { status: 403 },
    );
  }

  const body = await req.text();
  const forwardHeaders = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) forwardHeaders.set("content-type", contentType);
  const auth = req.headers.get("authorization");
  if (auth) forwardHeaders.set("authorization", auth);
  const cookie = req.headers.get("cookie");
  if (cookie) forwardHeaders.set("cookie", cookie);

  const upstream = await fetch(`${readApiUrl()}${FORWARD_PATH}`, {
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
