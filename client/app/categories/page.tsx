"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch, type CategoriesResponse, type CategoryMetadata } from "@/lib/api";
import { GoHomeLink } from "@/components/ui";

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
        <p className="text-gray-500">Loading categories…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <GoHomeLink />
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        </div>
        <p className="text-gray-600 text-sm">
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
                  className="block rounded-xl border-2 border-gray-800 px-4 py-3 bg-white text-gray-900 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] hover:bg-amber-50 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all"
                >
                  <span className="font-medium">{name}</span>
                  {meta?.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
