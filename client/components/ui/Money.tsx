"use client";

/** Money is always visible — monospaced, clear. */
export function Money({ stx, label }: { stx: number; label?: string }) {
  return (
    <span className="font-mono font-tabular text-[var(--ui-neutral-text)]">
      {stx.toFixed(4)} STX
      {label != null && <span className="text-[var(--ui-neutral-muted)] font-sans font-normal"> {label}</span>}
    </span>
  );
}
