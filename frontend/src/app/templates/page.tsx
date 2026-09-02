import Link from "next/link";
import { api, type Template } from "@/lib/api";
import { ApiUnavailable } from "@/components/ApiUnavailable";

export const metadata = {
  title: "Template Gallery",
  description:
    "Curated bamboo structure templates with bills of materials and span ranges.",
};

export default async function TemplatesPage() {
  let templates: Template[];
  try {
    templates = await api.listTemplates();
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-leaf-900">Template Gallery</h1>
        <div className="mt-8">
          <ApiUnavailable />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-leaf-900">Template Gallery</h1>
      <p className="mt-2 max-w-2xl text-bamboo-800">
        Curated starting points, each with a default bill of materials and an indicative
        span range. Use one as the base for your own design.
      </p>

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
            <h2 className="mt-1 font-display text-lg font-semibold text-leaf-800 group-hover:text-leaf-900">
              {t.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-bamboo-800">{t.description}</p>
            <p className="mt-3 text-xs text-bamboo-600">Span: {t.known_span_range}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
