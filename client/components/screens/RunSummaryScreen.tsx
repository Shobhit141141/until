"use client";

import { Button, Money } from "@/components/ui";
import { getBaseRewardStx, getTimeMultiplier } from "@/lib/tokenomics";

export type LevelBreakdownEntry = {
  level: number;
  timeTakenSec: number;
  allowedSec: number;
  points: number;
};

interface RunSummaryScreenProps {
  correctCount: number;
  totalSpentStx: number;
  totalEarnedStx: number;
  profitStx: number;
  isPractice?: boolean;
  levelBreakdown?: LevelBreakdownEntry[];
  onPlayAgain: () => void;
  onViewCredits?: () => void;
}

/** Run summary: totals + per-level breakdown (time, formula, earned). */
export function RunSummaryScreen({
  correctCount,
  totalSpentStx,
  totalEarnedStx,
  profitStx,
  isPractice,
  levelBreakdown = [],
  onPlayAgain,
  onViewCredits,
}: RunSummaryScreenProps) {
  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-gray-900">
        Run finished{isPractice ? " (practice)" : ""}
      </h2>

      {/* Per-level breakdown */}
      {levelBreakdown.length > 0 && (
        <div className="rounded-xl border-2 border-gray-800 bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 mb-3">
            Level breakdown
          </h3>
          <ul className="space-y-3">
            {levelBreakdown.map((entry, i) => {
              const base = getBaseRewardStx(entry.level);
              const mult = getTimeMultiplier(entry.timeTakenSec, entry.allowedSec);
              const formula = `${base.toFixed(2)} × ${mult}×`;
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-gray-200 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-gray-900">Level {entry.level + 1}</span>
                  <span className="text-gray-500">{entry.timeTakenSec}s</span>
                  <span className="text-gray-600 font-mono">{formula}</span>
                  <span className="font-mono font-tabular text-emerald-700">
                    +{entry.points.toFixed(4)} STX
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border-2 border-gray-800 bg-gray-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Correct</span>
            <span className="font-mono font-tabular">{correctCount}</span>
          </div>
          {!isPractice && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Spent</span>
                <Money stx={totalSpentStx} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Earned</span>
                <Money stx={totalEarnedStx} />
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-gray-900">Net</span>
                <span
                  className={`font-mono font-tabular ${profitStx > 0 ? "text-emerald-600" : profitStx < 0 ? "text-red-600" : "text-gray-900"}`}
                >
                  {profitStx > 0 ? "+" : ""}{profitStx.toFixed(4)} STX
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onPlayAgain} variant="primary" className="w-full py-3">
          Play again
        </Button>
        {onViewCredits && (
          <Button onClick={onViewCredits} variant="secondary" className="w-full py-2">
            View credits
          </Button>
        )}
      </div>
    </section>
  );
}
