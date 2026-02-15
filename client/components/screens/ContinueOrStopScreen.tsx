"use client";

import { Button, Money } from "@/components/ui";
import { getCostStx } from "@/lib/tokenomics";

const MIN_LEVEL_BEFORE_STOP = 4;

function bestCaseRewardStx(level: number) {
  return getCostStx(level) * 1.5;
}

interface ContinueOrStopScreenProps {
  earnedSoFarStx: number;
  /** Total profit/loss so far this run (earned − spent). Only for paid runs. */
  profitLossSoFarStx?: number;
  nextLevel: number;
  completedLevels: number;
  isPractice: boolean;
  onContinue: () => void;
  onStop: () => void;
  isContinueLoading: boolean;
  isStopping: boolean;
}

/** Continue vs Stop: make the economic decision obvious. No nudging. */
export function ContinueOrStopScreen({
  earnedSoFarStx,
  profitLossSoFarStx,
  nextLevel,
  completedLevels,
  isPractice,
  onContinue,
  onStop,
  isContinueLoading,
  isStopping,
}: ContinueOrStopScreenProps) {
  const costNext = getCostStx(nextLevel);
  const bestCaseNext = bestCaseRewardStx(nextLevel);
  const canStop = isPractice || completedLevels >= MIN_LEVEL_BEFORE_STOP;

  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-gray-900">
        Continue or stop?
      </h2>

      <div className="rounded-xl border-2 border-gray-800 bg-gray-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-3 text-sm">
          {!isPractice && typeof profitLossSoFarStx === "number" && (
            <div className="flex justify-between font-medium">
              <span className="text-gray-700">Total P&L so far</span>
              <span
                className={`font-mono font-tabular ${
                  profitLossSoFarStx > 0 ? "text-emerald-600" : profitLossSoFarStx < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {profitLossSoFarStx > 0 ? "+" : ""}{profitLossSoFarStx.toFixed(4)} STX
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Earned so far</span>
            <Money stx={earnedSoFarStx} />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cost of next question</span>
            <Money stx={costNext} />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Best-case next reward</span>
            <Money stx={bestCaseNext} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onContinue}
          disabled={isContinueLoading}
          variant="primary"
          className="w-full py-3"
        >
          {isContinueLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading…
            </span>
          ) : (
            "Continue"
          )}
        </Button>
        <Button
          onClick={onStop}
          disabled={isStopping || !canStop}
          variant="secondary"
          className="w-full py-2"
        >
          {isStopping ? "Finishing…" : "Stop & lock result"}
        </Button>
        {!canStop && (
          <p className="text-xs text-gray-500">
            Stop unlocks after level {MIN_LEVEL_BEFORE_STOP}.
          </p>
        )}
      </div>
    </section>
  );
}
