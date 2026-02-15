"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  apiFetch,
  type CategoriesResponse,
  type CategoryMetadata,
  type CategorySamplesResponse,
  type SampleQuestion,
} from "@/lib/api";
import { GoHomeLink } from "@/components/ui";

const OPTION_LETTERS = ["A", "B", "C", "D"];

function categoryToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function slugToCategory(slug: string, categories: string[]): string | null {
  const lower = slug.toLowerCase();
  return categories.find((c) => categoryToSlug(c) === lower) ?? null;
}

function SampleQuestionCard({
  q,
  index,
  onReveal,
  revealed,
}: {
  q: SampleQuestion;
  index: number;
  onReveal: () => void;
  revealed: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-xl border-2 border-gray-800 bg-white p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
      <p className="font-medium text-gray-900 mb-3">
        {index + 1}. {q.question}
      </p>
      <ul className="flex flex-col gap-2 mb-4">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = selected === i;
          const showCorrect = revealed && isCorrect;
          const showWrong = revealed && isSelected && !isCorrect;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => !revealed && setSelected(i)}
                className={`w-full text-left rounded-xl border-2 px-4 py-2.5 text-sm transition-all ${
                  showCorrect
                    ? "border-amber-600 bg-amber-50 text-amber-900"
                    : showWrong
                      ? "border-red-500 bg-red-50 text-red-900"
                      : isSelected && !revealed
                        ? "border-gray-800 bg-amber-50 text-gray-900 shadow-[2px_2px_0_0_rgba(0,0,0,0.08)]"
                        : "border-gray-300 bg-white text-gray-900 hover:border-gray-500 hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.06)]"
                }`}
              >
                <span className="font-mono text-gray-500 mr-2">
                  {OPTION_LETTERS[i]}.
                </span>
                {opt}
                {showCorrect && (
                  <span className="ml-2 text-amber-700 font-medium">
                    ✓ Correct
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!revealed ? (
        <button
          type="button"
          onClick={onReveal}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium underline underline-offset-2"
        >
          Reveal answer
        </button>
      ) : (
        <p className="text-sm text-amber-800 font-medium">
          Correct: {OPTION_LETTERS[q.correctIndex]}
        </p>
      )}
    </div>
  );
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [categories, setCategories] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, CategoryMetadata>>({});
  const [samples, setSamples] = useState<CategorySamplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const categoryName = slugToCategory(slug, categories);
  const meta = categoryName ? metadata[categoryName] : null;

  useEffect(() => {
    apiFetch<CategoriesResponse>("/categories")
      .then((res) => {
        if (res.data?.categories) setCategories(res.data.categories);
        if (res.data?.metadata) setMetadata(res.data.metadata);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!categoryName) {
      if (categories.length > 0) setNotFound(true);
      setLoading(categories.length === 0);
      return;
    }
    setLoading(true);
    setNotFound(false);
    apiFetch<CategorySamplesResponse>(
      `/categories/${encodeURIComponent(categoryName)}/samples`
    )
      .then((res) => {
        if (res.data) setSamples(res.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [categoryName, categories.length]);

  if (loading && !categoryName) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (notFound || !categoryName) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto">
        <GoHomeLink />
        <p className="mt-4 text-gray-600">Category not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto pb-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <GoHomeLink />
          <h1 className="text-2xl font-bold text-gray-900">{categoryName}</h1>
        </div>

        {meta && (
          <section className="rounded-xl border-2 border-gray-800 bg-amber-50/80 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              About this category
            </h2>
            <p className="text-gray-900 text-sm mb-3">{meta.description}</p>
            {meta.rules?.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-gray-900 mt-3 mb-1">
                  Rules
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                  {meta.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {meta.difficulty_scaling && (
              <p className="text-sm text-gray-600 mt-3">
                <span className="font-medium text-gray-900">Difficulty scaling: </span>
                {meta.difficulty_scaling}
              </p>
            )}
            {meta.example && (
              <p className="text-sm text-gray-600 mt-2 italic">
                Example: {meta.example}
              </p>
            )}
          </section>
        )}

        <p className="text-sm text-gray-600">
          Example questions from this category — try them to get a feel before you play.
        </p>

        {loading && !samples ? (
          <p className="text-gray-500">Loading sample questions…</p>
        ) : samples ? (
          <div className="flex flex-col gap-8">
            {samples.sets.map((set, setIdx) => (
              <section key={setIdx}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  {set.title}
                </h2>
                <div className="flex flex-col gap-4">
                  {set.questions.map((q, qIdx) => (
                    <SampleQuestionCard
                      key={qIdx}
                      q={q}
                      index={qIdx}
                      revealed={revealed[`${setIdx}-${qIdx}`] ?? false}
                      onReveal={() =>
                        setRevealed((prev) => ({
                          ...prev,
                          [`${setIdx}-${qIdx}`]: true,
                        }))
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
