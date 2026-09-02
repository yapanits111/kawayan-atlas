export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-bamboo-200 bg-bamboo-100/60">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* Persistent structural-safety disclaimer — required (PLAN.md 1, 3E/3F, 7). */}
        <div className="rounded-lg border border-clay-400/40 bg-clay-400/10 p-4 text-sm text-bamboo-900">
          <strong className="font-semibold">Design-exploration tool — not engineering advice.</strong>{" "}
          Kawayan Atlas is a learning and design-exploration aid. It does not replace a
          licensed structural engineer or the LGU building-permit process. Any capacities,
          flags, or estimates are advisory and must be verified by a qualified professional
          before construction.
        </div>
        <p className="mt-6 text-xs text-bamboo-700">
          © {new Date().getFullYear()} Kawayan Atlas · A Philippine bamboo-structures
          reference &amp; design sandbox · Release 1 (demo)
        </p>
      </div>
    </footer>
  );
}
