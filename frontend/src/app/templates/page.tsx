import Link from "next/link";
import { api, type Template } from "@/lib/api";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { IconHouse } from "@/components/icons";

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
            className="group flex flex-col overflow-hidden rounded-2xl border border-bamboo-200 bg-white transition hover:border-leaf-300 hover:shadow-[0_1px_24px_-10px_rgba(83,131,67,0.5)]"
          >
            <div className="culm-grid flex h-32 items-center justify-center border-b border-bamboo-100 bg-leaf-50/60 text-leaf-500/80 transition group-hover:text-leaf-600">
              <IconHouse className="h-14 w-14" strokeWidth={1.25} />
            </div>
            <div className="p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-clay-600">
                {t.category}
              </span>
              <h2 className="mt-1 font-display text-lg font-semibold text-leaf-800 group-hover:text-leaf-900">
                {t.name}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-bamboo-700">{t.description}</p>
              <p className="mt-3 text-xs text-bamboo-600">Span: {t.known_span_range}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
