"use client";

import { Button, Card, Money, Timer } from "@/components/ui";
import type { QuestionResponse } from "@/lib/api";

const COST_STX_BY_LEVEL = [0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32];
const MIN_LEVEL_BEFORE_STOP = 4;

function costForLevel(level: number) {
  return COST_STX_BY_LEVEL[Math.max(0, Math.min(level, 9))] ?? 0.72;
}

/** Best-case reward = base (same as cost) × 1.5 time multiplier */
function bestCaseRewardStx(level: number) {
  return costForLevel(level) * 1.5;
}

interface QuestionScreenProps {
  question: QuestionResponse;
  level: number;
  elapsedSec: number;
  selectedIndex: number | null;
  completedLevelsInRun: number;
  isSubmitting: boolean;
  isStopping: boolean;
  onSelectOption: (index: number) => void;
  onSubmit: () => void;
  onStop: () => void;
}

/** Question screen: one primary decision — answer. Level small, timer calm, economic footer visible. */
export function QuestionScreen({
  question,
  level,
  elapsedSec,
  selectedIndex,
  completedLevelsInRun,
  isSubmitting,
  isStopping,
  onSelectOption,
  onSubmit,
  onStop,
}: QuestionScreenProps) {
  const allowedSec = question.estimated_solve_time_sec ?? 30;
  const costStx = costForLevel(level);
  const bestCaseStx = bestCaseRewardStx(level);
  const canStop = completedLevelsInRun >= MIN_LEVEL_BEFORE_STOP && !question.practice;

  return (
    <section className="flex flex-col gap-6 max-w-xl mx-auto">
      {/* 1. Level (small) */}
      <p className="text-sm text-[var(--ui-neutral-muted)] font-medium">
        Level {level + 1}
      </p>

      {/* 2. Timer (clear, not flashing) */}
      <div className="flex items-center justify-between">
        <Timer elapsedSec={elapsedSec} allowedSec={allowedSec} />
        {question.estimated_solve_time_sec != null && (
          <span className="text-sm text-[var(--ui-neutral-muted)]">
            Par {question.estimated_solve_time_sec}s
          </span>
        )}
      </div>

      {/* 3. Question (large, centered) */}
      <p className="text-xl font-bold text-[var(--ui-neutral-text)] text-center leading-snug">
        {question.question}
      </p>

      {/* 4. Options (big, evenly spaced) — lock on tap, no second guessing */}
      <ul className="flex flex-col gap-3">
        {question.options.map((opt, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelectOption(i)}
              disabled={isSubmitting}
              className={`w-full text-left rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] px-4 py-3 text-base transition-colors disabled:opacity-70 ${
                selectedIndex === i
                  ? "border-[var(--ui-accent)] bg-[var(--ui-accent)]/10 text-[var(--ui-neutral-text)]"
                  : "border-[var(--ui-border)] bg-[var(--ui-neutral-bg)] text-[var(--ui-neutral-text)] hover:border-[var(--ui-accent)]/50"
              }`}
              style={{ borderStyle: "solid" }}
            >
              {opt}
            </button>
          </li>
        ))}
      </ul>

      {/* 5. Economic footer: cost + best-case reward */}
      <Card className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <span className="text-[var(--ui-neutral-muted)]">This question: </span>
            <Money stx={costStx} />
          </div>
          <div>
            <span className="text-[var(--ui-neutral-muted)]">Best-case: </span>
            <Money stx={bestCaseStx} />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onSubmit}
          disabled={selectedIndex === null || isSubmitting}
          variant="primary"
          className="w-full py-3"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Checking…
            </span>
          ) : (
            "Submit"
          )}
        </Button>
        <Button
          onClick={onStop}
          disabled={isStopping || (!question.practice && !canStop)}
          variant="secondary"
          className="w-full py-2"
          title={
            !question.practice && !canStop
              ? `Complete level ${MIN_LEVEL_BEFORE_STOP} before you can stop`
              : undefined
          }
        >
          {isStopping
            ? "Finishing…"
            : !question.practice && !canStop
              ? `Stop (unlocks at level ${MIN_LEVEL_BEFORE_STOP})`
              : "Stop & lock result"}
        </Button>
      </div>
    </section>
  );
}
