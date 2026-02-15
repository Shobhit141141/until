"use client";

import { Button, Card, Money } from "@/components/ui";

interface RunSummaryScreenProps {
  correctCount: number;
  totalSpentStx: number;
  totalEarnedStx: number;
  profitStx: number;
  isPractice?: boolean;
  onPlayAgain: () => void;
  onViewCredits?: () => void;
}

/** Run summary: closure and clarity. Neutral, honest, no shame, no hype. */
export function RunSummaryScreen({
  correctCount,
  totalSpentStx,
  totalEarnedStx,
  profitStx,
  isPractice,
  onPlayAgain,
  onViewCredits,
}: RunSummaryScreenProps) {
  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-[var(--ui-neutral-text)]">
        Run finished{isPractice ? " (practice)" : ""}
      </h2>

      <Card>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--ui-neutral-muted)]">Correct</span>
            <span className="font-mono font-tabular">{correctCount}</span>
          </div>
          {!isPractice && (
            <>
              <div className="flex justify-between">
                <span className="text-[var(--ui-neutral-muted)]">Spent</span>
                <Money stx={totalSpentStx} />
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ui-neutral-muted)]">Earned</span>
                <Money stx={totalEarnedStx} />
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-[var(--ui-neutral-text)]">Net</span>
                <span
                  className={`font-mono font-tabular ${profitStx > 0 ? "text-[var(--ui-success)]" : profitStx < 0 ? "text-[var(--ui-failure)]" : ""}`}
                >
                  {profitStx > 0 ? "+" : ""}{profitStx.toFixed(4)} STX
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

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
