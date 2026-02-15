"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch, type CategoriesResponse, type CategoryMetadata } from "@/lib/api";

function categoryToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, CategoryMetadata>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CategoriesResponse>("/categories")
      .then((res) => {
        if (res.data?.categories) setCategories(res.data.categories);
        if (res.data?.metadata) setMetadata(res.data.metadata);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-zinc-500">Loading categories…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-foreground underline"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          Get to know each category with sample questions before you play.
        </p>
        <ul className="flex flex-col gap-3">
          {categories.map((name) => {
            const meta = metadata[name];
            const slug = categoryToSlug(name);
            return (
              <li key={name}>
                <Link
                  href={`/categories/${slug}`}
                  className="block rounded border border-zinc-300 dark:border-zinc-600 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="font-medium text-foreground">{name}</span>
                  {meta?.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {meta.description}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
