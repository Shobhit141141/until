"use client";

import { Button } from "@/components/ui";

interface TopUpScreenProps {
  suggestedStx: number;
  recipient: string;
  currentCreditsStx?: number;
  predefinedAmounts: number[];
  customAmount: string;
  onCustomAmountChange: (v: string) => void;
  onTopUp: (amountStx: number) => void;
  onCancel: () => void;
  isToppingUp: boolean;
  minTopUpStx: number;
}

/** One decision: top up to continue or cancel. */
export function TopUpScreen({
  suggestedStx,
  currentCreditsStx,
  predefinedAmounts,
  customAmount,
  onCustomAmountChange,
  onTopUp,
  onCancel,
  isToppingUp,
  minTopUpStx,
}: TopUpScreenProps) {
  const custom = parseFloat(customAmount);
  const customValid = Number.isFinite(custom) && custom >= minTopUpStx;

  return (
    <section className="flex flex-col gap-6 max-w-md">
      <h2 className="text-lg font-bold text-[var(--ui-neutral-text)]">
        Insufficient credits
      </h2>
      {currentCreditsStx != null && (
        <p className="text-sm text-[var(--ui-neutral-muted)]">
          You have {currentCreditsStx.toFixed(4)} STX. Top up to continue.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {predefinedAmounts.map((amt) => (
          <Button
            key={amt}
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => onTopUp(amt)}
            disabled={isToppingUp}
          >
            {amt} STX
          </Button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={minTopUpStx}
          step="0.01"
          placeholder="Custom STX"
          value={customAmount}
          onChange={(e) => onCustomAmountChange(e.target.value)}
          className="flex-1 rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] border-[var(--ui-border)] bg-[var(--ui-neutral-bg)] px-3 py-2 font-mono text-sm"
          style={{ borderStyle: "solid" }}
        />
        <Button
          variant="primary"
          className="px-3 py-2 text-sm"
          onClick={() => customValid && onTopUp(custom)}
          disabled={isToppingUp || !customValid}
        >
          {isToppingUp ? "…" : "Send"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 py-2"
          onClick={() => onTopUp(suggestedStx)}
          disabled={isToppingUp}
        >
          {isToppingUp ? "Confirm in wallet…" : `Send ${suggestedStx} STX`}
        </Button>
        <Button variant="secondary" className="py-2" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
