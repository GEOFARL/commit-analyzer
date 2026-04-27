import { NextResponse } from "next/server";

import { getClientEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return new Response(null, { status: 401 });
  }

  try {
    const { NEXT_PUBLIC_API_URL } = getClientEnv();
    const response = await fetch(`${NEXT_PUBLIC_API_URL}/me`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      console.error("delete-account failed", response.status);
      return NextResponse.redirect(
        new URL("/settings?error=delete_failed", request.url),
        { status: 303 },
      );
    }
  } catch (err) {
    console.error("delete-account threw", err);
    return NextResponse.redirect(
      new URL("/settings?error=delete_failed", request.url),
      { status: 303 },
    );
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("supabase.signOut after account delete threw", err);
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
};
