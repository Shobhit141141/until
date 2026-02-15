"use client";

import { Card, Money } from "@/components/ui";

/** Correct: one line, green, earned amount, no celebration. */
export function FeedbackCorrect({ earnedStx }: { earnedStx?: number }) {
  return (
    <Card variant="success" className="bg-[var(--ui-success)]/10">
      <p className="text-[var(--ui-neutral-text)] font-medium">
        Correct.
        {earnedStx != null && (
          <> Earned <Money stx={earnedStx} />.</>
        )}
      </p>
    </Card>
  );
}
