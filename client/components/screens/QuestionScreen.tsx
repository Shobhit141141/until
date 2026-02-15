"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Timer } from "@/components/ui/Timer";
import type { QuestionResponse } from "@/lib/api";
import { getCostStx, QUESTION_TIME_CAP_SEC } from "@/lib/tokenomics";

const MIN_LEVEL_BEFORE_STOP = 4;
const OPTION_LABELS = ["A", "B", "C", "D"];

function bestCaseRewardStx(level: number) {
  return getCostStx(level) * 1.5;
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
  /** Called with the selected index at submit click time (avoids stale closure). */
  onSubmit: (selectedIndex: number) => void;
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
  /** Synced on every option click so we pass the actual selection at Submit click time. */
  const selectedIndexRef = useRef<number | null>(null);

  /** All questions capped at 30s. Never use question.estimated_solve_time_sec. */
  const allowedSec = QUESTION_TIME_CAP_SEC;
  const costStx = getCostStx(level);
  const bestCaseStx = bestCaseRewardStx(level);
  const canStop = completedLevelsInRun >= MIN_LEVEL_BEFORE_STOP && !question.practice;

  const handleOptionClick = (i: number) => {
    selectedIndexRef.current = i;
    onSelectOption(i);
  };

  const handleSubmit = () => {
    const index = selectedIndexRef.current ?? selectedIndex;
    if (index !== null) onSubmit(index);
  };

  return (
    <section className="flex flex-col gap-6 max-w-xl mx-auto">
      {/* 1. Level + time limit */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">
          Level {level + 1}
        </p>
        <span className="text-sm text-gray-500">
          Answer in 30s
        </span>
      </div>

      {/* 2. Timer with progress bar (30s cap) */}
      <Timer elapsedSec={elapsedSec} allowedSec={allowedSec} />

      {/* 3. Question */}
      <p className="text-xl font-bold text-gray-900 text-center leading-snug">
        {question.question}
      </p>

      {/* Dev only: API sends correctIndex only in NODE_ENV=development */}
      {typeof question.correctIndex === "number" &&
        question.correctIndex >= 0 &&
        question.correctIndex < (question.options?.length ?? 0) && (
          <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 font-mono" aria-hidden>
            Dev: correct = {OPTION_LABELS[question.correctIndex]} — {question.options[question.correctIndex]}
          </p>
        )}

      {/* 4. Options — A/B/C/D labels, selection effect */}
      <ul className="flex flex-col gap-3">
        {question.options.map((opt, i) => {
          const isSelected = selectedIndex === i;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleOptionClick(i)}
                disabled={isSubmitting}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-base transition-all duration-200 disabled:opacity-70 flex items-center gap-3 ${
                  isSelected
                    ? "border-gray-800 bg-amber-50 text-gray-900 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] ring-2 ring-amber-400 ring-offset-2 scale-[1.02]"
                    : "border-gray-300 bg-white text-gray-900 hover:border-gray-500 hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.08)]"
                }`}
              >
                <span
                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${
                    isSelected ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {OPTION_LABELS[i] ?? String(i + 1)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 5. Economic footer */}
      <div className="rounded-xl border-2 border-gray-800 bg-gray-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <span className="text-gray-600">This question: </span>
            <Money stx={costStx} />
          </div>
          <div>
            <span className="text-gray-600">Best-case: </span>
            <Money stx={bestCaseStx} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSubmit}
          disabled={selectedIndex === null || isSubmitting || elapsedSec >= allowedSec}
          variant="primary"
          className="w-full py-3"
        >
          {elapsedSec >= allowedSec ? (
            "Time's up — ending…"
          ) : isSubmitting ? (
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
