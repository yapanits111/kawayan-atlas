import Link from "next/link";
import { api } from "@/lib/api";

const flow = [
  { step: "Atlas", icon: "📖", text: "Learn the local bamboo species and their structural roles." },
  { step: "Design", icon: "✏️", text: "Start from a template and mix-and-match components." },
  { step: "Check", icon: "🔎", text: "Get advisory sanity flags on spans, bracing, and loads." },
  { step: "Build", icon: "🏗️", text: "Take a spec sheet to your engineer and builder." },
];

export default async function HomePage() {
  let templates: Awaited<ReturnType<typeof api.listTemplates>> = [];
  try {
    templates = await api.listTemplates();
  } catch {
    // Landing still renders if the API is down; gallery just shows empty.
  }

  return (
    <div>
      {/* Hero */}
      <section className="bamboo-texture border-b border-bamboo-200">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <p className="mb-4 inline-block rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Philippine bamboo, from atlas to blueprint
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight text-leaf-900 md:text-6xl">
            Design bamboo structures
            <br />
            with confidence.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-bamboo-800">
            Kawayan Atlas is a living reference and design sandbox for bamboo
            construction in the Philippines — browse local species and joints, start
            from proven templates, and sanity-check your ideas before you spend a peso.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/atlas"
              className="rounded-lg bg-leaf-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-leaf-700"
            >
              Explore the Atlas
            </Link>
            <Link
              href="/studio"
              className="rounded-lg border border-bamboo-300 bg-bamboo-50 px-6 py-3 font-semibold text-bamboo-800 transition hover:bg-bamboo-100"
            >
              Try the Design Studio
            </Link>
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold text-leaf-800">
          From learning to blueprint
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {flow.map((f, i) => (
            <div
              key={f.step}
              className="rounded-xl border border-bamboo-200 bg-white/70 p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{f.icon}</span>
                <span className="text-xs font-semibold text-bamboo-500">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold text-leaf-800">
                {f.step}
              </h3>
              <p className="mt-1 text-sm text-bamboo-800">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery from templates */}
      <section className="border-t border-bamboo-200 bg-bamboo-100/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold text-leaf-800">
              Start from a template
            </h2>
            <Link href="/templates" className="text-sm font-medium text-leaf-700 hover:underline">
              See all →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                className="group rounded-xl border border-bamboo-200 bg-white p-5 shadow-sm transition hover:border-leaf-300 hover:shadow-md"
              >
                <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-gradient-to-br from-leaf-100 to-bamboo-100 text-4xl">
                  🏠
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-clay-500">
                  {t.category}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold text-leaf-800 group-hover:text-leaf-900">
                  {t.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-bamboo-800">
                  {t.description}
                </p>
              </Link>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-bamboo-700">
                Templates load from the API — start the backend to see them here.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
