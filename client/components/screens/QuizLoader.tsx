"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const LOADER_MESSAGES = [
  "Preparing questions…",
  "Processing transaction…",
  "Loading your run…",
  "Almost ready…",
];

export function QuizLoader({ messageIndex: controlledIndex }: { messageIndex?: number }) {
  const [index, setIndex] = useState(0);
  const messageIndex = controlledIndex ?? index;
  useEffect(() => {
    if (controlledIndex != null) return;
    const id = setInterval(() => setIndex((i) => i + 1), 2000);
    return () => clearInterval(id);
  }, [controlledIndex]);
  const message = LOADER_MESSAGES[messageIndex % LOADER_MESSAGES.length];
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10 bg-white/95 backdrop-blur-sm">
      <div className="animate-spin">
        <Image src="/logo.png" alt="" width={64} height={64} className="shrink-0" />
      </div>
      <p className="text-lg font-semibold text-gray-900 transition-opacity duration-300">
        {message}
      </p>
    </div>
  );
}
