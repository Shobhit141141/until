"use client";

import { Providers } from "../Providers";
import { ShellLayout } from "@/components/layout/ShellLayout";

export function MainLayoutClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      <ShellLayout>{children}</ShellLayout>
    </Providers>
  );
}
