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
      <div className="text-6xl" aria-hidden>🛠️</div>
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
