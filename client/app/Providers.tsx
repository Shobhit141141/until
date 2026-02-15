"use client";

import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/contexts/WalletContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <Toaster position="bottom-left" toastOptions={{ duration: 4000 }} />
    </WalletProvider>
  );
}
