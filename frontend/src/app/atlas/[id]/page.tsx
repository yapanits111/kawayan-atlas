import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, type Joint } from "@/lib/api";
import { SourceList } from "@/components/SourceList";
import { SpeciesGlyph } from "@/components/SpeciesGlyph";
import { speciesColor } from "@/lib/speciesColor";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const s = await api.getSpecies(params.id);
    return {
      title: `${s.name_local} (${s.name_scientific})`,
      description: s.description.slice(0, 155),
    };
  } catch {
    return { title: "Species" };
  }
}

export default async function SpeciesDetail({
  params,
}: {
  params: { id: string };
}) {
  let species;
  try {
    species = await api.getSpecies(params.id);
  } catch {
    notFound();
  }

  // Joints applicable to this species (cross-link into the joint library).
  let joints: Joint[] = [];
  try {
    joints = await api.listJoints({ species_id: params.id });
  } catch {
    /* non-fatal */
  }

  const facts: [string, string][] = [
    ["Scientific name", species.name_scientific],
    ["Region", species.region],
    ["Density", species.density],
    ["Culm diameter", species.culm_diam_range],
    ["Wall thickness", species.wall_thickness_range],
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/atlas" className="text-sm text-leaf-700 hover:underline">
        ← Back to Atlas
      </Link>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-50 to-bamboo-100">
          <SpeciesGlyph
            color={speciesColor(species.id)}
            diameterRange={species.culm_diam_range}
            className="h-20 w-20"
          />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold text-leaf-900">
            {species.name_local}
          </h1>
          <p className="italic text-bamboo-600">{species.name_scientific}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {species.structural_role.map((r) => (
          <span key={r} className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-xs font-medium text-leaf-700">
            {r}
          </span>
        ))}
      </div>

      <p className="mt-6 text-bamboo-900">{species.description}</p>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-bamboo-200 bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-bamboo-500">{k}</dt>
            <dd className="mt-1 text-bamboo-900">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">Treatment methods</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {species.treatment_methods.map((t) => (
          <li key={t} className="rounded-full bg-bamboo-100 px-3 py-1 text-sm text-bamboo-800">{t}</li>
        ))}
      </ul>

      {joints.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">Compatible joints</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {joints.map((j) => (
              <Link key={j.id} href={`/joints/${j.id}`} className="rounded-lg border border-bamboo-200 bg-white p-4 hover:border-leaf-300">
                <span className="font-medium text-leaf-800">{j.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">Sources</h2>
      <SourceList sources={species.sources} />
    </div>
  );
}
