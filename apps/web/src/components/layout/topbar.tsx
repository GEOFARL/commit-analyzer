import { LanguageToggle } from "@/components/layout/language-toggle";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

type TopbarProps = {
  title: string;
  user: {
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
};

export const Topbar = ({ title, user }: TopbarProps) => (
  <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-md">
    <div className="flex items-center gap-2">
      <MobileSidebar />
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
    </div>
    <div className="flex items-center gap-1">
      <LanguageToggle />
      <ThemeToggle />
      <UserMenu {...user} />
    </div>
  </header>
);
