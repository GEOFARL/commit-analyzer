"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, ReactNode } from "react";

export const ThemeProvider = ({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider> & { children: ReactNode }) => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
