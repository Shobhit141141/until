"use client";

import Link from "next/link";
import { type ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HiBanknotes, HiClock, HiDocumentText, HiPlayCircle, HiChatBubbleLeftRight, HiBars3, HiXMark } from "react-icons/hi2";

const navItemClass =
  "flex items-center gap-3 w-full rounded-xl border-2 border-gray-800 bg-white py-3 px-4 text-left text-sm font-medium text-gray-900 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] transition-all hover:bg-amber-50 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] hover:-translate-y-0.5";

interface AppShellProps {
  children: ReactNode;
  /** When connected: username and wallet abbrev for sidebar profile. */
  username?: string | null;
  walletAbbrev?: string;
  profileImageUrl?: string | null;
  onRunHistory?: () => void;
  onTxHistory?: () => void;
  onTxHistoryLabel?: string;
  onCredits?: () => void;
  onProfile?: () => void;
  /** When connected, show disconnect in profile area. */
  onDisconnect?: () => void;
  /** If not connected, show connect CTA in profile area. */
  onConnect?: () => void;
  isConnecting?: boolean;
}

export function AppShell({
  children,
  username,
  walletAbbrev,
  profileImageUrl,
  onRunHistory,
  onTxHistory,
  onTxHistoryLabel = "Tx History",
  onCredits,
  onProfile,
  onDisconnect,
  onConnect,
  isConnecting,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const profileSection = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => { onProfile?.(); setSidebarOpen(false); }}
        className="w-full rounded-xl border-2 border-gray-800 bg-white p-4 text-left shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] transition-all hover:bg-amber-50 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (username?.slice(0, 2) || "?").toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{username || "—"}</p>
            <p className="truncate text-xs text-gray-500 font-mono">{walletAbbrev || "—"}</p>
          </div>
        </div>
      </button>
      {onDisconnect && (
        <button
          type="button"
          onClick={() => {
            onDisconnect();
            setSidebarOpen(false);
            window.location.href = "/";
          }}
          className="w-full rounded-xl border-2 border-gray-300 bg-white py-2 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Disconnect
        </button>
      )}
    </div>
  );

  const closeSidebar = () => setSidebarOpen(false);

  const nav = (
    <nav className="flex flex-col gap-2 border-gray-800">
      {onCredits && (
        <button type="button" onClick={() => { onCredits(); closeSidebar(); }} className={navItemClass}>
          <HiBanknotes className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden />
          Credits
        </button>
      )}
      {onRunHistory && (
        <button type="button" onClick={() => { onRunHistory(); closeSidebar(); }} className={navItemClass}>
          <HiClock className="w-5 h-5 shrink-0 text-sky-600" aria-hidden />
          Run History
        </button>
      )}
      {onTxHistory && (
        <button type="button" onClick={() => { onTxHistory(); closeSidebar(); }} className={navItemClass}>
          <HiDocumentText className="w-5 h-5 shrink-0 text-gray-600" aria-hidden />
          {onTxHistoryLabel}
        </button>
      )}
      <Link href="/feedback" className={navItemClass} onClick={closeSidebar}>
        <HiChatBubbleLeftRight className="w-5 h-5 shrink-0 text-gray-600" aria-hidden />
        Feedback?
      </Link>
    </nav>
  );

  const sidebarContent = (
    <>
      <div className="border-none border-gray-800 p-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-900" onClick={() => setSidebarOpen(false)}>
          <img src="/logo.png" alt="UNTIL" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
          <span className="text-lg font-bold">UNTIL</span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 -m-2 rounded-lg hover:bg-gray-100"
          aria-label="Close menu"
        >
          <HiXMark className="w-6 h-6 text-gray-700" />
        </button>
      </div>
      {nav}
      <div className="mt-auto">
        {onConnect ? (
          <div className="rounded-xl border-2 border-gray-800 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)]">
            <p className="text-sm text-gray-600 mb-2">Connect wallet to play</p>
            <button
              type="button"
              onClick={onConnect}
              disabled={isConnecting}
              className="w-full rounded-lg border-2 border-gray-800 bg-black py-2 px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
          </div>
        ) : (
          profileSection
        )}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile: top bar with menu button */}
      <header className="lg:hidden shrink-0 flex items-center gap-3 border-b-2 border-gray-800 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Open menu"
        >
          <HiBars3 className="w-6 h-6 text-gray-800" />
        </button>
        <Link href="/" className="flex items-center gap-2 text-gray-900">
          <img src="/logo.png" alt="UNTIL" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
          <span className="text-lg font-bold">UNTIL</span>
        </Link>
      </header>

      {/* Mobile: sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] flex flex-col border-r-2 border-gray-800 bg-white px-2 py-2 shadow-xl">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Desktop: always-visible sidebar */}
      <aside className="hidden lg:flex lg:w-56 shrink-0 flex-col border-r-2 border-gray-800 bg-[#fcf4ef] px-2 py-2">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col p-4 lg:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
