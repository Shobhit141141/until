import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="rounded-xl border-2 border-gray-800 bg-white p-8 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] max-w-md w-full text-center">
        <p className="text-6xl font-bold text-gray-300 mb-2">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-600 text-sm mb-6">
          This page doesn’t exist or has been moved.
        </p>
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-xl border-2 border-black px-6 py-3 text-black hover:bg-gray-50 w-full"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
