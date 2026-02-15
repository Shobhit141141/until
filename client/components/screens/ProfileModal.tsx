"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, type UserMe, type CheckUsernameResponse } from "@/lib/api";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

const USERNAME_DEBOUNCE_MS = 400;
type UsernameStatus = "idle" | "checking" | "available" | "taken";

function isValidImageUrl(s: string): boolean {
  if (!s?.trim()) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface ProfileModalProps {
  wallet: string;
  initialUser: UserMe | null;
  onClose: () => void;
  onSaved: (user: UserMe) => void;
}

export function ProfileModal({ wallet, initialUser, onClose, onSaved }: ProfileModalProps) {
  const [user, setUser] = useState<UserMe | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(initialUser?.username ?? "");
  const [editPfpUrl, setEditPfpUrl] = useState(initialUser?.pfpUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const loadUser = useCallback(async () => {
    if (!wallet.trim()) return;
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
      setUsernameStatus(res.data?.available ? "available" : "taken");
    }, USERNAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [isEditing, editUsername, wallet, user?.username]);

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
      onSaved(res.data);
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

  const initials = (user?.username?.trim() || "?").slice(0, 2).toUpperCase();
  const showImg = user?.pfpUrl && isValidImageUrl(user.pfpUrl);

  return (
    <Modal onClose={onClose} title="Profile">
      {loading && !user ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : user && !isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden border-2 border-gray-800 bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
              {showImg ? (
                <img src={user.pfpUrl!} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">{user.username || "No username"}</p>
              <p className="text-xs text-gray-500 font-mono truncate">{user.walletAddress}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Spent: {user.totalSpent.toFixed(4)} STX · Earned: {user.totalEarned.toFixed(4)} STX · Best score: {user.bestScore.toFixed(3)}
          </p>
          <Button variant="secondary" onClick={() => setIsEditing(true)} className="w-full">
            Edit profile
          </Button>
        </div>
      ) : user && isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Username</label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              placeholder="Display name"
              className="w-full border-2 border-gray-800 px-3 py-2 text-sm"
            />
            {usernameStatus === "checking" && <p className="text-xs text-gray-500 mt-0.5">Checking…</p>}
            {usernameStatus === "available" && <p className="text-xs text-green-600 mt-0.5">Available</p>}
            {usernameStatus === "taken" && <p className="text-xs text-red-600 mt-0.5">Username taken</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Profile image URL</label>
            <input
              type="url"
              value={editPfpUrl}
              onChange={(e) => setEditPfpUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border-2 border-gray-800 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={saveProfile} disabled={saving || usernameStatus === "taken" || usernameStatus === "checking"} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No profile found. Play a run to create one.</p>
      )}
    </Modal>
  );
}
