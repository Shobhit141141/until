"use client";

import { Card } from "@/components/ui";

/** Wrong / Timeout: one line, red, run ends. No explanation first. */
export function FeedbackWrong({ isPractice }: { isPractice?: boolean }) {
  return (
    <Card variant="failure" className="bg-[var(--ui-failure)]/10">
      <p className="text-[var(--ui-neutral-text)] font-medium">
        Wrong. Run ended.{isPractice ? " (Practice — no cost.)" : ""}
      </p>
    </Card>
  );
}
