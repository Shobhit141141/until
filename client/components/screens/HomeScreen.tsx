"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Money } from "@/components/ui";
import { FaQuestion } from "react-icons/fa";

const STAT_COLORS = [
  { bg: "bg-amber-400", border: "border-amber-600", text: "text-amber-900", label: "Spent" },
  { bg: "bg-emerald-400", border: "border-emerald-600", text: "text-emerald-900", label: "Earned" },
  { bg: "bg-sky-400", border: "border-sky-600", text: "text-sky-900", label: "Best score" },
  { bg: "bg-violet-400", border: "border-violet-600", text: "text-violet-900", label: "Credits" },
];

/** Categories from server (server/src/config/categories.ts). Same order as QUESTION_CATEGORIES. */
const DEFAULT_CATEGORIES = [
  "Situational Reasoning",
  "Attention Traps",
  "Mental Shortcuts",
  "Constraint Puzzles",
  "Elimination Logic",
  "Estimation Battles",
  "Ratios in Disguise",
  "Everyday Science",
  "One-Move Puzzles",
  "Patterns and Sequences",
] as const;

/** One color per category (10 distinct). Same category name => same color. */
const CATEGORY_COLOR_SET = [
  { bg: "bg-red-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-sky-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-amber-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-violet-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-green-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-rose-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-orange-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-pink-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-gray-400", border: "border-black", color: "text-gray-900" },
  { bg: "bg-cyan-300", border: "border-black", color: "text-gray-900" },
  // { bg: "bg-black", border: "border-black", color: "text-gray-900" },
  { bg: "bg-white", border: "border-black", color: "text-gray-900" },
] as const;
const NUM_COLORS = CATEGORY_COLOR_SET.length;

/** Per-category images in public/category/; fallback for unknown. */
const CATEGORY_IMAGES: Record<string, string> = {
  "Situational Reasoning": "/category/brain organ-pana (1).svg",
  "Attention Traps": "/category/attention.svg",
  "Mental Shortcuts": "/category/mental.svg",
  "Constraint Puzzles": "/category/constraint.svg",
  "Elimination Logic": "/category/elimination.svg",
  "Estimation Battles": "/category/estimation.svg",
  "Ratios in Disguise": "/category/ratios.svg",
  "Everyday Science": "/category/everyday.svg",
  "One-Move Puzzles": "/category/puzzles.svg",
  "Patterns and Sequences": "/category/patterns.svg",
};
const DEFAULT_CATEGORY_IMAGE = "/category/brain organ-pana (1).svg";

function getCategoryImage(cat: string): string {
  return CATEGORY_IMAGES[cat] ?? DEFAULT_CATEGORY_IMAGE;
}

/** Stable style per category name so each category has a unique color. */
function getCategoryStyle(cat: string) {
  const index = DEFAULT_CATEGORIES.indexOf(cat as (typeof DEFAULT_CATEGORIES)[number]);
  return CATEGORY_COLOR_SET[index >= 0 ? index % NUM_COLORS : 0];
}

/** One-line hook per category: short, slightly threatening. */
function getCategoryHook(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("attention") || c.includes("trap")) return "Miss one word. Lose the run.";
  if (c.includes("mental") || c.includes("shortcut")) return "Looks easy. Isn't.";
  if (c.includes("reasoning") || c.includes("logical") || c.includes("situational")) return "One wrong move. Run over.";
  if (c.includes("constraint") || c.includes("puzzle")) return "One rule broken. Run over.";
  if (c.includes("elimination")) return "Wrong guess. You're out.";
  if (c.includes("estimation")) return "Off by a mile. Run over.";
  if (c.includes("ratio")) return "Wrong proportion. Run over.";
  if (c.includes("everyday") || c.includes("science")) return "One slip. Run over.";
  if (c.includes("one-move") || c.includes("puzzle")) return "Wrong move. Run over.";
  if (c.includes("patterns")) return "";
  return "One slip. Run over.";
}

interface HomeScreenProps {
  creditsStx: number;
  totalSpent: number;
  totalEarned: number;
  bestScore: number;
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

export function HomeScreen({
  creditsStx,
  totalSpent,
  totalEarned,
  bestScore,
  categories,
  selectedCategory,
  onCategorySelect,
}: HomeScreenProps) {
  const statValues: ReactNode[] = [
    <Money key="spent" stx={totalSpent} />,
    <Money key="earned" stx={totalEarned} />,
    bestScore.toFixed(3),
    <Money key="credits" stx={creditsStx} />,
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Stats row — fixed at top */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {STAT_COLORS.map((s, i) => (
          <div
            key={s.label}
            className={`rounded-xl border-2 ${s.border} ${s.bg} ${s.text} p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] transition-all hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] hover:-translate-y-0.5`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{s.label}</p>
            <p className="mt-1 font-mono font-tabular text-lg font-bold">
              {statValues[i]}
            </p>
          </div>
        ))}
      </div>

      {/* Content: on mobile categories flow full height (page scrolls); on desktop categories scroll in viewport */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-h-0">

        {/* Categories — on mobile no height limit; on md+ card grid scrolls inside column */}
        <div className="md:col-span-2 flex flex-col min-w-0 md:min-h-0">
          <h2 className="shrink-0 text-lg pb-2 font-bold uppercase tracking-wider text-gray-900">Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 pt-2 md:overflow-y-auto md:min-h-0">
          {(categories.length ? categories : [...DEFAULT_CATEGORIES]).map(
            (cat) => {
              const style = getCategoryStyle(cat);
              const isSelected = selectedCategory === cat;
              const title = cat.toUpperCase();
              const hook = getCategoryHook(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategorySelect(isSelected ? null : cat)}
                  className={`${style.bg} border-2 ${style.border} min-h-[160px] flex flex-col p-3 text-left relative overflow-hidden rounded-xl shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] transition-all duration-200 ${
                    isSelected ? "shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] -translate-y-0.5" : "hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] hover:-translate-y-0.5"
                  }`}
                >
                  {/* Top: ? icon (right) only */}
                  <div className="relative z-10 flex justify-end shrink-0">
                    <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-black text-white pointer-events-auto" title="Category info">
                      <Link href={`/categories/${encodeURIComponent(cat)}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
                        <FaQuestion className="w-4 h-4" aria-hidden />
                      </Link>
                    </span>
                  </div>
                  {/* Body: left = title + hook, right = category image */}
                  <div className="flex-1 flex items-center gap-3 min-h-0 pt-1">
                    <div className="flex-1 flex flex-col justify-evenly min-w-0 gap-2">
                      <p className={`font-semibold text-2xl sm:text-3xl uppercase tracking-wide leading-tight break-words ${style.color}`}>{title}</p>
                      <p className={`text-sm font-medium leading-snug ${style.color}`}>{hook}</p>
                    </div>
                    <div className="flex items-center justify-center w-[55%] max-w-[145px] h-[105px] shrink-0 pointer-events-none relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getCategoryImage(cat)}
                        alt=""
                        className="object-contain w-full h-full max-w-[125px] max-h-[105px] opacity-100 scale-110"
                      />
                    </div>
                  </div>
                </button>
              );
            }
          )}
          </div>
        </div>

        {/* Right column: illustration + Whitepaper — top padding aligns illustration with category cards, not header */}
        <div className="flex flex-col gap-3 min-h-0 pt-10 md:pt-10">
          {/* Game concept illustration */}
          <div className="rounded-xl border-2 border-gray-800 bg-white overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] flex-1 min-h-0 flex flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ILLUSTRATION.png"
              alt="Answer questions, earn profit, decide when to quit. Pay per question and exit when it's no longer worth it."
              className="w-full h-auto object-contain object-top"
            />
          </div>

          {/* Whitepaper — small section */}
          <div className="shrink-0 rounded-xl border-2 border-gray-800 bg-[#fcf4ef] p-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] transition-all hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.14)] hover:-translate-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-2">Whitepaper</h2>
            <p className="text-xs text-gray-600 leading-snug">
              Tokenomics, rules, and design. Pay-per-question, credits, optimal stopping.
            </p>
            <Link
              href="/whitepaper"
              className="mt-2 inline-block text-xs font-medium text-gray-900 underline hover:text-amber-600"
            >
              Read whitepaper →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
