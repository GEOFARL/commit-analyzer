import { LanguageToggle } from "@/components/layout/language-toggle";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

type TopbarProps = {
  user: {
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
};

export const Topbar = ({ user }: TopbarProps) => (
  <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-md">
    <div className="flex items-center gap-2">
      <MobileSidebar />
    </div>
    <div className="flex items-center gap-1">
      <LanguageToggle />
      <ThemeToggle />
      <UserMenu {...user} />
    </div>
  </header>
);
