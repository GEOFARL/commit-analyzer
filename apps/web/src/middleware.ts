import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";

// Literal references required so Next.js inlines these at build time.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

const GUEST_ONLY_PATHS = ["/", "/login"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { pathname } = request.nextUrl;
    const { strippedPath, localePrefix } = parseLocale(pathname);

    if (GUEST_ONLY_PATHS.includes(strippedPath)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = `${localePrefix}/dashboard`;
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}

function parseLocale(pathname: string): {
  strippedPath: string;
  localePrefix: string;
} {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) {
      return {
        strippedPath: "/",
        localePrefix: locale !== routing.defaultLocale ? `/${locale}` : "",
      };
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return {
        strippedPath: pathname.slice(`/${locale}`.length),
        localePrefix: locale !== routing.defaultLocale ? `/${locale}` : "",
      };
    }
  }
  return { strippedPath: pathname, localePrefix: "" };
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
