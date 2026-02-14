"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { connect, disconnect, getLocalStorage } from "@stacks/connect";

type WalletContextValue = {
  address: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getStxAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const data = getLocalStorage();
    const stx = (data as { addresses?: { stx?: Array<{ address?: string }> } })
      ?.addresses?.stx?.[0]?.address;
    return stx ?? null;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setAddress(getStxAddress());
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      await connect();
      setAddress(getStxAddress());
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    disconnect();
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnecting,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
