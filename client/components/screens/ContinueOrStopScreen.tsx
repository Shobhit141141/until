"use client";

import { Button, Card, Money } from "@/components/ui";

const COST_STX_BY_LEVEL = [0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32];
const MIN_LEVEL_BEFORE_STOP = 4;

function costForLevel(level: number) {
  return COST_STX_BY_LEVEL[Math.max(0, Math.min(level, 9))] ?? 0.72;
}
function bestCaseRewardStx(level: number) {
  return costForLevel(level) * 1.5;
}

interface ContinueOrStopScreenProps {
  earnedSoFarStx: number;
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
  nextLevel,
  completedLevels,
  isPractice,
  onContinue,
  onStop,
  isContinueLoading,
  isStopping,
}: ContinueOrStopScreenProps) {
  const costNext = costForLevel(nextLevel);
  const bestCaseNext = bestCaseRewardStx(nextLevel);
  const canStop = isPractice || completedLevels >= MIN_LEVEL_BEFORE_STOP;

  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-[var(--ui-neutral-text)]">
        Continue or stop?
      </h2>

      <Card>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--ui-neutral-muted)]">Earned so far</span>
            <Money stx={earnedSoFarStx} />
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ui-neutral-muted)]">Cost of next question</span>
            <Money stx={costNext} />
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ui-neutral-muted)]">Best-case next reward</span>
            <Money stx={bestCaseNext} />
          </div>
        </div>
      </Card>

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
          <p className="text-xs text-[var(--ui-neutral-muted)]">
            Stop unlocks after level {MIN_LEVEL_BEFORE_STOP}.
          </p>
        )}
      </div>
    </section>
  );
}
