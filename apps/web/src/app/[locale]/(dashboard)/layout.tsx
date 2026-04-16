import { type Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardUser = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as {
    full_name?: string;
    user_name?: string;
    name?: string;
    avatar_url?: string;
  };
  const dashboardUser: DashboardUser = {
    email: user.email ?? null,
    name:
      metadata.full_name ??
      metadata.name ??
      metadata.user_name ??
      user.email ??
      null,
    avatarUrl: metadata.avatar_url ?? null,
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={dashboardUser} />
        <main id="main-content" className="flex-1 px-6 py-8 md:px-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
