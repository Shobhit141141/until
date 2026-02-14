"use client";

import { useWallet } from "@/contexts/WalletContext";

export function WalletButton() {
  const { address, isConnecting, connectWallet, disconnectWallet } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600 truncate max-w-[120px]">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={disconnectWallet}
          className="text-sm border rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connectWallet}
      disabled={isConnecting}
      className="rounded bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
    >
      {isConnecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
