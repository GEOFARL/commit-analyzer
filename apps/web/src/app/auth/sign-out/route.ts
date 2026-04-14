import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sign-out`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // Non-fatal.
    }
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
};
