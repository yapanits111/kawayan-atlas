/** Friendly fallback shown when the backend API can't be reached during SSR. */
export function ApiUnavailable() {
  return (
    <div className="rounded-xl border border-clay-400/40 bg-clay-400/10 p-6 text-bamboo-900">
      <h2 className="font-display text-lg font-semibold text-clay-600">
        Content is temporarily unavailable
      </h2>
      <p className="mt-1 text-sm">
        We couldn&apos;t reach the Kawayan Atlas API. If you&apos;re running this locally,
        make sure the backend is started on its port; otherwise please try again shortly.
      </p>
    </div>
  );
}
