"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { GoHomeLink } from "@/components/ui/GoHomeLink";
import toast from "react-hot-toast";

export default function FeedbackPage() {
  const [fromIdentifier, setFromIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ident = fromIdentifier.trim();
    const q = query.trim();
    if (!ident || !q) {
      const msg = "Please enter your wallet address or username and your feedback.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const res = await apiFetch<{ ok: boolean; message?: string }>("/feedback", {
      method: "POST",
      body: {
        fromIdentifier: ident,
        email: email.trim() || undefined,
        query: q,
        ...(proposedSolution.trim() && { proposedSolution: proposedSolution.trim() }),
      },
    });
    setIsSubmitting(false);
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-8 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you</h2>
          <p className="text-gray-700">
            Your feedback has been received. We’ll use it to improve UNTIL.
          </p>
        </div>
        <div className="flex justify-center">
          <GoHomeLink variant="primary" className="w-full py-3 justify-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="text-gray-600 text-sm mt-1">
          Share suggestions or report issues. We read every message.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="fromIdentifier" className="block text-sm font-medium text-gray-700 mb-1">
            Wallet address or username
          </label>
          <input
            id="fromIdentifier"
            type="text"
            value={fromIdentifier}
            onChange={(e) => setFromIdentifier(e.target.value)}
            placeholder="e.g. SP1… or your username"
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-0"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-0"
            maxLength={254}
          />
        </div>

        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
            Your feedback / query
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What’s on your mind? Bug, idea, question…"
            rows={4}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-0 resize-y min-h-[100px]"
            maxLength={5000}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{query.length} / 5000</p>
        </div>

        <div>
          <label htmlFor="proposedSolution" className="block text-sm font-medium text-gray-700 mb-1">
            Proposed solution <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="proposedSolution"
            value={proposedSolution}
            onChange={(e) => setProposedSolution(e.target.value)}
            placeholder="If you have an idea for a fix or improvement…"
            rows={3}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-0 resize-y min-h-[80px]"
            maxLength={2000}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full py-3"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending…
            </span>
          ) : (
            "Send feedback"
          )}
        </Button>
      </form>

      <GoHomeLink />
    </div>
  );
}
