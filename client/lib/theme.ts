/**
 * UNTIL design tokens — single source for configurable UI.
 * Change these to rebrand without touching component code.
 */

export const theme = {
  /** Accent color (buttons, active states, primary actions) */
  accent: "var(--ui-accent)",
  /** Success (correct answer, small) */
  success: "var(--ui-success)",
  /** Failure (wrong/timeout, brief) */
  failure: "var(--ui-failure)",
  /** Neutral text/background */
  neutral: {
    bg: "var(--ui-neutral-bg)",
    text: "var(--ui-neutral-text)",
    muted: "var(--ui-neutral-muted)",
    border: "var(--ui-border)",
  },
  /** Border: thick, not shadows */
  borderWidth: "var(--ui-border-width)",
  /** Rounded but not bubbly */
  radius: "var(--ui-radius)",
  /** Typography */
  font: {
    sans: "var(--font-geist-sans), system-ui, sans-serif",
    mono: "var(--font-geist-mono), ui-monospace, monospace",
  },
} as const;

/** Default CSS variable values (used in globals.css). */
export const themeDefaults = {
  "--ui-accent": "#2563eb",
  "--ui-success": "#16a34a",
  "--ui-failure": "#dc2626",
  "--ui-neutral-bg": "#ffffff",
  "--ui-border": "#a3a3a3",
  "--ui-border-width": "2px",
  "--ui-radius": "full",
} as const;
