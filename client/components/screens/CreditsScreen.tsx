"use client";

import { Button, Money } from "@/components/ui";
import type { CreditTransactionEntry } from "@/lib/api";

const MICRO_STX_PER_STX = 1_000_000;

interface CreditsScreenProps {
  balanceStx: number;
  minWithdrawStx: number;
  withdrawAmount: string;
  onWithdrawAmountChange: (v: string) => void;
  onWithdraw: () => void;
  isWithdrawing: boolean;
  transactions: CreditTransactionEntry[];
  onClose?: () => void;
  /** Set to true when used inside a modal (hides duplicate title/close). */
  hideHeader?: boolean;
  /** When provided, show an "Add credits" button that triggers top-up flow. */
  onAddCredits?: () => void;
}

/** Credits / Wallet: boring and trustworthy. Balance, withdraw, transaction list. */
export function CreditsScreen({
  balanceStx,
  minWithdrawStx,
  withdrawAmount,
  onWithdrawAmountChange,
  onWithdraw,
  isWithdrawing,
  transactions,
  onClose,
  hideHeader = false,
  onAddCredits,
}: CreditsScreenProps) {
  return (
    <section className="flex flex-col gap-6 max-w-md">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-black">Credits</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-black underline"
            >
              Close
            </button>
          )}
        </div>
      )}

      <div className="rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] border-[var(--ui-border)] p-4" style={{ borderStyle: "solid" }}>
        <p className="text-sm text-[var(--ui-neutral-muted)]">Balance</p>
        <p className="mt-0.5 font-mono font-tabular text-xl text-[var(--ui-neutral-text)]">
          <Money stx={balanceStx} />
        </p>
        {onAddCredits && (
          <Button
            variant="primary"
            className="mt-3 w-full py-2"
            onClick={onAddCredits}
          >
            Add credits
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--ui-neutral-muted)]">
          Withdraw (min {minWithdrawStx} STX)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={minWithdrawStx}
            step="0.01"
            placeholder="0.00"
            value={withdrawAmount}
            onChange={(e) => onWithdrawAmountChange(e.target.value)}
            className="flex-1 rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] border-[var(--ui-border)] bg-[var(--ui-neutral-bg)] px-3 py-2 font-mono font-tabular"
            style={{ borderStyle: "solid" }}
          />
          <Button
            onClick={onWithdraw}
            disabled={isWithdrawing || balanceStx < minWithdrawStx}
            variant="primary"
            className="px-4 py-2"
          >
            {isWithdrawing ? "…" : "Withdraw"}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--ui-neutral-muted)] mb-2">
          Transactions
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--ui-neutral-muted)]">No transactions yet.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {transactions.map((tx) => {
              const label =
                tx.type === "profit"
                  ? "Profit"
                  : tx.type === "loss"
                    ? "Loss"
                    : tx.type === "deduct"
                      ? "Debit"
                      : tx.type === "top_up"
                        ? "Top-up"
                        : tx.type === "withdraw"
                          ? "Withdraw"
                          : tx.type === "milestone_bonus"
                            ? "Bonus"
                            : tx.type === "refund"
                              ? "Refund"
                              : tx.type;
              const amountStx = tx.amountMicroStx / MICRO_STX_PER_STX;
              const isNegative = amountStx < 0;
              return (
                <li
                  key={tx.id}
                  className="flex justify-between text-sm py-1 border-b border-[var(--ui-border)]/50 last:border-0"
                >
                  <span className="text-[var(--ui-neutral-muted)]">{label}</span>
                  <span className={`font-mono font-tabular ${isNegative ? "text-red-600" : ""}`}>
                    {isNegative ? "" : "+"}
                    {amountStx.toFixed(4)} STX
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
