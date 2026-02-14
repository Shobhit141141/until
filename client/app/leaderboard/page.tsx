import { apiFetch, type LeaderboardEntry } from "@/lib/api";
import Link from "next/link";

export default async function LeaderboardPage() {
  const res = await apiFetch<LeaderboardEntry[]>("/leaderboard?limit=50");
  const entries = res.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-zinc-600 hover:text-foreground">
          ← Play
        </Link>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
      </div>
      {entries.length === 0 ? (
        <p className="text-zinc-600">No entries yet.</p>
      ) : (
        <table className="w-full border-collapse border border-zinc-200 dark:border-zinc-700">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800">
              <th className="border border-zinc-200 dark:border-zinc-700 p-2 text-left">
                #
              </th>
              <th className="border border-zinc-200 dark:border-zinc-700 p-2 text-left">
                User
              </th>
              <th className="border border-zinc-200 dark:border-zinc-700 p-2 text-right">
                Best score
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.walletAddress}>
                <td className="border border-zinc-200 dark:border-zinc-700 p-2">
                  {i + 1}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-700 p-2">
                  {e.username ?? e.walletAddress.slice(0, 8) + "…"}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-700 p-2 text-right">
                  {e.bestScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
