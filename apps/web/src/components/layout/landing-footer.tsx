import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/layout/logo-mark";

export const LandingFooter = async () => {
  const t = await getTranslations("landing");
  const tf = await getTranslations("landing.footer");
  const year = new Date().getFullYear();

  const groups = [
    {
      title: tf("product"),
      links: [
        { label: tf("links.dashboard"), href: "/dashboard" },
        {
          label: tf("links.cli"),
          href: "https://www.npmjs.com/package/git-insight-cli",
        },
      ],
    },
    {
      title: tf("resources"),
      links: [
        {
          label: tf("links.apiDocs"),
          href: "https://poetic-luck-production.up.railway.app/api/docs",
        },
        {
          label: tf("links.github"),
          href: "https://github.com/maxym0524/commit-analyzer",
        },
        { label: tf("links.readme"), href: "/dashboard" },
      ],
    },
  ];

  return (
    <footer className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-8">
      <div className="grid gap-10 border-t border-border/60 pt-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("appName")}
            </span>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {tf("tagline")}
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-2 text-sm">
              {group.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-foreground/80 transition-colors hover:text-primary"
                    rel="noreferrer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        {tf("copyright", { year })}
      </p>
    </footer>
  );
};
