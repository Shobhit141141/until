"use client";

import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Thick border, no shadow */
  variant?: "default" | "success" | "failure";
}

export function Card({ children, className = "", variant = "default" }: CardProps) {
  const variantBorder =
    variant === "success"
      ? "border-[var(--ui-success)]"
      : variant === "failure"
        ? "border-[var(--ui-failure)]"
        : "border-[var(--ui-border)]";
  return (
    <div
      className={`rounded-[var(--ui-radius)] border-[length:var(--ui-border-width)] ${variantBorder} bg-[var(--ui-neutral-bg)] p-4 ${className}`}
      style={{ borderStyle: "solid" }}
    >
      {children}
    </div>
  );
}
