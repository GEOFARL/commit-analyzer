import { NextResponse } from "next/server";

import { getClientEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sanitizeNext = (raw: string | null): string => {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(new URL("/?auth_error=no_user", url.origin));
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    const { NEXT_PUBLIC_API_URL } = getClientEnv();
    const authHeader = { authorization: `Bearer ${session.access_token}` };

    // Mirror the authenticated Supabase user into public.users and store the
    // encrypted GitHub provider_token BEFORE the user can hit any authenticated
    // API endpoint. Without this, /me and /repos/:id/connect 401/500 because
    // public.users has no row for the new auth.users id.
    //
    // Failure here is terminal for the login: if we proceed to /dashboard, the
    // encrypted provider_token is silently lost, so we bounce back to / with an
    // error so the user can retry from a fresh Supabase session.
    let syncOk = false;
    try {
      const syncResponse = await fetch(`${NEXT_PUBLIC_API_URL}/auth/sync`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader },
        body: JSON.stringify({ providerToken: session.provider_token ?? null }),
      });
      syncOk = syncResponse.ok;
      if (!syncResponse.ok) {
        console.warn("auth.sync failed", syncResponse.status);
      }
    } catch (err) {
      console.warn("auth.sync threw", err);
    }

    if (!syncOk) {
      return NextResponse.redirect(
        new URL("/?auth_error=sync_failed", url.origin),
      );
    }

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/auth/sign-in-event`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader },
        body: JSON.stringify({ provider: "github" }),
      });
      if (!response.ok) {
        console.warn("auth.login event dispatch failed", response.status);
      }
    } catch (err) {
      console.warn("auth.login event dispatch threw", err);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
};
