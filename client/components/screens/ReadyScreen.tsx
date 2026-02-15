"use client";

import Link from "next/link";
import { Button, Money } from "@/components/ui";

interface ReadyScreenProps {
  creditsStx: number;
  onStartRun: () => void;
  isStarting: boolean;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (slug: string | null) => void;
  onPractice?: () => void;
  isPracticeLoading?: boolean;
}

/** Home / Ready: one primary decision — Start Run. Calm and intentional. */
export function ReadyScreen({
  creditsStx,
  onStartRun,
  isStarting,
  categories,
  selectedCategory,
  onCategoryChange,
  onPractice,
  isPracticeLoading,
}: ReadyScreenProps) {
  return (
    <section className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ui-neutral-text)]">UNTIL</h1>
        <p className="mt-1 text-[var(--ui-neutral-muted)] text-sm">
          Pay per question. Stop when it&apos;s optimal.
        </p>
      </div>

      <div className="rounded-[0px] border-2 border-black p-4">
        <p className="text-sm text-black">Credits</p>
        <p className="mt-0.5 font-mono font-tabular text-lg text-[var(--ui-neutral-text)]">
          <Money stx={creditsStx} />
        </p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-black">Category</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory ?? ""}
              onChange={(e) => onCategoryChange(e.target.value || null)}
              className="border-2 border-black bg-white px-3 py-2 text-sm flex-1"
            >
              <option value="">Random</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Link href="/categories" className="text-sm text-black underline">
              Browse
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          onClick={onStartRun}
          disabled={isStarting}
          variant="primary"
          className="w-full py-3 text-black"
        >
          {isStarting ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading…
            </span>
          ) : (
            "Start run"
          )}
        </Button>
        {onPractice && (
          <Button
            onClick={onPractice}
            disabled={isPracticeLoading}
            variant="secondary"
            className="w-full py-2 text-sm"
          >
            {isPracticeLoading ? "…" : "Practice (no cost)"}
          </Button>
        )}
      </div>
    </section>
  );
}
