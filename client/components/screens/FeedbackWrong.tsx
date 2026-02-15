"use client";

import { Money } from "@/components/ui/Money";
import { getBaseRewardStx, getTimeMultiplier } from "@/lib/tokenomics";
import type { LevelBreakdownEntry } from "./RunSummaryScreen";

export interface FeedbackWrongProps {
  isPractice?: boolean;
  /** When true, show "ran out of time" message (server-authoritative). */
  timedOut?: boolean;
  levelBreakdown?: LevelBreakdownEntry[];
  /** The option the user selected (wrong answer) */
  selectedOptionText?: string | null;
  /** Correct answer option text (e.g. "Bus B only") */
  correctOptionText?: string | null;
  /** Short explanation why the correct answer is correct */
  reasoning?: string | null;
  /** Total STX spent this run (paid runs only) */
  totalSpentStx?: number;
  /** Gross earned STX this run (paid runs only) */
  totalEarnedStx?: number;
  /** Net profit/loss (earned − spent) for paid runs */
  profitStx?: number;
}

/** Wrong / Timeout: full feedback — correct answer, reasoning, level breakdown, net profit/loss. */
export function FeedbackWrong({
  isPractice,
  timedOut = false,
  levelBreakdown = [],
  selectedOptionText,
  correctOptionText,
  reasoning,
  totalSpentStx = 0,
  totalEarnedStx = 0,
  profitStx = 0,
}: FeedbackWrongProps) {
  const showEconomics = !isPractice && (totalSpentStx > 0 || totalEarnedStx > 0 || profitStx !== 0);

  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-gray-900">
        {timedOut ? "Time ran out — game over" : `Wrong — run ended${isPractice ? " (practice)" : ""}`}
      </h2>

      {timedOut && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          You didn’t submit an answer in time. The run ends; you keep what you earned so far.
        </p>
      )}

      {/* Your answer (only when not timeout — we don’t show a fake selection) */}
      {!timedOut && (selectedOptionText != null && selectedOptionText !== "") && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-900 mb-1">
            Your answer
          </h3>
          <p className="text-gray-900 font-medium">{selectedOptionText}</p>
        </div>
      )}

      {/* Correct answer */}
      {(correctOptionText != null && correctOptionText !== "") && (
        <div className="rounded-xl border-2 border-amber-600 bg-amber-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-900 mb-1">
            Correct answer
          </h3>
          <p className="text-gray-900 font-medium">{correctOptionText}</p>
        </div>
      )}

      {/* Reasoning */}
      {(reasoning != null && reasoning !== "") && (
        <div className="rounded-xl border-2 border-gray-800 bg-gray-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 mb-2">
            Why
          </h3>
          <p className="text-sm text-gray-700 leading-snug">{reasoning}</p>
        </div>
      )}

      {/* Level breakdown (completed levels before this question) */}
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

      {/* Net profit / loss (paid runs) */}
      {showEconomics && (
        <div className="rounded-xl border-2 border-gray-800 bg-gray-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 mb-3">
            This run
          </h3>
          <div className="flex flex-col gap-3 text-sm">
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
                className={`font-mono font-tabular ${
                  profitStx > 0 ? "text-emerald-600" : profitStx < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {profitStx > 0 ? "+" : ""}{profitStx.toFixed(4)} STX
              </span>
            </div>
          </div>
        </div>
      )}

      {isPractice && (
        <p className="text-sm text-gray-500">Practice — no cost. Your credits were not changed.</p>
      )}
    </section>
  );
}
