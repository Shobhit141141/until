"use client";

/** Timer: clear, not flashing. Time pressure visible but calm. */
export function Timer({
  elapsedSec,
  allowedSec,
}: {
  elapsedSec: number;
  allowedSec: number;
}) {
  const remaining = Math.max(0, allowedSec - elapsedSec);
  const isLow = remaining <= 10 && remaining > 0;
  const isTimeout = remaining <= 0;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const display = `${mm}:${String(ss).padStart(2, "0")}`;
  return (
    <div
      className={`font-mono font-tabular text-lg ${isTimeout ? "text-[var(--ui-failure)]" : isLow ? "text-[var(--ui-failure)]" : "text-[var(--ui-neutral-text)]"}`}
      aria-live="polite"
    >
      {display}
    </div>
  );
}
