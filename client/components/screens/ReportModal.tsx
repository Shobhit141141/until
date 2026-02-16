"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

export interface ReportContext {
  runId?: string | null;
  questionText?: string;
  options?: string[];
  userAnswerText?: string;
  walletAddress?: string | null;
}

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  reportContext: ReportContext;
}

const inputClass =
  "w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export function ReportModal({ open, onClose, reportContext }: ReportModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const issueTrim = issue.trim();
    if (!issueTrim) {
      toast.error("Please describe the issue.");
      return;
    }
    setIsSubmitting(true);
    const res = await apiFetch<{ ok: boolean; message?: string }>("/feedback/report", {
      method: "POST",
      body: {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        issue: issueTrim,
        proposedSolution: proposedSolution.trim() || undefined,
        runId: reportContext.runId ?? undefined,
        questionText: reportContext.questionText,
        options: reportContext.options,
        userAnswerText: reportContext.userAnswerText,
        walletAddress: reportContext.walletAddress ?? undefined,
      },
    });
    setIsSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data?.message ?? "Report sent. Thank you.");
    setName("");
    setEmail("");
    setIssue("");
    setProposedSolution("");
    onClose();
  };

  if (!open) return null;

  return (
    <Modal title="Report this question" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Run ID, question, options, and your answer will be included so we can look into it.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="report-name" className={labelClass}>
            Your name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="report-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className={inputClass}
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="report-email" className={labelClass}>
            Email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="report-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            maxLength={254}
          />
        </div>
        <div>
          <label htmlFor="report-issue" className={labelClass}>
            Issue / description <span className="text-red-600">*</span>
          </label>
          <textarea
            id="report-issue"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="What went wrong? Incorrect answer, unclear question…"
            rows={3}
            className={`${inputClass} resize-y min-h-[80px]`}
            maxLength={5000}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{issue.length} / 5000</p>
        </div>
        <div>
          <label htmlFor="report-solution" className={labelClass}>
            Proposed solution <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="report-solution"
            value={proposedSolution}
            onChange={(e) => setProposedSolution(e.target.value)}
            placeholder="If you have an idea for a fix…"
            rows={2}
            className={`${inputClass} resize-y min-h-[60px]`}
            maxLength={2000}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
