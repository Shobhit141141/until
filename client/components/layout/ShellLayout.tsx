"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { apiFetch, type UserMe } from "@/lib/api";
import { AppShell } from "./AppShell";

export function ShellLayout({ children }: { children: ReactNode }) {
  const { address: wallet, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    if (!wallet) {
      setUser(null);
      return;
    }
    apiFetch<UserMe>(`/users/me?wallet=${encodeURIComponent(wallet)}`)
      .then((res) => {
        if (res.data) setUser(res.data);
      })
      .catch(() => {});
  }, [wallet]);

  return (
    <AppShell
      username={user?.username ?? undefined}
      walletAbbrev={wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : undefined}
      profileImageUrl={user?.pfpUrl}
      onRunHistory={wallet ? () => router.push("/profile") : undefined}
      onTxHistory={wallet ? () => router.push("/profile") : undefined}
      onTxHistoryLabel="Tx History"
      onCredits={wallet ? () => router.push("/?open=credits") : undefined}
      onProfile={wallet ? () => router.push("/profile") : undefined}
      onDisconnect={wallet ? disconnectWallet : undefined}
      onConnect={!wallet ? connectWallet : undefined}
      isConnecting={isConnecting}
    >
      {children}
    </AppShell>
  );
}
