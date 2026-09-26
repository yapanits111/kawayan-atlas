"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a real deployment this is where you'd report to an error service.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-clay-400/15 text-clay-600" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold text-leaf-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-bamboo-800">
        An unexpected error occurred. You can try again, or head back to the atlas.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-leaf-600 px-5 py-2.5 font-semibold text-white hover:bg-leaf-700"
        >
          Try again
        </button>
        <a
          href="/atlas"
          className="rounded-lg border border-bamboo-300 bg-bamboo-50 px-5 py-2.5 font-semibold text-bamboo-800 hover:bg-bamboo-100"
        >
          Bamboo Atlas
        </a>
      </div>
    </div>
  );
}
