import Link from "next/link";

/** Simple home icon (house outline). */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export interface GoHomeLinkProps {
  className?: string;
  variant?: "link" | "button" | "primary";
}

/** Link to "/" with home icon and "Go Home" text. No arrow. */
export function GoHomeLink({ className = "", variant = "link" }: GoHomeLinkProps) {
  const baseClass = "inline-flex items-center gap-2 font-medium transition-colors";
  const variantClass =
    variant === "primary"
      ? "rounded-xl border-2 border-black px-6 py-3 text-black hover:bg-gray-50 text-center justify-center"
      : variant === "button"
        ? "rounded-xl border-2 border-black px-4 py-2 text-sm text-black hover:bg-gray-50 hover:text-black"
        : "rounded-lg border-2 border-black border-solid text-sm text-black hover:text-black bg-transparent hover:bg-gray-50 px-3 py-1.5";
  const linkClass = `${baseClass} ${variantClass} ${className}`;

  return (
    <Link href="/" className={linkClass}>
      <HomeIcon className="w-4 h-4 shrink-0" />
      Go Home
    </Link>
  );
}
