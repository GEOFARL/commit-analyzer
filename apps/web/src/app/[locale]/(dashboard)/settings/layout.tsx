import type { ReactNode } from "react";

import { SettingsNav } from "@/components/shared/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsNav />
      {children}
    </div>
  );
}
