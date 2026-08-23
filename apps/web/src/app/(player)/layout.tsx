import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

export default function PlayerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
