import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const safeOrigin = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export const POST = async (request: Request) => {
  const origin = new URL(request.url).origin;

  const reqOrigin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const refererOrigin = referer ? safeOrigin(referer) : null;
  const sameOrigin =
    (reqOrigin !== null && reqOrigin === origin) ||
    (refererOrigin !== null && refererOrigin === origin);

  if (!sameOrigin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=%2Fdashboard`,
      scopes: "read:user user:email repo",
    },
  });

  if (error || !data?.url) {
    return NextResponse.json(
      { error: error?.message ?? "sign-in failed" },
      { status: 500 },
    );
  }
  return NextResponse.redirect(data.url, { status: 303 });
};
