"use client";

/** Timer: progress bar + countdown. Time pressure visible. */
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
  const progressPct = allowedSec > 0 ? Math.max(0, (remaining / allowedSec) * 100) : 0;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const display = `${mm}:${String(ss).padStart(2, "0")}`;
  return (
    <div className="w-full" aria-live="polite">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`font-mono font-tabular text-lg font-bold ${
            isTimeout ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"
          }`}
        >
          {display}
        </span>
        <span className="text-xs text-gray-500">remaining</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 border border-gray-300 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isTimeout ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${progressPct}%` }}
          role="progressbar"
          aria-valuenow={remaining}
          aria-valuemin={0}
          aria-valuemax={allowedSec}
        />
      </div>
    </div>
  );
}
