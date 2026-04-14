import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const supabase = await createSupabaseServerClient();
  const origin = new URL(request.url).origin;
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
