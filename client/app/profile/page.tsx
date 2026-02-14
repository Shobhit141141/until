"use client";

import { useState, useEffect } from "react";
import { apiFetch, type UserMe } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";

export default function ProfilePage() {
  const { address: connectedAddress } = useWallet();
  const [wallet, setWallet] = useState("");
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPfpUrl, setEditPfpUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connectedAddress) setWallet((prev) => prev || connectedAddress);
  }, [connectedAddress]);

  const loadUser = async () => {
    if (!wallet.trim()) return;
    setLoading(true);
    setError(null);
    const res = await apiFetch<UserMe>(`/users/me?wallet=${encodeURIComponent(wallet.trim())}`);
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
    }
  };

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
    if (res.data) setUser(res.data);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="flex flex-col gap-2">
        <label className="font-medium">Wallet address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="STX wallet address"
            className="flex-1 border rounded px-3 py-2 text-foreground bg-background"
          />
          <button
            type="button"
            onClick={loadUser}
            className="rounded bg-foreground text-background px-4 py-2 font-medium"
          >
            Load
          </button>
        </div>
      </div>
      {loading && <p className="text-zinc-600">Loading…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
      {user && (
        <div className="flex flex-col gap-4 border rounded p-4">
          <p className="text-sm text-zinc-500 break-all">
            {user.walletAddress}
          </p>
          <div>
            <label className="font-medium block mb-1">Username</label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="w-full border rounded px-3 py-2 text-foreground bg-background"
            />
          </div>
          <div>
            <label className="font-medium block mb-1">Profile image URL</label>
            <input
              type="url"
              value={editPfpUrl}
              onChange={(e) => setEditPfpUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border rounded px-3 py-2 text-foreground bg-background"
            />
          </div>
          <p className="text-zinc-600 text-sm">
            Total spent: {user.totalSpent} STX · Earned: {user.totalEarned} STX ·
            Best score: {user.bestScore}
          </p>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
