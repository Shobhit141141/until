"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode, type ComponentType } from "react";
import Link from "next/link";
import {
  HiCurrencyDollar,
  HiArrowTrendingUp,
  HiTrophy,
  HiWallet,
  HiChevronDown,
  HiChevronRight,
  HiArrowDownCircle,
  HiArrowUpCircle,
  HiMinusCircle,
  HiArrowPath,
} from "react-icons/hi2";
import {
  apiFetch,
  type UserMe,
  type RunHistoryResponse,
  type RunHistoryEntry,
  type CreditsHistoryResponse,
  type CreditTransactionEntry,
  type CheckUsernameResponse,
} from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { Button, Money } from "@/components/ui";

const MICRO_STX_PER_STX = 1_000_000;
const USERNAME_DEBOUNCE_MS = 400;
type UsernameStatus = "idle" | "checking" | "available" | "taken";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txTypeLabel(type: CreditTransactionEntry["type"]): string {
  const labels: Record<CreditTransactionEntry["type"], string> = {
    top_up: "Top-up",
    deduct: "Deduct",
    profit: "Profit",
    refund: "Refund",
    withdraw: "Withdraw",
  };
  return labels[type] ?? type;
}

const TX_TYPE_STYLE: Record<
  CreditTransactionEntry["type"],
  { bg: string; text: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }
> = {
  top_up: { bg: "bg-emerald-100", text: "text-emerald-800", icon: HiArrowDownCircle },
  deduct: { bg: "bg-amber-100", text: "text-amber-800", icon: HiMinusCircle },
  profit: { bg: "bg-green-100", text: "text-green-800", icon: HiArrowTrendingUp },
  refund: { bg: "bg-sky-100", text: "text-sky-800", icon: HiArrowPath },
  withdraw: { bg: "bg-violet-100", text: "text-violet-800", icon: HiArrowUpCircle },
};

/** Simple URL check for image preview. */
function isValidImageUrl(s: string): boolean {
  if (!s?.trim()) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Avatar: image or placeholder with initials. */
function ProfileAvatar({
  src,
  username,
  className = "",
  size = 96,
}: {
  src: string | null | undefined;
  username: string | null | undefined;
  className?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const showImg = src && isValidImageUrl(src) && !imgError;
  const initials = (username?.trim() || "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!src || !isValidImageUrl(src)) setImgError(false);
    else setImgError(false);
  }, [src]);

  if (showImg) {
    return (
      <img
        src={src}
        alt={username || "Profile"}
        width={size}
        height={size}
        className={`rounded-full object-cover border-2 border-[var(--ui-border)] ${className}`}
        style={{ borderStyle: "solid", width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-[var(--ui-border)] flex items-center justify-center font-bold text-[var(--ui-neutral-text)] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export default function ProfilePage() {
  const { address: connectedAddress } = useWallet();
  const wallet = connectedAddress?.trim() ?? "";

  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPfpUrl, setEditPfpUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [copySuccess, setCopySuccess] = useState(false);
  const editUsernameRef = useRef(editUsername);
  editUsernameRef.current = editUsername;

  const [runs, setRuns] = useState<RunHistoryEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<CreditTransactionEntry[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    const res = await apiFetch<UserMe>(`/users/me?wallet=${encodeURIComponent(wallet)}`);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setUser(null);
      return;
    }
    if (res.data) {
      setUser(res.data);
      setEditUsername(res.data.username ?? "");
      setEditPfpUrl(res.data.pfpUrl ?? "");
      setIsEditing(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) loadUser();
  }, [wallet, loadUser]);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    (async () => {
      setRunsLoading(true);
      setRunsError(null);
      const r = await apiFetch<RunHistoryResponse>(
        `/run/history?walletAddress=${encodeURIComponent(wallet)}&limit=20`
      );
      if (cancelled) return;
      setRunsLoading(false);
      if (r.error) setRunsError(r.error);
      else setRuns(r.data?.runs ?? []);
    })();
    (async () => {
      setTxLoading(true);
      setTxError(null);
      const r = await apiFetch<CreditsHistoryResponse>(
        `/credits/history?walletAddress=${encodeURIComponent(wallet)}&limit=50`
      );
      if (cancelled) return;
      setTxLoading(false);
      if (r.error) setTxError(r.error);
      else setTransactions(r.data?.transactions ?? []);
    })();
    return () => { cancelled = true; };
  }, [wallet]);

  const saveProfile = async () => {
    if (!wallet.trim()) return;
    setSaving(true);
    setError(null);
    const res = await apiFetch<UserMe>("/users/me", {
      method: "PATCH",
      body: {
        wallet: wallet.trim(),
        username: editUsername.trim() || undefined,
        pfpUrl: editPfpUrl.trim() || undefined,
      },
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setUser(res.data);
      setIsEditing(false);
    }
  };

  const cancelEdit = () => {
    if (user) {
      setEditUsername(user.username ?? "");
      setEditPfpUrl(user.pfpUrl ?? "");
    }
    setIsEditing(false);
    setUsernameStatus("idle");
  };

  // Debounced username availability check (only when editing).
  useEffect(() => {
    if (!isEditing || !wallet) return;
    const name = editUsername.trim();
    if (!name) {
      setUsernameStatus("idle");
      return;
    }
    if (user?.username?.trim() === name) {
      setUsernameStatus("available");
      return;
    }
    const t = setTimeout(async () => {
      setUsernameStatus("checking");
      const res = await apiFetch<CheckUsernameResponse>(
        `/users/check-username?username=${encodeURIComponent(name)}&wallet=${encodeURIComponent(wallet)}`
      );
      if (editUsernameRef.current.trim() !== name) return;
      setUsernameStatus(res.data?.available ? "available" : "taken");
    }, USERNAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [isEditing, editUsername, wallet, user?.username]);

  const copyWallet = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
  };

  if (!wallet) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--ui-neutral-text)]">Profile</h1>
          <Link href="/" className="text-sm text-[var(--ui-neutral-muted)] underline">
            Back
          </Link>
        </div>
        <div
          className="rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] border-[var(--ui-border)] p-8 text-center"
          style={{ borderStyle: "solid" }}
        >
          <p className="text-[var(--ui-neutral-muted)]">Connect your wallet to view profile.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-[var(--ui-accent)] font-medium underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const insightBadges = user
    ? [
        {
          label: "Spent",
          value: <Money stx={user.totalSpent} />,
          icon: HiCurrencyDollar,
          bg: "bg-amber-100",
          text: "text-amber-800",
          border: "border-amber-300",
        },
        {
          label: "Earned",
          value: <Money stx={user.totalEarned} />,
          icon: HiArrowTrendingUp,
          bg: "bg-emerald-100",
          text: "text-emerald-800",
          border: "border-emerald-300",
        },
        {
          label: "Best score",
          value: user.bestScore.toFixed(3),
          icon: HiTrophy,
          bg: "bg-sky-100",
          text: "text-sky-800",
          border: "border-sky-300",
        },
        {
          label: "Credits",
          value: <Money stx={user.creditsStx} />,
          icon: HiWallet,
          bg: "bg-violet-100",
          text: "text-violet-800",
          border: "border-violet-300",
        },
      ]
    : [];

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--ui-neutral-text)]">Profile</h1>
        <Link href="/" className="text-sm text-[var(--ui-neutral-muted)] underline">
          Back
        </Link>
      </div>

      {error && (
        <p className="text-sm text-[var(--ui-failure)] mb-4">{error}</p>
      )}

      {/* Bento: full-width two columns — left: profile + insights + runs; right: tx history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-h-[60vh]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Profile card */}
          <div
            className="rounded-none border-2 border-[var(--ui-border)] p-5 shrink-0"
            style={{ borderStyle: "solid" }}
          >
            {loading && !user && (
              <p className="text-sm text-[var(--ui-neutral-muted)]">Loading profile…</p>
            )}
            {user && !isEditing && (
              <>
                <div className="flex items-center gap-4">
                  <ProfileAvatar src={user.pfpUrl} username={user.username} size={72} />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--ui-neutral-text)] truncate">
                      {user.username || "No username"}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <code className="text-xs font-mono text-[var(--ui-neutral-muted)] bg-black/5 px-2 py-1 rounded-none break-all max-w-[200px]">
                        {user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}
                      </code>
                      <button
                        type="button"
                        onClick={copyWallet}
                        className="shrink-0 rounded-none border-2 border-black px-3 py-1.5 text-xs font-medium hover:bg-black/5 transition-colors"
                        style={{ borderStyle: "solid" }}
                      >
                        {copySuccess ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditUsername(user.username ?? "");
                    setEditPfpUrl(user.pfpUrl ?? "");
                    setIsEditing(true);
                  }}
                  className="mt-4 w-fit px-4 py-2 rounded-none border-2 bg-black text-white border-black hover:bg-black/80 transition-colors"
                >
                  Edit profile
                </Button>
              </>
            )}
            {user && isEditing && (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <ProfileAvatar src={editPfpUrl} username={editUsername} size={72} />
                  <p className="text-sm text-[var(--ui-neutral-muted)]">
                    Preview updates when you enter a valid image URL below.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--ui-neutral-muted)] block mb-1">
                      Username
                    </label>
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="Display name"
                        className="w-full rounded-none border-2 border-[var(--ui-border)] bg-[var(--ui-neutral-bg)] px-3 py-2 text-sm"
                        style={{ borderStyle: "solid" }}
                      />
                      {usernameStatus === "checking" && (
                        <span className="text-xs text-[var(--ui-neutral-muted)]">Checking…</span>
                      )}
                      {usernameStatus === "available" && (
                        <span className="text-xs text-[var(--ui-success)]">Username available</span>
                      )}
                      {usernameStatus === "taken" && (
                        <span className="text-xs text-[var(--ui-failure)]">Username already taken</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--ui-neutral-muted)] block mb-1">
                      Profile image URL
                    </label>
                    <input
                      type="url"
                      value={editPfpUrl}
                      onChange={(e) => setEditPfpUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-none border-2 border-[var(--ui-border)] bg-[var(--ui-neutral-bg)] px-3 py-2 text-sm"
                      style={{ borderStyle: "solid" }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={saveProfile}
                      disabled={saving || usernameStatus === "taken" || usernameStatus === "checking"}
                      className="w-fit border-2 border-black hover:bg-black/80 transition-colors"
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" onClick={cancelEdit} disabled={saving} className="w-fit">
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            )}
            {!loading && !user && (
              <p className="text-sm text-[var(--ui-neutral-muted)]">No profile found. Play a run to create one.</p>
            )}
          </div>

          {/* Tx insights — 4 colored badges */}
          {insightBadges.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              {insightBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.label}
                    className={`rounded-none border-2 ${badge.bg} ${badge.border} ${badge.text} p-4`}
                    style={{ borderStyle: "solid" }}
                  >
                    <Icon className="w-5 h-5 mb-2 opacity-80" aria-hidden />
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                      {badge.label}
                    </p>
                    <p className="mt-0.5 font-mono font-tabular text-sm font-bold">
                      {badge.value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Run history with expand */}
          <div
            className="rounded-none border-2 border-[var(--ui-border)] p-4 flex flex-col flex-1 min-h-[280px]"
            style={{ borderStyle: "solid" }}
          >
            <h3 className="text-sm font-bold text-[var(--ui-neutral-text)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <HiTrophy className="w-4 h-4 text-amber-500" />
              Run history
            </h3>
            {runsLoading && <p className="text-sm text-[var(--ui-neutral-muted)]">Loading…</p>}
            {runsError && <p className="text-sm text-[var(--ui-failure)]">{runsError}</p>}
            {!runsLoading && !runsError && runs.length === 0 && (
              <p className="text-sm text-[var(--ui-neutral-muted)]">No runs yet.</p>
            )}
            {!runsLoading && runs.length > 0 && (
              <ul className="flex flex-col gap-2 overflow-y-auto flex-1">
                {runs.map((run) => {
                  const isExpanded = expandedRunId === run.runId;
                  return (
                    <li
                      key={run.runId}
                      className="rounded-none border-2 border-[var(--ui-border)] overflow-hidden shrink-0"
                      style={{ borderStyle: "solid" }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRunId((id) => (id === run.runId ? null : run.runId))
                        }
                        className="w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-black/5"
                      >
                        <span className="text-xs font-mono text-[var(--ui-neutral-muted)]">
                          {formatDate(run.createdAt)}
                        </span>
                        <span className="text-sm font-medium text-[var(--ui-neutral-text)]">
                          Score {run.score} · <Money stx={run.spent} /> · <Money stx={run.earned} />
                        </span>
                        {isExpanded ? (
                          <HiChevronDown className="w-4 h-4 text-[var(--ui-neutral-muted)] shrink-0" aria-hidden />
                        ) : (
                          <HiChevronRight className="w-4 h-4 text-[var(--ui-neutral-muted)] shrink-0" aria-hidden />
                        )}
                      </button>
                      {isExpanded && run.questions && run.questions.length > 0 && (
                        <div className="border-t-2 border-[var(--ui-border)] p-3 bg-black/5">
                          <ul className="space-y-3">
                            {run.questions.map((q, i) => (
                              <li key={i} className="text-sm">
                                <p className="text-[var(--ui-neutral-text)] font-medium">
                                  Q{q.level ?? i + 1}: {q.question}
                                </p>
                                <p className="text-[var(--ui-neutral-muted)] mt-0.5">
                                  Option {q.selectedIndex + 1} · +{q.points} pts
                                </p>
                                {q.correctOptionText && (
                                  <p className="text-emerald-600 text-xs mt-0.5">
                                    Correct: {q.correctOptionText}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right column — Tx history full height */}
        <div
          className="rounded-none border-2 border-[var(--ui-border)] p-4 flex flex-col min-h-[400px] lg:min-h-0"
          style={{ borderStyle: "solid" }}
        >
          <h3 className="text-sm font-bold text-[var(--ui-neutral-text)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <HiWallet className="w-4 h-4 text-violet-500" />
            Transaction history
          </h3>
          {txLoading && <p className="text-sm text-[var(--ui-neutral-muted)]">Loading…</p>}
          {txError && <p className="text-sm text-[var(--ui-failure)]">{txError}</p>}
          {!txLoading && !txError && transactions.length === 0 && (
            <p className="text-sm text-[var(--ui-neutral-muted)]">No transactions yet.</p>
          )}
          {!txLoading && transactions.length > 0 && (
            <ul className="space-y-2 overflow-y-auto flex-1">
              {transactions.map((tx) => {
                const style = TX_TYPE_STYLE[tx.type];
                const Icon = style.icon;
                return (
                  <li
                    key={tx.id}
                    className={`rounded-none border-2 ${style.bg} ${style.text} p-3 flex items-center justify-between gap-3`}
                    style={{ borderStyle: "solid", borderColor: "currentColor" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 w-8 h-8 rounded-none bg-white/60 flex items-center justify-center">
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                      <div>
                        <span className="font-semibold block">
                          {txTypeLabel(tx.type)}
                        </span>
                        <span className="text-xs opacity-80">
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-tabular font-semibold shrink-0">
                      {(tx.amountMicroStx / MICRO_STX_PER_STX).toFixed(4)} STX
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
