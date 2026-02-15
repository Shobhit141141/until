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
    <div className="rounded border border-zinc-300 dark:border-zinc-600 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
      <p className="font-medium text-foreground mb-2">
        {index + 1}. {q.question}
      </p>
      <ul className="flex flex-col gap-1.5 mb-3">
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
                className={`w-full text-left rounded px-3 py-2 border text-sm transition-colors ${
                  showCorrect
                    ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/20"
                    : showWrong
                      ? "border-red-400 dark:border-red-600 bg-red-500/10 dark:bg-red-500/20"
                      : isSelected && !revealed
                        ? "border-zinc-500 bg-zinc-200 dark:bg-zinc-700"
                        : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="font-mono text-zinc-500 mr-2">
                  {OPTION_LETTERS[i]}.
                </span>
                {opt}
                {showCorrect && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
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
          className="text-sm text-zinc-500 hover:text-foreground underline"
        >
          Reveal answer
        </button>
      ) : (
        <p className="text-sm text-amber-600 dark:text-amber-400">
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
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (notFound || !categoryName) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto">
        <Link href="/categories" className="text-sm text-zinc-500 hover:text-foreground underline">
          ← Categories
        </Link>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Category not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto pb-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/categories"
            className="text-sm text-zinc-500 hover:text-foreground underline"
          >
            ← Categories
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
        </div>

        {meta && (
          <section className="rounded border border-zinc-300 dark:border-zinc-600 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
              About this category
            </h2>
            <p className="text-foreground text-sm mb-3">{meta.description}</p>
            {meta.rules?.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-foreground mt-3 mb-1">
                  Rules
                </h3>
                <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-0.5">
                  {meta.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {meta.difficulty_scaling && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-3">
                <span className="font-medium text-foreground">Difficulty scaling: </span>
                {meta.difficulty_scaling}
              </p>
            )}
            {meta.example && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 italic">
                Example: {meta.example}
              </p>
            )}
          </section>
        )}

        <p className="text-sm text-zinc-500">
          Sample questions (static) — try them to get a feel for the category.
        </p>

        {loading && !samples ? (
          <p className="text-zinc-500">Loading sample questions…</p>
        ) : samples ? (
          <div className="flex flex-col gap-8">
            {samples.sets.map((set, setIdx) => (
              <section key={setIdx}>
                <h2 className="text-lg font-semibold text-foreground mb-3">
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
