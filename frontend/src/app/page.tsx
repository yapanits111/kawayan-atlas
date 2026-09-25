import Link from "next/link";
import { api } from "@/lib/api";
import { SpeciesGlyph } from "@/components/SpeciesGlyph";
import {
  IconArrow,
  IconBook,
  IconFrame,
  IconHouse,
  IconInspect,
  IconPencil,
} from "@/components/icons";

const flow = [
  { step: "Atlas", Icon: IconBook, text: "Learn the local bamboo species and their structural roles." },
  { step: "Design", Icon: IconPencil, text: "Start from a template and mix-and-match components." },
  { step: "Check", Icon: IconInspect, text: "Get advisory sanity flags on spans, bracing, and loads." },
  { step: "Build", Icon: IconFrame, text: "Take a spec sheet to your engineer and builder." },
];

// A small "grove" of stylised culms for the hero — on-brand, no external images.
const grove = [
  { color: "#7d683a", dia: "130 mm", cls: "left-0 bottom-0 h-72 w-72 opacity-90" },
  { color: "#538343", dia: "90 mm", cls: "left-28 bottom-6 h-60 w-60 opacity-95" },
  { color: "#9a8248", dia: "70 mm", cls: "left-52 bottom-2 h-52 w-52 opacity-80" },
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
      <section className="bamboo-texture relative overflow-hidden border-b border-bamboo-200">
        <div className="culm-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-leaf-700">
              <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
              Philippine bamboo · atlas to blueprint
            </p>
            <h1 className="font-display text-[2.75rem] font-semibold leading-[1.05] text-leaf-900 md:text-6xl lg:text-[4.25rem]">
              Design bamboo structures with confidence.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bamboo-800">
              A living reference and design sandbox for bamboo construction in the
              Philippines — browse local species and joints, start from proven templates,
              and sanity-check your ideas before you spend a peso.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/design"
                className="group inline-flex items-center gap-2 rounded-xl bg-leaf-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-leaf-700"
              >
                Open the Design Lab
                <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/atlas"
                className="inline-flex items-center gap-2 rounded-xl border border-bamboo-300 bg-white/70 px-6 py-3 font-semibold text-bamboo-800 transition hover:border-bamboo-400 hover:bg-white"
              >
                Explore the Atlas
              </Link>
            </div>
          </div>

          {/* Culm grove motif */}
          <div className="relative hidden h-80 lg:block" aria-hidden>
            {grove.map((g, i) => (
              <SpeciesGlyph
                key={i}
                color={g.color}
                diameterRange={g.dia}
                className={`absolute drop-shadow-sm ${g.cls}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-2xl font-semibold text-leaf-800 md:text-3xl">
          From learning to blueprint
        </h2>
        <p className="mt-2 max-w-2xl text-bamboo-700">
          Four steps, one workflow — each backed by cited data and honest, advisory checks.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {flow.map((f, i) => (
            <div
              key={f.step}
              className="rounded-2xl border border-bamboo-200 bg-white p-6 transition hover:border-leaf-300 hover:shadow-[0_1px_20px_-8px_rgba(83,131,67,0.4)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-100">
                <f.Icon className="h-6 w-6" />
              </div>
              <span className="mt-4 block text-xs font-semibold uppercase tracking-wider text-bamboo-400">
                Step {i + 1}
              </span>
              <h3 className="mt-1 font-display text-lg font-semibold text-leaf-800">
                {f.step}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-bamboo-700">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery from templates */}
      <section className="border-t border-bamboo-200 bg-bamboo-100/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-leaf-800 md:text-3xl">
                Start from a template
              </h2>
              <p className="mt-2 max-w-xl text-bamboo-700">
                Proven forms with a bill of materials — open one and make it yours.
              </p>
            </div>
            <Link
              href="/templates"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-leaf-700 hover:text-leaf-800"
            >
              See all
              <IconArrow className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  <h3 className="mt-1 font-display text-lg font-semibold text-leaf-800 group-hover:text-leaf-900">
                    {t.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-bamboo-700">
                    {t.description}
                  </p>
                </div>
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
