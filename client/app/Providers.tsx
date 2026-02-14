"use client";

import { WalletProvider } from "@/contexts/WalletContext";
import { WalletButton } from "@/components/WalletButton";
import Link from "next/link";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <header className="border-b px-4 py-3 flex gap-4 items-center justify-between">
        <nav className="flex gap-4 items-center">
          <Link href="/" className="font-bold">
            UNTIL
          </Link>
          <Link href="/leaderboard" className="text-zinc-600 hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/profile" className="text-zinc-600 hover:text-foreground">
            Profile
          </Link>
        </nav>
        <WalletButton />
      </header>
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
    </WalletProvider>
  );
}
