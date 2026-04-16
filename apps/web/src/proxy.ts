import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

// Literal process.env references are required so Next.js inlines the values
// at build time. The helper narrows the type to string and throws early with
// a readable message rather than deferring to a runtime non-null assertion.
function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const SUPABASE_ANON_KEY = requireEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const GUEST_ONLY_PATHS = ["/", "/login"];

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { strippedPath, localePrefix } = parseLocale(pathname);

  if (GUEST_ONLY_PATHS.includes(strippedPath)) {
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
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = `${localePrefix}/dashboard`;
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return intlMiddleware(request);
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
  matcher: "/((?!api|trpc|auth|_next|_vercel|.*\\..*).*)",
};
