"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode, type ComponentType } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
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
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { GoHomeLink } from "@/components/ui/GoHomeLink";

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
  const labels: Record<string, string> = {
    top_up: "Top-up",
    deduct: "Debit",
    profit: "Profit",
    loss: "Loss",
    refund: "Refund",
    withdraw: "Withdraw",
    milestone_bonus: "Bonus",
  };
  return labels[type] ?? type;
}

const TX_TYPE_STYLE: Record<string, { bg: string; text: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }> = {
  top_up: { bg: "bg-emerald-100", text: "text-emerald-800", icon: HiArrowDownCircle },
  deduct: { bg: "bg-amber-100", text: "text-amber-800", icon: HiMinusCircle },
  profit: { bg: "bg-green-100", text: "text-green-800", icon: HiArrowTrendingUp },
  loss: { bg: "bg-red-100", text: "text-red-800", icon: HiArrowTrendingUp },
  refund: { bg: "bg-sky-100", text: "text-sky-800", icon: HiArrowPath },
  withdraw: { bg: "bg-violet-100", text: "text-violet-800", icon: HiArrowUpCircle },
  milestone_bonus: { bg: "bg-amber-100", text: "text-amber-800", icon: HiTrophy },
};
const TX_TYPE_DEFAULT = { bg: "bg-gray-100", text: "text-gray-800", icon: HiCurrencyDollar };

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
      toast.error(res.error);
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
      if (r.error) {
        setRunsError(r.error);
        toast.error(r.error);
      }
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
      if (r.error) {
        setTxError(r.error);
        toast.error(r.error);
      }
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
      toast.error(res.error);
      return;
    }
    if (res.data) {
      setUser(res.data);
      setIsEditing(false);
      toast.success("Profile updated");
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
          <GoHomeLink variant="link" />
        </div>
        <div
          className="rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] border-[var(--ui-border)] p-8 text-center"
          style={{ borderStyle: "solid" }}
        >
          <p className="text-[var(--ui-neutral-muted)]">Connect your wallet to view profile.</p>
          <GoHomeLink className="mt-3" />
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
        <GoHomeLink variant="link" />
      </div>

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
                        className="shrink-0 rounded-xl border-2 border-black px-3 py-1.5 text-xs font-medium hover:bg-black/5 transition-colors"
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
                  className="mt-4 w-fit"
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

          {/* Run history with expand — outcome-colored cards, labeled metrics */}
          <div
            className="rounded-xl border-2 border-[var(--ui-border)] p-4 flex flex-col flex-1 min-h-[280px] bg-[var(--ui-neutral-bg)]/50"
            style={{ borderStyle: "solid" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <HiTrophy className="w-4 h-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[var(--ui-neutral-text)] uppercase tracking-wider">
                  Run history
                </h3>
                <p className="text-xs text-[var(--ui-neutral-muted)]">Score, spent, earned, and net per run</p>
              </div>
            </div>
            {runsLoading && <p className="text-sm text-[var(--ui-neutral-muted)] py-4">Loading…</p>}
            {!runsLoading && !runsError && runs.length === 0 && (
              <p className="text-sm text-[var(--ui-neutral-muted)] py-4">No runs yet. Play from the home screen.</p>
            )}
            {!runsLoading && runs.length > 0 && (
              <ul className="flex flex-col gap-3 overflow-y-auto flex-1 -mx-1 px-1">
                {runs.map((run) => {
                  const isExpanded = expandedRunId === run.runId;
                  const netStx = run.earned - run.spent;
                  const outcome: "profit" | "loss" | "even" =
                    netStx > 0 ? "profit" : netStx < 0 ? "loss" : "even";
                  const outcomeStyle = {
                    profit: { border: "border-l-emerald-500", bg: "bg-emerald-50/80", pill: "bg-emerald-100 text-emerald-800" },
                    loss: { border: "border-l-red-500", bg: "bg-red-50/80", pill: "bg-red-100 text-red-800" },
                    even: { border: "border-l-slate-400", bg: "bg-slate-50/80", pill: "bg-slate-100 text-slate-700" },
                  }[outcome];
                  return (
                    <li
                      key={run.runId}
                      className={`rounded-lg border-2 border-[var(--ui-border)] border-l-4 overflow-hidden shrink-0 ${outcomeStyle.border} ${outcomeStyle.bg}`}
                      style={{ borderStyle: "solid" }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRunId((id) => (id === run.runId ? null : run.runId))
                        }
                        className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:opacity-95 transition-opacity"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-[var(--ui-neutral-muted)]">
                            {formatDate(run.createdAt)}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${outcomeStyle.pill}`}>
                            {outcome === "profit" ? "+" : ""}
                            <Money stx={netStx} />
                            {outcome === "even" ? " net" : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="text-[var(--ui-neutral-muted)]">
                            Score <strong className="text-[var(--ui-neutral-text)] font-tabular">{run.score}</strong>
                          </span>
                          <span className="text-[var(--ui-neutral-muted)]">
                            Spent <strong className="text-amber-700 font-tabular"><Money stx={run.spent} /></strong>
                          </span>
                          <span className="text-[var(--ui-neutral-muted)]">
                            Earned <strong className="text-emerald-700 font-tabular"><Money stx={run.earned} /></strong>
                          </span>
                        </div>
                        {isExpanded ? (
                          <HiChevronDown className="w-5 h-5 text-[var(--ui-neutral-muted)] shrink-0" aria-hidden />
                        ) : (
                          <HiChevronRight className="w-5 h-5 text-[var(--ui-neutral-muted)] shrink-0" aria-hidden />
                        )}
                      </button>
                      {isExpanded && run.questions && run.questions.length > 0 && (
                        <div className="border-t-2 border-[var(--ui-border)] p-4 bg-black/5">
                          <h4 className="text-xs font-bold text-[var(--ui-neutral-muted)] uppercase tracking-wider mb-3">
                            Questions in this run
                          </h4>
                          <ul className="space-y-4">
                            {run.questions.map((q, i) => (
                              <li key={i} className="flex flex-col gap-1 pl-2 border-l-2 border-amber-200" style={{ borderStyle: "solid" }}>
                                <p className="text-sm font-medium text-[var(--ui-neutral-text)]">
                                  Q{q.level ?? i + 1}: {q.question}
                                </p>
                                <p className="text-xs text-[var(--ui-neutral-muted)]">
                                  Your answer: option {q.selectedIndex + 1} · <span className="font-tabular text-emerald-600">+{q.points} pts</span>
                                </p>
                                {q.correctOptionText && (
                                  <p className="text-xs text-emerald-700 mt-0.5">
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
          className="rounded-xl border-2 border-[var(--ui-border)] p-4 flex flex-col min-h-[400px] lg:min-h-0 bg-[var(--ui-neutral-bg)]/50"
          style={{ borderStyle: "solid" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <HiWallet className="w-4 h-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--ui-neutral-text)] uppercase tracking-wider">
                Transaction history
              </h3>
              <p className="text-xs text-[var(--ui-neutral-muted)]">Top-ups, profits, withdrawals</p>
            </div>
          </div>
          {txLoading && <p className="text-sm text-[var(--ui-neutral-muted)] py-4">Loading…</p>}
          {!txLoading && !txError && transactions.length === 0 && (
            <p className="text-sm text-[var(--ui-neutral-muted)] py-4">No transactions yet.</p>
          )}
          {!txLoading && transactions.length > 0 && (
            <ul className="space-y-2 overflow-y-auto flex-1 -mx-1 px-1">
              {transactions.map((tx) => {
                const style = TX_TYPE_STYLE[tx.type] ?? TX_TYPE_DEFAULT;
                const Icon = style.icon;
                const amountStx = tx.amountMicroStx / MICRO_STX_PER_STX;
                const isNegative = amountStx < 0;
                return (
                  <li
                    key={tx.id}
                    className={`rounded-lg border-2 ${style.bg} ${style.text} p-3 flex items-center justify-between gap-3 shadow-sm`}
                    style={{ borderStyle: "solid", borderColor: "currentColor" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center">
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                      <div>
                        <span className="font-semibold block text-sm">
                          {txTypeLabel(tx.type)}
                        </span>
                        <span className="text-xs opacity-80">
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className={`font-mono font-tabular font-semibold shrink-0 text-sm ${isNegative ? "" : ""}`}>
                      {isNegative ? "" : "+"}{(amountStx).toFixed(4)} STX
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
