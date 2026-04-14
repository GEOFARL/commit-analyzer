import { NextResponse } from "next/server";

import { getClientEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    try {
      const { NEXT_PUBLIC_API_URL } = getClientEnv();
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/auth/sign-out`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        console.warn("auth.logout event dispatch failed", response.status);
      }
    } catch (err) {
      console.warn("auth.logout event dispatch threw", err);
    }
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
};
