"use client";

import Link from "next/link";

export default function FeedbackPage() {
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
      <p className="text-gray-600 text-sm">
        We’d love to hear from you. Share suggestions or report issues.
      </p>
      <a
        href="mailto:feedback@until.example.com"
        className="inline-block border-2 border-gray-800 bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Send email
      </a>
      <Link href="/" className="block text-sm text-gray-600 underline">
        Back to home
      </Link>
    </div>
  );
}
