"use client";

import { Money } from "@/components/ui";

/** Correct: one line, green, earned amount. */
export function FeedbackCorrect({ earnedStx }: { earnedStx?: number }) {
  return (
    <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
      <p className="text-gray-900 font-medium">
        Correct.
        {earnedStx != null && (
          <> Earned <Money stx={earnedStx} />.</>
        )}
      </p>
    </div>
  );
}
