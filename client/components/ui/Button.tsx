"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

/**
 * Fixed button styles for light theme. Background, radius, and border are
 * defined here; pass className to override (child controls overrides).
 */
export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "cursor-pointer font-medium border-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2";


  return (
    <button
      type="button"
      className={`${base} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
