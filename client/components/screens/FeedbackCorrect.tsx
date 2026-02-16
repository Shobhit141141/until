"use client";

import { useState } from "react";
import { HiFlag } from "react-icons/hi2";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { ReportModal, type ReportContext } from "./ReportModal";

export interface FeedbackCorrectReportProps {
  runId?: string | null;
  questionText?: string;
  options?: string[];
  userAnswerText?: string;
  walletAddress?: string | null;
}

/** Correct: one line, green, earned amount. Optional Report button (opens modal, sends via API). */
export function FeedbackCorrect({
  earnedStx,
  report,
}: {
  earnedStx?: number;
  report?: FeedbackCorrectReportProps;
}) {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const showReport = report && (report.runId != null || report.questionText);
  const reportContext: ReportContext = showReport
    ? {
        runId: report.runId ?? null,
        questionText: report.questionText ?? "",
        options: report.options ?? [],
        userAnswerText: report.userAnswerText ?? "",
        walletAddress: report.walletAddress ?? null,
      }
    : {};

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
        <p className="text-gray-900 font-medium">
          Correct.
          {earnedStx != null && (
            <> Earned <Money stx={earnedStx} />.</>
          )}
        </p>
      </div>
      {showReport && (
        <>
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-xl border-2 border-gray-400 text-gray-700 hover:bg-gray-50 text-sm py-2 inline-flex items-center justify-center gap-2"
            onClick={() => setReportModalOpen(true)}
          >
            <HiFlag className="w-4 h-4 shrink-0" aria-hidden />
            Report this question
          </Button>
          <ReportModal
            open={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            reportContext={reportContext}
          />
        </>
      )}
    </div>
  );
}
