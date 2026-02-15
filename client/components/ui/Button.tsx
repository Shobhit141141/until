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


const base =
  "cursor-pointer font-medium rounded-xl border-2 border-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.12)]";

const variantClass = {
  primary: "bg-gray-900 text-white hover:bg-gray-800 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.12)]",
  secondary: "bg-white text-gray-900 hover:bg-gray-100",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${base} ${variantClass[variant]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
